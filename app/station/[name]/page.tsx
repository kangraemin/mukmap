import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ListPage from '@/components/page/ListPage'
import { MIN_INDEXABLE, decodeParam, getAll } from '@/lib/data'
import { regionAnswer } from '@/lib/region-page'
import { iGa } from '@/lib/josa'
import { pageMetadata, pathOf } from '@/lib/seo'
import { STATION_KM, nearStation, stationBySlug } from '@/lib/stations'

export const revalidate = 3600
// 지역 페이지와 같이 한 번 그린 페이지를 1시간 동안 그대로 준다
export const dynamic = 'force-static'

interface Props {
  params: { name: string }
}

async function load(p: Props['params']) {
  const station = stationBySlug(decodeParam(p.name))
  if (!station) notFound()
  const { restaurants } = await getAll()
  const near = nearStation(station, restaurants)
  if (!near.length) notFound()
  const label = `${station.name}역${station.hint ? `(${station.hint})` : ''}`
  const rs = near.map((x) => x.r)
  return { station, label, near, restaurants: rs, ...regionAnswer(`${label} ${STATION_KM}km 안`, rs), path: pathOf('station', station.slug) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { label, facts, youtubers, path } = await load(params)
  const names = youtubers.slice(0, 3).map((y) => y.name).join('·')
  return pageMetadata({
    title: `${label} 맛집 ${facts.count}곳, ${iGa(names)} 다녀간 곳 | 먹맵`,
    description: `${label}에서 걸어서 15분 안, 먹방 유튜버가 직접 찾아간 식당 ${facts.count}곳을 가까운 순으로 모았습니다. 먹은 메뉴와 가격, 영상 장면을 확인하세요.`,
    path,
    index: facts.count >= MIN_INDEXABLE,
  })
}

export default async function StationPage({ params }: Props) {
  const { station, label, near, restaurants, facts, youtubers, answer, path } = await load(params)
  const title = `${label} 맛집 ${facts.count}곳`
  const notes = Object.fromEntries(near.map(({ r, min }) => [r.id, `${label}에서 걸어서 ${min}분`]))
  return (
    <ListPage
      crumbs={[{ name: label, path }]}
      title={title}
      h1={title}
      description={answer}
      question={`${label} 근처 유튜버 맛집은?`}
      answer={answer}
      restaurants={restaurants}
      dateModified={facts.latest}
      facets={['channel']}
      base={{ at: `${station.lat},${station.lng}` }}
      notes={notes}
      groups={[
        {
          title: `유튜버별 ${label} 근처 맛집`,
          items: youtubers.filter((y) => y.slug).map((y) => ({ href: pathOf('youtuber', y.slug!), label: y.name, count: y.n })),
        },
      ]}
    />
  )
}
