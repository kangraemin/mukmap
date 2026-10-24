// 서버 전용 데이터 조회. 검색 노출 페이지(유튜버·지역·가게)와 sitemap이 같은 한 벌을 쓴다.
// 가게 수가 수천 개 수준이라 보이는 가게 전체를 500곳씩 나눠 읽어 1시간 캐시한다.
// 파이프라인이 /api/revalidate를 부르면 'mukmap-data' 태그로 바로 갱신된다.
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { supabase } from '@/lib/supabase'
import { retryDb } from '@/lib/retry'
import { buildSnap } from '@/lib/build-snap'
import { coalesce } from '@/lib/coalesce'
import type { Channel, RestaurantWithVideos, VideoDetail } from '@/lib/types'
import { romanize } from '@/lib/romanize'
import { CATEGORY, DATA_KEY, bilingualName, channelName, cityName, regionName, type Lang } from '@/lib/i18n'

export const DATA_TAG = 'mukmap-data'
// 새 가게가 들어오면 수집기가 /api/revalidate로 바로 비운다. 시간 만료는 하루에 한 번 안전망으로만 둔다.
// 1시간으로 두면 만료 때마다 가게 전체(12덩어리)를 다시 읽어 DB 부하 1위였다(10/24)
const DATA_REVALIDATE = 86400

// Next 데이터 캐시는 항목당 2MB까지다. 넘으면 캐시가 안 돼 요청마다 DB 전체를 다시 읽는다.
// 그래서 캐시에는 화면에 쓰는 칸만 담고, 채널 이름·얼굴은 캐시 밖에서 붙인다.
const RESTAURANT_FIELDS = 'id, name, address, lat, lng, category, region, city, naver_place_id, created_at'
const VIDEO_FIELDS = `id, video_id, channel_id, title, rating, summary, is_ad,
  timestamp_seconds, published_at, menu, price, quote, why`

type RawVideo = { channel_id: string; published_at: string | null } & Record<string, unknown>
type RawRestaurant = Record<string, unknown> & { videos: RawVideo[] }

// 채널 조회가 실패한 채로 캐시하면 가게가 전부 걸러져 1시간 동안 빈 사이트가 된다
const getChannels = unstable_cache(
  async (): Promise<Channel[]> => {
    const data = await buildSnap('channels', () => retryDb(() => supabase.from('channels').select('*')))
    return (data || []) as Channel[]
  },
  ['mukmap-channels-v1'],
  { revalidate: DATA_REVALIDATE, tags: [DATA_TAG] },
)

// 가게 전체를 한 항목으로 담으면 2MB를 넘어 캐시가 안 된다. 500곳씩 따로 담는다
const CHUNK = 500
const getChunk = unstable_cache(
  async (from: number): Promise<{ rows: RawRestaurant[]; full: boolean }> => {
    const data = await buildSnap(`chunk:${from}`, () => retryDb(() =>
      supabase
        .from('restaurants')
        .select(`${RESTAURANT_FIELDS}, videos (${VIDEO_FIELDS})`)
        .eq('is_visible', true)
        .not('lat', 'is', null)
        .order('id')
        .range(from, from + CHUNK - 1),
    ))
    return { rows: (data || []) as unknown as RawRestaurant[], full: (data || []).length === CHUNK }
  },
  ['mukmap-all-chunk-v1'],
  { revalidate: DATA_REVALIDATE, tags: [DATA_TAG] },
)

// 동시에 그려지는 페이지들이 한 번만 모으게 묶는다
const getCompact = coalesce(readCompact)

async function readCompact(): Promise<{ channels: Channel[]; restaurants: RawRestaurant[] }> {
  const channels = await getChannels()
  const ids = new Set(channels.map((c) => c.id))
  const rows: RawRestaurant[] = []
  const seen = new Set<unknown>()
  for (let from = 0; ; from += CHUNK) {
    const chunk = await getChunk(from)
    for (const r of chunk.rows) {
      // 덩어리마다 저장 시각이 달라 경계에서 같은 가게가 두 번 올 수 있다
      if (seen.has(r.id)) continue
      seen.add(r.id)
      const videos = (r.videos || [])
        .filter((v) => ids.has(v.channel_id))
        .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))
      if (videos.length) rows.push({ ...r, videos })
    }
    if (!chunk.full) break
  }
  return { channels, restaurants: rows }
}

