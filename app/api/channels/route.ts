import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { retryDb } from '@/lib/retry'

export const revalidate = 3600

const CACHE = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }

// 실패를 빈 목록으로 돌려주면 그게 한 시간 캐시돼 지도 핀 얼굴이 다 빠진다(2026-10-20).
// 에러를 던지면 Next가 다시 만들기를 포기하고 전에 만든 응답을 계속 준다
export async function GET() {
  // 빌드 때 페이지들과 겹쳐 부르면 statement timeout이 나 배포가 깨졌다(10/23). 일시 오류는 다시 부른다
  const channels = await retryDb(() =>
    supabase
      .from('channels')
      .select(`
        *,
        videos (
          id,
          restaurant_id,
          restaurants!inner (
            is_visible
          )
        )
      `),
  ).catch((e) => {
    throw new Error(`channels: ${e.message}`)
  })

  const result = (channels || [])
    .map((ch) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const visibleVideos = (ch.videos || []).filter((v: any) => v.restaurants?.is_visible === true)
      const restaurantIds = new Set(
        visibleVideos
          .map((v: { restaurant_id: number | null }) => v.restaurant_id)
          .filter(Boolean)
      )
      const { videos: _videos, ...rest } = ch
      return { ...rest, restaurant_count: restaurantIds.size }
    })
    .filter((ch) => ch.restaurant_count > 0)
    .sort((a, b) => b.restaurant_count - a.restaurant_count)

  if (!result.length) throw new Error('channels: empty')
  return NextResponse.json({ channels: result }, { headers: CACHE })
}
