import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { retryDb } from '@/lib/retry'
import type { PinsPayload } from '@/lib/pins'

// 모든 보이는 가게를 한 번에 준다. 한 시간 캐시, 수집 후 /api/revalidate가 비운다
export const revalidate = 3600

const PAGE = 1000

interface Row {
  id: number
  name: string
  lat: number
  lng: number
  category: string
  region: string | null
  city: string | null
  videos: {
    video_id: string
    channel_id: string
    published_at: string | null
    quote: string | null
    menu: string | null
    rec: string | null
    verdict: string | null
    dishes: { name?: string; best?: boolean }[] | null
    dprice: string | null
    wait: string | null
    parking: string | null
  }[]
}

// 상세 요약에서 카드에 쓰는 칸만 꺼낸다(전체 detail은 크다)
const DETAIL = 'rec:detail->>recommend,verdict:detail->>verdict,dishes:detail->dishes,dprice:detail->>price,wait:detail->>wait,parking:detail->>parking'

export async function GET() {
  const rows: Row[] = []
  // Supabase는 한 번에 1000행까지만 준다
  for (let from = 0; ; from += PAGE) {
    const data = await retryDb(() =>
      supabase
        .from('restaurants')
        .select(`id,name,lat,lng,category,region,city,videos(video_id,channel_id,published_at,quote,menu,${DETAIL})`)
        .eq('is_visible', true)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('id')
        .range(from, from + PAGE - 1),
    ).catch(() => undefined)
    if (data === undefined) return NextResponse.json({ error: 'pins unavailable' }, { status: 500 })
    rows.push(...((data || []) as Row[]))
    if (!data || data.length < PAGE) break
  }

  const channels: string[] = []
  const index = new Map<string, number>()
  const chIndex = (id: string) => {
    if (!index.has(id)) index.set(id, channels.push(id) - 1)
    return index.get(id)!
  }
  const round = (n: number) => Math.round(n * 1e5) / 1e5

  const pins: PinsPayload['pins'] = rows.map((r) => {
    const vs = [...(r.videos || [])].sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))
    // 요약이 있는 가장 최근 영상을 대표로 둔다
    const lead = vs.find((v) => v.verdict) || vs.find((v) => v.quote) || vs[0]
    const dishes = (lead?.verdict && lead.dishes) || []
    const best = (dishes.find((d) => d.best) || dishes[0])?.name || null
    return {
      id: r.id,
      name: r.name,
      lat: round(r.lat),
      lng: round(r.lng),
      category: r.category,
      region: r.region,
      city: r.city,
      date: (vs[0]?.published_at || '').slice(0, 10),
      ch: Array.from(new Set(vs.map((v) => v.channel_id))).map(chIndex),
      vid: lead?.video_id || null,
      line: (lead?.quote || lead?.menu || null)?.slice(0, 40) || null,
      quote: Boolean(lead?.quote),
      menu: Array.from(new Set(vs.flatMap((v) => (v.menu || '').split(/\s*,\s*/)).filter(Boolean))).join(', ').slice(0, 80),
      nv: vs.length,
      ...(lead?.verdict
        ? {
            rec: lead.rec || null,
            verdict: lead.verdict.slice(0, 60),
            best,
            price: lead.dprice?.slice(0, 30) || null,
            wait: lead.wait?.slice(0, 24) || null,
            park: lead.parking?.slice(0, 24) || null,
          }
        : {}),
    }
  })

  return NextResponse.json(
    { channels, pins } satisfies PinsPayload,
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  )
}
