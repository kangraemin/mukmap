import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import ListPage from '@/components/page/ListPage'
import { MIN_INDEXABLE, decodeParam, factsOf, getChannelBySlugOrId, restaurantsOf, yearRange } from '@/lib/data'
import { eunNeun, iGa } from '@/lib/josa'
import { mapHrefOf, pageMetadata, pathOf } from '@/lib/seo'

export const revalidate = 3600
// 요청마다 다시 그리면 첫 바이트가 5초 넘게 걸렸다. 한 번 그린 페이지를 1시간 동안 그대로 준다
export const dynamic = 'force-static'

interface Props {
  params: { slug: string }
}

async function load(raw: string) {
  const key = decodeParam(raw)
  const channel = await getChannelBySlugOrId(key)
  if (!channel) notFound()
  // 예전 주소(/youtuber/UC…)는 이름 주소로 옮긴다
  if (channel.slug && key !== channel.slug) permanentRedirect(pathOf('youtuber', channel.slug))
  const restaurants = await restaurantsOf({ channelId: channel.id })
  if (!restaurants.length) notFound()
  return { channel, restaurants, facts: factsOf(restaurants, channel.id), path: pathOf('youtuber', channel.slug || channel.id) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { channel, facts, path } = await load(params.slug)
  const regions = Array.from(new Set((await restaurantsOf({ channelId: channel.id })).map((r) => r.region).filter(Boolean))).slice(0, 3)
  return pageMetadata({
    title: `${channel.name} 맛집 ${facts.count}곳, ${iGa(channel.name)} 다녀간 식당 지도 | 먹맵`,
    description: `${iGa(channel.name)} ${yearRange(facts.firstYear, facts.lastYear)} 영상에서 직접 찾아간 식당 ${facts.count}곳. ${regions.join('·')} 등 지역별로 먹은 메뉴와 가격, 영상 속 한마디를 정리했습니다.`,
    path,
    index: facts.count >= MIN_INDEXABLE,
  })
}

export default async function YoutuberPage({ params }: Props) {
  const { channel, restaurants, facts, path } = await load(params.slug)
  const byRegion = new Map<string, number>()
  for (const r of restaurants) if (r.region) byRegion.set(r.region, (byRegion.get(r.region) || 0) + 1)
  const regions = Array.from(byRegion.entries()).sort((a, b) => b[1] - a[1])
  const slug = channel.slug || channel.id

  const answer = [
    `${eunNeun(channel.name)} ${yearRange(facts.firstYear, facts.lastYear)} 영상에서 식당 ${facts.count}곳을 직접 찾아갔습니다.`,
    regions.length ? `가장 많이 간 지역은 ${regions.slice(0, 3).map(([r, n]) => `${r}(${n}곳)`).join(', ')}입니다.` : '',
    facts.topMenus.length ? `자주 먹은 메뉴는 ${facts.topMenus.join(', ')}입니다.` : '',
  ].filter(Boolean).join(' ')

  const title = `${channel.name} 맛집 ${facts.count}곳`
  return (
    <ListPage
      crumbs={[{ name: channel.name, path }]}
      title={title}
      h1={title}
      description={answer}
      question={`${iGa(channel.name)} 다녀간 맛집은 어디인가요?`}
      answer={answer}
      restaurants={restaurants}
      dateModified={facts.latest}
      mapHref={mapHrefOf({ yt: slug, from: path })}
      facets={['region']}
      base={{ yt: slug }}
      groups={[{
        title: `${channel.name} 지역별 맛집`,
        items: regions.map(([r, n]) => ({ href: pathOf('youtuber', slug, r), label: r, count: n })),
      }]}
    />
  )
}
