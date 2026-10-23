import { getAll } from '@/lib/data'
import { areaOf, leadVideo, visitorsOf } from '@/lib/format'
import { abs } from '@/lib/seo'
import { getPosts } from '@/lib/blog'

export const revalidate = 3600

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!))

// 새로 들어온 가게 50곳. 네이버 서치어드바이저 RSS 제출용
export async function GET() {
  const { restaurants } = await getAll()
  const recent = [...restaurants].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50)
  const items = recent.map((r) => {
    const lead = leadVideo(r)
    const names = visitorsOf(r).map((v) => v.name).join(', ')
    const desc = [`${names} 방문`, areaOf(r), r.category, lead?.menu, lead?.quote && `"${lead.quote}"`].filter(Boolean).join(' / ')
    const url = abs(`/restaurant/${r.id}`)
    return `<item><title>${esc(`${r.name} (${areaOf(r)})`)}</title><link>${url}</link><guid>${url}</guid><pubDate>${new Date(r.created_at).toUTCString()}</pubDate><description>${esc(desc)}</description></item>`
  })
  // 블로그 글도 같은 피드에 넣는다(네이버 RSS 제출이 하나라서)
  const posts = getPosts().map((p) => {
    const url = abs(`/blog/${p.slug}`)
    return `<item><title>${esc(p.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${new Date(`${p.date}T09:00:00+09:00`).toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`
  })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>먹맵 새로 추가된 유튜버 맛집</title><link>${abs('/')}</link><description>먹방 유튜버가 다녀간 식당 중 먹맵에 새로 추가된 곳</description><language>ko</language>${posts.join('')}${items.join('')}</channel></rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
