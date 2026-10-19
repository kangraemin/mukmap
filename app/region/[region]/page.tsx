import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ListPage from '@/components/page/ListPage'
import { MIN_INDEXABLE, decodeParam, restaurantsOf } from '@/lib/data'
import { regionAnswer } from '@/lib/region-page'
import { iGa } from '@/lib/josa'
import { pageMetadata, pathOf } from '@/lib/seo'

export const revalidate = 3600

interface Props {
  params: { region: string }
}

async function load(p: Props['params']) {
  const region = decodeParam(p.region)
  const restaurants = await restaurantsOf({ region })
  if (!restaurants.length) notFound()
  return { region, restaurants, ...regionAnswer(region, restaurants), path: pathOf('region', region) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, facts, youtubers, path } = await load(params)
  const names = youtubers.slice(0, 3).map((y) => y.name).join('·')
  return pageMetadata({
    title: `${region} 유튜버 맛집 ${facts.count}곳, ${iGa(names)} 다녀간 곳 | 먹맵`,
    description: `${region}에서 ${names} 등 먹방 유튜버가 직접 찾아간 식당 ${facts.count}곳. 구·시별로 먹은 메뉴와 가격, 영상 속 한마디를 확인하세요.`,
    path,
    index: facts.count >= MIN_INDEXABLE,
  })
}

export default async function RegionPage({ params }: Props) {
  const { region, restaurants, facts, youtubers, answer, path } = await load(params)
  const byCity = new Map<string, number>()
  for (const r of restaurants) if (r.city) byCity.set(r.city, (byCity.get(r.city) || 0) + 1)

  const title = `${region} 유튜버 맛집 ${facts.count}곳`
  return (
    <ListPage
      crumbs={[{ name: region, path }]}
      title={title}
      h1={title}
      description={answer}
      question={`${region}에서 유튜버가 간 맛집은?`}
      answer={answer}
      restaurants={restaurants}
      dateModified={facts.latest}
      groups={[
        {
          title: `${region} 구·시별`,
          items: Array.from(byCity.entries()).sort((a, b) => b[1] - a[1])
            .map(([c, n]) => ({ href: pathOf('region', region, c), label: c, count: n })),
        },
        {
          title: `유튜버별 ${region} 맛집`,
          items: youtubers.filter((y) => y.slug).map((y) => ({ href: pathOf('youtuber', y.slug!, region), label: y.name, count: y.n })),
        },
      ]}
    />
  )
}
