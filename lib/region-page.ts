// 지역 페이지(/region/광주, /region/광주/동구) 공용 계산
import type { RestaurantWithVideos } from '@/lib/types'
import { factsOf, yearRange } from '@/lib/data'
import { visitorsOf } from '@/lib/format'

export function regionAnswer(place: string, rs: RestaurantWithVideos[]) {
  const facts = factsOf(rs)
  const counts = new Map<string, { name: string; slug: string | null | undefined; n: number }>()
  for (const r of rs) {
    for (const f of visitorsOf(r)) {
      const c = counts.get(f.id) || { name: f.name, slug: f.slug, n: 0 }
      c.n += 1
      counts.set(f.id, c)
    }
  }
  const youtubers = Array.from(counts.values()).sort((a, b) => b.n - a.n)
  const multi = rs.filter((r) => visitorsOf(r).length > 1).length
  const answer = [
    `${place}에서 유튜버 ${youtubers.length}명이 ${yearRange(facts.firstYear, facts.lastYear)} 영상으로 찾아간 식당은 ${facts.count}곳입니다.`,
    youtubers.length ? `${youtubers.slice(0, 3).map((y) => `${y.name} ${y.n}곳`).join(', ')} 순으로 많습니다.` : '',
    multi ? `두 명 이상이 다녀간 집은 ${multi}곳입니다.` : '',
    facts.topMenus.length ? `많이 먹은 메뉴는 ${facts.topMenus.join(', ')}입니다.` : '',
  ].filter(Boolean).join(' ')
  return { facts, youtubers, answer }
}