// 한 요청 안에서 메타데이터와 본문이 같이 불러도 한 번만 만든다
export const getAll = cache(async (): Promise<{ channels: Channel[]; restaurants: RestaurantWithVideos[] }> => {
  const { channels, restaurants } = await getCompact()
  const byId = new Map(channels.map((c) => [c.id, c]))
  return {
    channels,
    restaurants: restaurants.map((r) => ({
      ...r,
      needs_review: false,
      is_visible: true,
      videos: r.videos.map((v) => {
        const ch = byId.get(v.channel_id)!
        return { ...v, thumbnail_url: null, channel_name: ch.name, channel_thumbnail: ch.thumbnail_url, channel_slug: ch.slug }
      }),
    })) as unknown as RestaurantWithVideos[],
  }
})

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
  const r = restaurants.find((x) => x.id === id)
  if (!r) return null
  // 상세 요약은 커서 전체 캐시(2MB 한도)에 넣지 않고 가게 하나만 따로 읽는다
  const { data } = await supabase.from('videos').select('id, detail, i18n').eq('restaurant_id', id)
  const byId = new Map((data || []).map((v) => [v.id as number, v as { detail: VideoDetail | null; i18n: Record<string, VideoI18n> | null }]))
  return {
    ...r,
    videos: r.videos.map((v) => ({ ...v, detail: byId.get(v.id)?.detail || null, i18n: byId.get(v.id)?.i18n || null })),
  }
}

/** 영상 하나의 언어별 번역본(videos.i18n[언어]) */
export interface VideoI18n {
  title?: string
  menu?: string
  price?: string
  why?: string
  detail?: VideoDetail
  store?: string
  store_label?: string
  category?: string
  category_label?: string
}

type WithI18n = NonNullable<Awaited<ReturnType<typeof getRestaurant>>>

/** 가게를 그 언어로 바꾼다. 번역본이 하나도 없으면 null(bare면 한국어 글만 빼고 돌려준다). 주소·구 이름은 현지에서 찾을 수 있게 한국어로 둔다 */
export function localize(r: WithI18n, lang: Lang, bare = false) {
  const key = DATA_KEY[lang]
  const tr = r.videos.map((v) => v.i18n?.[key]).filter(Boolean) as VideoI18n[]
  if (!tr.length && !bare) return null
  const label = tr.find((x) => x.store_label)?.store_label
  return {
    ...r,
    // 현지 간판·지도 검색용으로 한국어 이름을 같이 둔다
    name: bilingualName(label, r.name),
    label: label || romanize(r.name),
    // 네이버·구글 지도 검색은 한국어 이름으로 해야 그 가게가 나온다
    name_ko: r.name,
    category: tr.find((x) => x.category_label)?.category_label || CATEGORY[r.category]?.[lang] || r.category,
    region: regionName(r.region, lang) || null,
    regionKo: r.region,
    city: cityName(r.region, r.city, lang) || null,
    videos: r.videos.map((v) => {
      const x = v.i18n?.[key]
      const base = { ...v, i18n: null, channel_name: channelName(v.channel_name, lang), summary: null, quote: null }
      // 아직 번역 안 된 영상은 한국어 제목 대신 '영상 보기'로 둔다
      return x
        ? { ...base, title: x.title?.replace(/\s*#\S*[가-힣]\S*/g, '').trim() || null, menu: x.menu || null, price: x.price || null, why: x.why || null, detail: x.detail || null }
        : { ...base, title: null, menu: null, price: null, why: null, detail: null }
    }),
  }
}

/** 언어별로 번역된 가게 id와 영문(그 언어) 이름. 목록·sitemap용이라 이름만 가볍게 읽는다 */
export const translatedNames = unstable_cache(
  async (lang: Lang): Promise<Record<number, { label: string; category: string | null }>> => {
    const key = DATA_KEY[lang]
    const out: Record<number, { label: string; category: string | null }> = {}
    for (let from = 0; ; from += 1000) {
      const data = await buildSnap(`names:${lang}:${from}`, () => retryDb(() =>
        supabase
          .from('videos')
          .select(`restaurant_id, label:i18n->${key}->>store_label, category:i18n->${key}->>category_label`)
          .not(`i18n->${key}`, 'is', null)
          .order('id')
          .range(from, from + 999),
      ))
      for (const v of (data || []) as unknown as { restaurant_id: number; label: string | null; category: string | null }[]) {
        if (v.label && !out[v.restaurant_id]) out[v.restaurant_id] = { label: v.label, category: v.category }
      }
      if (!data || data.length < 1000) break
    }
    return out
  },
  ['mukmap-i18n-names-v1'],
  { revalidate: DATA_REVALIDATE, tags: [DATA_TAG] },
)

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
