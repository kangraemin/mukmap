import { NextRequest, NextResponse } from 'next/server'
import { isStationQuery, type Station } from '@/lib/search'

const CACHE = { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' }

interface LocalResult {
  title: string
  category: string
  mapx: string | number
  mapy: string | number
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim()
  if (!isStationQuery(q)) return NextResponse.json([], { headers: CACHE })
  const id = process.env.NAVER_SEARCH_CLIENT_ID
  const secret = process.env.NAVER_SEARCH_CLIENT_SECRET
  if (!id || !secret) {
    return NextResponse.json([], { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const response = await fetch(`https://openapi.naver.com/v1/search/local.json?display=5&query=${encodeURIComponent(q)}`, {
      headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('station search unavailable')
    const data = await response.json() as { items?: LocalResult[] }
    if (!Array.isArray(data.items)) throw new Error('invalid station response')
    const stations: Station[] = []
    const seen = new Set<string>()
    for (const item of data.items) {
      if (!/(?:^|>)(?:지하철,전철|기차,철도)$/.test(item.category)) continue
      const name = item.title.replace(/<\/?b>/gi, '').trim()
      const lng = Number(item.mapx) / 1e7
      const lat = Number(item.mapy) / 1e7
      if (!name || seen.has(name) || !Number.isFinite(lat) || !Number.isFinite(lng)
        || lat <= 0 || lat > 90 || lng <= 0 || lng > 180) continue
      seen.add(name)
      stations.push({ name, lat, lng })
      if (stations.length === 3) break
    }
    return NextResponse.json(stations, { headers: CACHE })
  } catch {
    // 장애를 빈 검색 결과로 하루 동안 캐시하지 않는다.
    return NextResponse.json([], { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
