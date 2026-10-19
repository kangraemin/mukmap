import type { MetadataRoute } from 'next'
import { MIN_INDEXABLE, getAll } from '@/lib/data'
import { abs, pathOf } from '@/lib/seo'
import type { RestaurantWithVideos } from '@/lib/types'

export const revalidate = 3600

// 페이지마다 그 안의 가게 중 가장 최근 영상 날짜를 lastmod로 쓴다
function latest(rs: RestaurantWithVideos[]) {
  const d = rs.flatMap((r) => r.videos.map((v) => v.published_at || '')).sort().pop()
  return d ? new Date(d) : undefined
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { channels, restaurants } = await getAll()
  const out: MetadataRoute.Sitemap = [{ url: abs('/'), lastModified: latest(restaurants), changeFrequency: 'daily' }]
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
  for (const r of restaurants) {
    out.push({ url: abs(`/restaurant/${r.id}`), lastModified: latest([r]), changeFrequency: 'monthly' })
  }
  return out
}
