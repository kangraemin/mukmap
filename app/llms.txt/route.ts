import { MIN_INDEXABLE, getChannelSummaries, getRegionSummaries, getAll } from '@/lib/data'
import { RECENT_DAYS, newThisWeek, recentOf } from '@/lib/related'
import { abs, pathOf, todayLabel } from '@/lib/seo'
import { getPosts } from '@/lib/blog'

export const revalidate = 3600

export async function GET() {
  const [channels, regions, { restaurants }] = await Promise.all([getChannelSummaries(), getRegionSummaries(), getAll()])
  const body = [
    '# 먹맵 (mukmap.kr)',
    '',
    `> 먹방 유튜버가 영상에서 실제로 찾아간 식당을 지도에 모은 사이트입니다. ${todayLabel()} 기준 유튜버 ${channels.length}명, 식당 ${restaurants.length}곳.`,
    '',
    '- 데이터 출처: 각 유튜버의 유튜브 영상 자막과 설명란. 가게 이름·먹은 메뉴·가격·유튜버 발언을 자동으로 뽑고 네이버 지역 검색으로 주소를 확인합니다.',
    '- 넣지 않는 것: 배달·포장으로만 먹은 가게, 문을 닫은 가게.',
    '- 가게 페이지마다 원본 영상과 해당 장면(초 단위) 링크가 있습니다.',
    '',
    '## 유튜버별 맛집',
    ...channels.map((c) => `- [${c.name} 맛집 ${c.restaurant_count}곳](${abs(pathOf('youtuber', c.slug || c.id))})`),
    '',
    '## 최근 새로 뜬 맛집 (매시간 갱신)',
    `- [이번 주 새로 뜬 맛집 ${newThisWeek(restaurants, Date.now(), 60).length}곳](${abs('/this-week')})`,
    ...channels.flatMap((c) => {
      const n = recentOf(restaurants, c.id).length
      return n >= MIN_INDEXABLE ? [`- [${c.name} 최근 ${RECENT_DAYS}일 새 맛집 ${n}곳](${abs(`${pathOf('youtuber', c.slug || c.id)}/new`)})`] : []
    }),
    '',
    '## 지역별 맛집',
    ...regions.map((r) => `- [${r.region} 유튜버 맛집 ${r.count}곳](${abs(pathOf('region', r.region))})`),
    '',
    ...(getPosts().length ? ['## 먹맵 블로그 (데이터로 쓴 글)', ...getPosts().map((p) => `- [${p.title}](${abs(`/blog/${p.slug}`)}): ${p.description}`), ''] : []),
    '## 그 밖에',
    `- [사이트맵](${abs('/sitemap.xml')})`,
    `- [새로 추가된 가게 RSS](${abs('/feed.xml')})`,
    '',
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
