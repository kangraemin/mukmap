// 화면 공용 계산. next/* 를 쓰지 않는다(토스 앱이 그대로 가져다 쓴다).
import type { RestaurantWithVideos } from '@/lib/types'

export type VisitVideo = RestaurantWithVideos['videos'][number]

export function sceneUrl(v: Pick<VisitVideo, 'video_id' | 'timestamp_seconds'>) {
  const t = v.timestamp_seconds ? `&t=${v.timestamp_seconds}s` : ''
  return `https://www.youtube.com/watch?v=${v.video_id}${t}`
}

/** 저장된 썸네일은 320px(mqdefault)라 큰 카드에서 뭉개진다. 480px 판을 쓴다 */
export function thumbOf(v: Pick<VisitVideo, 'video_id' | 'thumbnail_url'>) {
  return `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`
}

export function clock(sec: number | null | undefined) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = String(sec % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

const mapQuery = (r: Pick<RestaurantWithVideos, 'name' | 'name_ko' | 'address'>) => `${r.name_ko || r.name} ${r.address || ''}`.trim()

export function placeUrl(r: Pick<RestaurantWithVideos, 'name' | 'name_ko' | 'address' | 'naver_place_id'>) {
  return r.naver_place_id
    ? `https://map.naver.com/p/entry/place/${r.naver_place_id}`
    : `https://map.naver.com/p/search/${encodeURIComponent(mapQuery(r))}`
}

/** 구글 지도 검색 주소(공식 Maps URLs). 이름+주소로 찾으면 그 가게 카드가 열린다 */
export function googleMapUrl(r: Pick<RestaurantWithVideos, 'name' | 'name_ko' | 'address'>) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(r))}`
}

export function areaOf(r: Pick<RestaurantWithVideos, 'region' | 'city'>) {
  return [r.region, r.city].filter(Boolean).join(' ')
}

/** 대표 장면: 상세 요약이 있는 가장 최근 영상, 다음은 자막 인용이 있는 영상, 없으면 가장 최근 영상 */
export function leadVideo(r: RestaurantWithVideos): VisitVideo | undefined {
  return r.videos.find((v) => v.detail?.verdict) || r.videos.find((v) => v.quote) || r.videos[0]
}

/** 다녀간 유튜버(중복 없이, 최근 방문 순) */
export function visitorsOf(r: RestaurantWithVideos) {
  const seen = new Map<string, { id: string; name: string; thumbnail: string | null; slug?: string | null }>()
  for (const v of r.videos) {
    if (!seen.has(v.channel_id)) {
      seen.set(v.channel_id, { id: v.channel_id, name: v.channel_name, thumbnail: v.channel_thumbnail, slug: v.channel_slug })
    }
  }
  return Array.from(seen.values())
}

export function dateLabel(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
}
