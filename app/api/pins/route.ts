import { NextResponse } from 'next/server'
import { buildPins, PINS_CACHE } from '@/lib/pins-build'

// 모든 보이는 가게를 한 번에 준다. 수집 후 /api/revalidate가 비운다.
// CDN은 1시간(s-maxage)만 들고, 서버 캐시는 하루 들고 있어 CDN이 만료돼도 DB를 다시 읽지 않는다(1시간이면 DB 부하 4위였다, 10/24)
export const revalidate = 86400

export async function GET() {
  const payload = await buildPins()
  if (!payload) return NextResponse.json({ error: 'pins unavailable' }, { status: 500 })
  return NextResponse.json(payload, { headers: PINS_CACHE })
}
