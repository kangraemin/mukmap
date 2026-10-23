import type { MetadataRoute } from 'next'
import { MIN_INDEXABLE, getAll, translatedNames } from '@/lib/data'
import { LANGS, REGIONS, langPath } from '@/lib/i18n'
import { abs, pathOf } from '@/lib/seo'
import type { RestaurantWithVideos } from '@/lib/types'
import { newThisWeek, recentOf } from '@/lib/related'
import { STATIONS, nearStation } from '@/lib/stations'
import { getPosts } from '@/lib/blog'

export const revalidate = 3600

// 페이지마다 그 안의 가게 중 가장 최근 영상 날짜를 lastmod로 쓴다
function latest(rs: RestaurantWithVideos[]) {
  const d = rs.flatMap((r) => r.videos.map((v) => v.published_at || '')).sort().pop()
  return d ? new Date(d) : undefined
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { channels, restaurants } = await getAll()
  const out: MetadataRoute.Sitemap = [{ url: abs('/'), lastModified: latest(restaurants), changeFrequency: 'daily' }]
  // 매주 바뀌는 '이번 주 새로 뜬 곳'(app/this-week)
  const week = newThisWeek(restaurants, Date.now(), 60).map((x) => x.r)
  if (week.length >= MIN_INDEXABLE) out.push({ url: abs('/this-week'), lastModified: latest(week), changeFrequency: 'daily' })
  // 유튜버별 최근 30일 새 맛집(app/youtuber/[slug]/new)
  for (const c of channels) {
    const rs = recentOf(restaurants, c.id).map((x) => x.r)
    if (rs.length >= MIN_INDEXABLE) out.push({ url: abs(`${pathOf('youtuber', c.slug || c.id)}/new`), lastModified: latest(rs), changeFrequency: 'daily' })
  }
  // 데이터로 쓴 글(app/blog)
  const posts = getPosts()
  if (posts.length) out.push({ url: abs('/blog'), lastModified: new Date(posts.map((p) => p.updated).sort().pop()!), changeFrequency: 'weekly' })
  for (const p of posts) out.push({ url: abs(`/blog/${p.slug}`), lastModified: new Date(p.updated), changeFrequency: 'monthly' })
  const group = new Map<string, RestaurantWithVideos[]>()
  const add = (path: string, r: RestaurantWithVideos) => {
    const list = group.get(path) || []
    list.push(r)
    group.set(path, list)
  }

  for (const r of restaurants) {
    const slugs = new Set(r.videos.map((v) => channels.find((c) => c.id === v.channel_id)?.slug).filter(Boolean) as string[])
    for (const s of Array.from(slugs)) {
      add(pathOf('youtuber', s), r)
      if (r.region) add(pathOf('youtuber', s, r.region), r)
    }
    if (r.region) add(pathOf('region', r.region), r)
    if (r.region && r.city) add(pathOf('region', r.region, r.city), r)
  }
  for (const [path, rs] of Array.from(group.entries())) {
    if (rs.length >= MIN_INDEXABLE) out.push({ url: abs(path), lastModified: latest(rs), changeFrequency: 'weekly' })
  }
  // 역 페이지: 1km 안 가게가 충분한 역만
  for (const s of STATIONS) {
    const rs = nearStation(s, restaurants).map((x) => x.r)
    if (rs.length >= MIN_INDEXABLE) out.push({ url: abs(pathOf('station', s.slug)), lastModified: latest(rs), changeFrequency: 'weekly' })
  }
  for (const r of restaurants) {
    out.push({ url: abs(`/restaurant/${r.id}`), lastModified: latest([r]), changeFrequency: 'monthly' })
  }
  // 외국어판: 번역된 가게와 그 가게가 있는 지역만
  for (const lang of LANGS) {
    const names = await translatedNames(lang)
    const rs = restaurants.filter((r) => names[r.id])
    if (!rs.length) continue
    out.push({ url: abs(langPath(lang)), lastModified: latest(rs), changeFrequency: 'daily' })
    const byRegion = new Map<string, RestaurantWithVideos[]>()
    for (const r of rs) if (r.region && REGIONS[r.region]) byRegion.set(r.region, [...(byRegion.get(r.region) || []), r])
    for (const [region, list] of Array.from(byRegion.entries())) {
      if (list.length >= MIN_INDEXABLE) out.push({ url: abs(langPath(lang, 'region', REGIONS[region].slug)), lastModified: latest(list), changeFrequency: 'weekly' })
    }
    for (const r of rs) out.push({ url: abs(langPath(lang, 'restaurant', String(r.id))), lastModified: latest([r]), changeFrequency: 'monthly' })
  }
  return out
}
