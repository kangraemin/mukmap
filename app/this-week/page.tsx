import type { Metadata } from 'next'
import ListPage from '@/components/page/ListPage'
import { MIN_INDEXABLE, getAll } from '@/lib/data'
import { visitorsOf } from '@/lib/format'
import { iGa } from '@/lib/josa'
import { RECENT_DAYS, newThisWeek, recentOf } from '@/lib/related'
import { pageMetadata, pathOf } from '@/lib/seo'

// 매주 다시 볼 거리: 최근 7일 새 영상에 나온 가게. SNS 주간편이 이 주소를 건다
export const revalidate = 3600

const PATH = '/this-week'

async function load() {
  const { channels, restaurants } = await getAll()
  const week = newThisWeek(restaurants, Date.now(), 60)
  const names = Array.from(new Set(week.flatMap(({ r }) => visitorsOf(r).map((v) => v.name))))
  // 유튜버별 최근 30일 페이지로 잇는다(가게가 많은 순)
  const recent = channels
    .map((c) => ({ c, n: recentOf(restaurants, c.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
  return { week, names, recent }
}

export async function generateMetadata(): Promise<Metadata> {
  const { week, names } = await load()
  return pageMetadata({
    title: `이번 주 새로 뜬 유튜버 맛집 ${week.length}곳 | 먹맵`,
    description: `최근 7일 동안 ${iGa(names.slice(0, 3).join('·') || '먹방 유튜버')} 새 영상에서 찾아간 식당 ${week.length}곳입니다. 먹은 메뉴와 가격, 영상 장면을 확인하세요.`,
    path: PATH,
    index: week.length >= MIN_INDEXABLE,
  })
}

export default async function ThisWeekPage() {
  const { week, names, recent } = await load()
  const title = `이번 주 새로 뜬 맛집 ${week.length}곳`
  const answer = week.length
    ? `최근 7일 동안 ${iGa(names.slice(0, 5).join('·'))} 새 영상에서 식당 ${week.length}곳을 찾아갔습니다. 새 영상이 올라온 순서대로 모았습니다.`
    : '최근 7일 동안 새 영상에 나온 식당이 아직 없습니다.'
  const notes = Object.fromEntries(week.map(({ r, at }) => [r.id, `${Number(at.slice(5, 7))}월 ${Number(at.slice(8, 10))}일 새 영상`]))
  return (
    <ListPage
      crumbs={[{ name: '이번 주 새로 뜬 곳', path: PATH }]}
      title={title}
      h1={title}
      description={answer}
      question="이번 주 유튜버들이 새로 간 맛집은?"
      answer={answer}
      restaurants={week.map(({ r }) => r)}
      dateModified={week[0]?.at || null}
      facets={['channel']}
      notes={notes}
      groups={[{
        title: `유튜버별 최근 ${RECENT_DAYS}일 새 맛집`,
        items: recent.map(({ c, n }) => ({ href: `${pathOf('youtuber', c.slug || c.id)}/new`, label: c.name, count: n })),
      }]}
    />
  )
}
