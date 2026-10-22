// 가게 하나 보고 끝나지 않게 다음 후보를 고른다. next/* 를 쓰지 않는다(토스 앱이 그대로 가져다 쓴다).
import { km } from '@/lib/stations'
import type { RestaurantWithVideos } from '@/lib/types'

const NEAR_KM = 3

/** 이 가게 3km 안의 다른 가게. 같은 유튜버가 간 곳을 먼저, 그다음 가까운 순으로 n개 */
export function nearbyOf(r: RestaurantWithVideos, all: RestaurantWithVideos[], n = 6) {
  if (r.lat == null || r.lng == null) return []
  const mine = new Set(r.videos.map((v) => v.channel_id))
  return all
    .filter((x) => x.id !== r.id && x.lat != null && x.lng != null)
    .map((x) => ({ r: x, km: km(r.lat!, r.lng!, x.lat!, x.lng!), same: x.videos.some((v) => mine.has(v.channel_id)) }))
    .filter((x) => x.km <= NEAR_KM)
    .sort((a, b) => Number(b.same) - Number(a.same) || a.km - b.km)
    .slice(0, n)
}

export function distLabel(k: number) {
  return k < 1 ? `${Math.max(10, Math.round((k * 1000) / 10) * 10)}m` : `${k.toFixed(1)}km`
}

/** 최근 7일 안에 올라온 영상에 나온 가게, 새 영상 순으로 n개 */
export function newThisWeek(all: RestaurantWithVideos[], now = Date.now(), n = 12) {
  const since = new Date(now - 7 * 864e5).toISOString()
  return all
    .map((r) => ({ r, at: r.videos.reduce((m, v) => ((v.published_at || '') > m ? v.published_at! : m), '') }))
    .filter((x) => x.at >= since)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, n)
}
