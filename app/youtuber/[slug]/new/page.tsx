import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ListPage from '@/components/page/ListPage'
import { MIN_INDEXABLE, decodeParam, getChannelBySlugOrId, restaurantsOf } from '@/lib/data'
import { eunNeun, iGa } from '@/lib/josa'
import { RECENT_DAYS, recentOf } from '@/lib/related'
import { pageMetadata, pathOf, todayLabel } from '@/lib/seo'

// 최신 정보 질문("쯔양 최근 간 맛집")에 AI 검색이 출처로 걸 수 있게 날짜가 박힌 페이지를 둔다
export const revalidate = 3600
export const dynamic = 'force-static'

interface Props {
  params: { slug: string }
}

const md = (at: string) => `${Number(at.slice(5, 7))}월 ${Number(at.slice(8, 10))}일`

async function load(raw: string) {
  const channel = await getChannelBySlugOrId(decodeParam(raw))
  if (!channel) notFound()
  const slug = channel.slug || channel.id
  const recent = recentOf(await restaurantsOf({ channelId: channel.id }), channel.id)
  return { channel, recent, slug, path: `${pathOf('youtuber', slug)}/new` }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { channel, recent, path } = await load(params.slug)
  const regions = Array.from(new Set(recent.map(({ r }) => r.region).filter(Boolean))).slice(0, 3)
  return pageMetadata({
    title: `${channel.name} 최근 맛집 ${recent.length}곳, 최근 ${RECENT_DAYS}일 새 영상 | 먹맵`,
    description: `${todayLabel()} 기준 최근 ${RECENT_DAYS}일 동안 ${iGa(channel.name)} 새 영상에서 찾아간 식당 ${recent.length}곳${regions.length ? `(${regions.join('·')})` : ''}. 먹은 메뉴와 가격, 영상 장면을 확인하세요.`,
    path,
    index: recent.length >= MIN_INDEXABLE,
  })
}

export default async function YoutuberNewPage({ params }: Props) {
  const { channel, recent, slug, path } = await load(params.slug)
  const title = `${channel.name} 최근 ${RECENT_DAYS}일 새 맛집 ${recent.length}곳`
  const answer = recent.length
    ? `${todayLabel()} 기준 최근 ${RECENT_DAYS}일 동안 ${eunNeun(channel.name)} 새 영상에서 식당 ${recent.length}곳을 찾아갔습니다. 가장 최근은 ${md(recent[0].at)} 영상의 ${recent[0].r.name}입니다.`
    : `${todayLabel()} 기준 최근 ${RECENT_DAYS}일 동안 ${channel.name} 새 영상에 나온 식당이 아직 없습니다.`
  return (
    <ListPage
      crumbs={[{ name: channel.name, path: pathOf('youtuber', slug) }, { name: `최근 ${RECENT_DAYS}일`, path }]}
      title={title}
      h1={title}
      description={answer}
      question={`${iGa(channel.name)} 최근에 간 맛집은?`}
      answer={answer}
      restaurants={recent.map(({ r }) => r)}
      dateModified={recent[0]?.at || null}
      base={{ yt: slug }}
      notes={Object.fromEntries(recent.map(({ r, at }) => [r.id, `${md(at)} 영상`]))}
      more={{ href: pathOf('youtuber', slug), label: `${channel.name} 맛집 전체 보기` }}
    />
  )
}
