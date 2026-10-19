// 서버 전용 데이터 조회. 검색 노출 페이지(유튜버·지역·가게)와 sitemap이 같은 한 벌을 쓴다.
// 가게 수가 수천 개 수준이라 보이는 가게 전체를 한 번에 읽어 1시간 캐시한다.
// 파이프라인이 /api/revalidate를 부르면 'mukmap-data' 태그로 바로 갱신된다.
import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/supabase'
import type { Channel, RestaurantWithVideos } from '@/lib/types'

export const DATA_TAG = 'mukmap-data'

const VIDEO_FIELDS = `id, video_id, channel_id, restaurant_id, title, thumbnail_url, rating, summary, is_ad,
  timestamp_seconds, published_at, created_at, view_count, menu, price, quote, why`

async function fetchAll(): Promise<{ channels: Channel[]; restaurants: RestaurantWithVideos[] }> {
  // 채널 조회가 실패한 채로 캐시하면 가게가 전부 걸러져 1시간 동안 빈 사이트가 된다
  const { data: channels, error: chError } = await supabase.from('channels').select('*')
  if (chError) throw chError
  const byId = new Map((channels || []).map((c) => [c.id, c as Channel]))

  const rows: RestaurantWithVideos[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('restaurants')
      .select(`*, videos (${VIDEO_FIELDS})`)
      .eq('is_visible', true)
      .not('lat', 'is', null)
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    for (const r of data || []) {
      const videos = (r.videos || [])
        .filter((v: { channel_id: string }) => byId.has(v.channel_id))
        .map((v: { channel_id: string }) => {
          const ch = byId.get(v.channel_id)!
          return { ...v, channel_name: ch.name, channel_thumbnail: ch.thumbnail_url, channel_slug: ch.slug }
        })
        .sort((a: { published_at: string | null }, b: { published_at: string | null }) =>
          (b.published_at || '').localeCompare(a.published_at || ''))
      if (videos.length) rows.push({ ...r, videos })
    }
    if (!data || data.length < 1000) break
  }
  return { channels: Array.from(byId.values()), restaurants: rows }
}

export const getAll = unstable_cache(fetchAll, ['mukmap-all-v1'], { revalidate: 3600, tags: [DATA_TAG] })

/** URL 조각을 사람이 읽는 값으로. Next 14는 한글 params를 퍼센트 인코딩된 채로 넘길 때가 있다. */
export function decodeParam(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export interface ChannelSummary extends Channel {
  restaurant_count: number
  regions: { region: string; count: number }[]
  first_year: number | null
  last_year: number | null
}

function years(rs: RestaurantWithVideos[], channelId?: string) {
  const ys = rs.flatMap((r) => r.videos)
    .filter((v) => !channelId || v.channel_id === channelId)
    .map((v) => (v.published_at ? new Date(v.published_at).getFullYear() : NaN))
    .filter((y) => !isNaN(y))
  return ys.length ? { first: Math.min(...ys), last: Math.max(...ys) } : { first: null, last: null }
}

function countBy<T>(items: T[], key: (t: T) => string | null | undefined) {
  const m = new Map<string, number>()
  for (const it of items) {
    const k = key(it)
    if (k) m.set(k, (m.get(k) || 0) + 1)
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
}

export async function getChannelSummaries(): Promise<ChannelSummary[]> {
  const { channels, restaurants } = await getAll()
  return channels
    .map((ch) => {
      const rs = restaurants.filter((r) => r.videos.some((v) => v.channel_id === ch.id))
      const y = years(rs, ch.id)
      return {
        ...ch,
        restaurant_count: rs.length,
        regions: countBy(rs, (r) => r.region).map(([region, count]) => ({ region, count })),
        first_year: y.first,
        last_year: y.last,
      }
    })
    .filter((c) => c.restaurant_count > 0)
    .sort((a, b) => b.restaurant_count - a.restaurant_count)
}

export async function getChannelBySlugOrId(key: string) {
  const { channels } = await getAll()
  return channels.find((c) => c.slug === key || c.id === key) || null
}

export async function restaurantsOf(filter: { channelId?: string; region?: string; city?: string }) {
  const { restaurants } = await getAll()
  const latest = (r: RestaurantWithVideos) =>
    (filter.channelId ? r.videos.find((v) => v.channel_id === filter.channelId) : r.videos[0])?.published_at || ''
  // 목록 페이지는 앞에서부터 잘라 보여주므로 최근 영상 순으로 세운다(videos는 이미 최신순)
  return restaurants
    .filter((r) =>
      (!filter.channelId || r.videos.some((v) => v.channel_id === filter.channelId)) &&
      (!filter.region || r.region === filter.region) &&
      (!filter.city || r.city === filter.city))
    .sort((a, b) => latest(b).localeCompare(latest(a)) || b.id - a.id)
}

export async function getRegionSummaries() {
  const { restaurants } = await getAll()
  return countBy(restaurants, (r) => r.region).map(([region, count]) => ({
    region,
    count,
    cities: countBy(restaurants.filter((r) => r.region === region), (r) => r.city)
      .map(([city, n]) => ({ city, count: n })),
  }))
}

export async function getRestaurant(id: number) {
  const { restaurants } = await getAll()
  return restaurants.find((r) => r.id === id) || null
}

/** 목록 페이지 첫 문단용 사실 문장 재료. LLM 없이 데이터로만 만든다. */
export function factsOf(rs: RestaurantWithVideos[], channelId?: string) {
  const y = years(rs, channelId)
  const menus = countBy(
    rs.flatMap((r) => r.videos).filter((v) => !channelId || v.channel_id === channelId),
    (v) => v.menu?.split(/[,·]/)[0]?.replace(/\s*\d+\s*(인분|그릇|개|접시|잔|판)?$/, '').trim(),
  )
  const categories = countBy(rs, (r) => r.category)
  const latest = rs.flatMap((r) => r.videos).map((v) => v.published_at || '').sort().pop() || null
  return {
    count: rs.length,
    firstYear: y.first,
    lastYear: y.last,
    topMenus: menus.slice(0, 3).map(([m]) => m),
    topCategory: categories[0]?.[0] || null,
    latest,
  }
}

export function yearRange(first: number | null, last: number | null) {
  if (!first || !last) return ''
  return first === last ? `${first}년` : `${first}~${last}년`
}

/** 가게 3곳 미만인 조합은 색인하지 않는다(얇은 페이지가 사이트 평가를 깎지 않게). */
export const MIN_INDEXABLE = 3
