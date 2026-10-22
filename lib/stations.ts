// 역 맛집 페이지(/station/홍대입구) 공용. 역 목록은 lib/stations.json(scripts/build_stations.py)
import rows from './stations.json'
import type { RestaurantWithVideos } from './types'

export interface StationInfo {
  /** 주소 조각. 이름이 같은 역이 여럿이면 지역을 붙인다(시청-부산) */
  slug: string
  name: string
  lat: number
  lng: number
  hint?: string
}

/** 역에서 이 거리 안 가게를 보여준다 */
export const STATION_KM = 1
// 걷는 속도 분당 80m
const WALK_M_PER_MIN = 80

export const STATIONS: StationInfo[] = (rows as [string, number, number, string?][]).map(([name, lat, lng, hint]) => ({
  slug: hint ? `${name}-${hint.replace(/\s+/g, '-')}` : name,
  name,
  lat,
  lng,
  hint,
}))

export function stationBySlug(slug: string) {
  return STATIONS.find((s) => s.slug === slug) || null
}

export function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLng - aLng) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/** 역 1km 안 가게를 가까운 순으로, 걸어서 몇 분인지와 함께 */
export function nearStation(s: StationInfo, rs: RestaurantWithVideos[]) {
  return rs
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({ r, d: km(s.lat, s.lng, r.lat!, r.lng!) }))
    .filter((x) => x.d <= STATION_KM)
    .sort((a, b) => a.d - b.d)
    .map(({ r, d }) => ({ r, min: Math.max(1, Math.round((d * 1000) / WALK_M_PER_MIN)) }))
}
