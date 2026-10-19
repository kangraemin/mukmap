import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ListPage from '@/components/page/ListPage'
import { MIN_INDEXABLE, decodeParam, factsOf, getChannelBySlugOrId, restaurantsOf, yearRange } from '@/lib/data'
import { eunNeun, iGa } from '@/lib/josa'
import { abs, pageMetadata, pathOf } from '@/lib/seo'

export const revalidate = 3600

interface Props {
  params: { slug: string; region: string }
}

async function load(p: Props['params']) {
  const channel = await getChannelBySlugOrId(decodeParam(p.slug))
  const region = decodeParam(p.region)
  if (!channel) notFound()
  const restaurants = await restaurantsOf({ channelId: channel.id, region })
  if (!restaurants.length) notFound()
  const slug = channel.slug || channel.id
  return { channel, region, slug, restaurants, facts: factsOf(restaurants, channel.id), path: pathOf('youtuber', slug, region) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { channel, region, slug, facts, path } = await load(params)
  return pageMetadata({
    title: `${channel.name} ${region} 맛집 ${facts.count}곳 | 먹맵`,
    description: `${iGa(channel.name)} ${region}에서 영상으로 찾아간 식당 ${facts.count}곳을 모았습니다. 먹은 메뉴와 가격, 영상 속 한마디, 해당 장면 바로가기를 확인하세요.`,
    path,
    index: facts.count >= MIN_INDEXABLE,
    // 이 경로엔 og 이미지 파일이 없어 유튜버 페이지 것을 같이 쓴다
    image: abs(`${pathOf('youtuber', slug)}/opengraph-image`),
  })
}

export default async function YoutuberRegionPage({ params }: Props) {
  const { channel, region, slug, restaurants, facts, path } = await load(params)
  const byCity = new Map<string, number>()
  for (const r of restaurants) if (r.city) byCity.set(r.city, (byCity.get(r.city) || 0) + 1)
  const cities = Array.from(byCity.entries()).sort((a, b) => b[1] - a[1])

  const answer = [
    `${eunNeun(channel.name)} ${yearRange(facts.firstYear, facts.lastYear)} ${region}에서 식당 ${facts.count}곳을 영상에 담았습니다.`,
    cities.length > 1 ? `${cities.slice(0, 3).map(([c, n]) => `${c} ${n}곳`).join(', ')} 순으로 많습니다.` : '',
    facts.topMenus.length ? `많이 먹은 메뉴는 ${facts.topMenus.join(', ')}입니다.` : '',
  ].filter(Boolean).join(' ')

  const title = `${channel.name} ${region} 맛집 ${facts.count}곳`
  return (
    <ListPage
      crumbs={[{ name: channel.name, path: pathOf('youtuber', slug) }, { name: region, path }]}
      title={title}
      h1={title}
      description={answer}
      question={`${iGa(channel.name)} ${region}에서 간 맛집은?`}
      answer={answer}
      restaurants={restaurants}
      dateModified={facts.latest}
      limit={120}
      groups={[{
        title: `${region} 다른 유튜버 맛집`,
        items: [{ href: pathOf('region', region), label: `${region} 전체`, count: (await restaurantsOf({ region })).length }],
      }]}
    />
  )
}
