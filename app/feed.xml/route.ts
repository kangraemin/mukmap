import { getAll } from '@/lib/data'
import { areaOf, leadVideo, visitorsOf } from '@/lib/format'
import { abs } from '@/lib/seo'

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
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>먹맵 새로 추가된 유튜버 맛집</title><link>${abs('/')}</link><description>먹방 유튜버가 다녀간 식당 중 먹맵에 새로 추가된 곳</description><language>ko</language>${items.join('')}</channel></rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
