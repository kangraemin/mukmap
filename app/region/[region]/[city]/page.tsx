import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ListPage from '@/components/page/ListPage'
import { MIN_INDEXABLE, decodeParam, restaurantsOf } from '@/lib/data'
import { regionAnswer } from '@/lib/region-page'
import { abs, mapHrefOf, pageMetadata, pathOf } from '@/lib/seo'

export const revalidate = 3600

interface Props {
  params: { region: string; city: string }
}

async function load(p: Props['params']) {
  const region = decodeParam(p.region)
  const city = decodeParam(p.city)
  const restaurants = await restaurantsOf({ region, city })
  if (!restaurants.length) notFound()
  const place = `${region} ${city}`
  return { region, city, place, restaurants, ...regionAnswer(place, restaurants), path: pathOf('region', region, city) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, place, facts, youtubers, path } = await load(params)
  const names = youtubers.slice(0, 3).map((y) => y.name).join('·')
  return pageMetadata({
    title: `${place} 유튜버 맛집 ${facts.count}곳 | 먹맵`,
    description: `${place}에서 ${names} 등 먹방 유튜버가 영상으로 찾아간 식당 ${facts.count}곳의 메뉴와 가격, 영상 속 한마디를 모았습니다.`,
    path,
    index: facts.count >= MIN_INDEXABLE,
    // 이 경로엔 og 이미지 파일이 없어 시·도 페이지 것을 같이 쓴다
    image: abs(`${pathOf('region', region)}/opengraph-image`),
  })
}

export default async function CityPage({ params }: Props) {
  const { region, city, place, restaurants, facts, youtubers, answer, path } = await load(params)
  const title = `${place} 유튜버 맛집 ${facts.count}곳`
  return (
    <ListPage
      crumbs={[{ name: region, path: pathOf('region', region) }, { name: city, path }]}
      title={title}
      h1={title}
      description={answer}
      question={`${place}에서 유튜버가 간 맛집은?`}
      answer={answer}
      restaurants={restaurants}
      dateModified={facts.latest}
      mapHref={mapHrefOf({ region })}
      limit={120}
      groups={[{
        title: `유튜버별 ${region} 맛집`,
        items: youtubers.filter((y) => y.slug).map((y) => ({ href: pathOf('youtuber', y.slug!, region), label: y.name, count: y.n })),
      }]}
    />
  )
}
