import type { Metadata } from 'next'
import { HREFLANG, LANGS } from '@/lib/i18n'
import ReactDOM from 'react-dom'
import HomeExplorer from '@/components/HomeExplorer'
import { getAll, getChannelSummaries, getRegionSummaries } from '@/lib/data'
import { newThisWeek } from '@/lib/related'
import { getPosts } from '@/lib/blog'
import { visitorsOf } from '@/lib/format'
import { SITE_NAME, SITE_URL, faqJsonLd, jsonLdScript, todayLabel } from '@/lib/seo'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const { restaurants } = await getAll()
  const title = '쯔양·히밥·성시경이 다녀간 유튜버 맛집 지도 | 먹맵'
  const description = `쯔양, 히밥, 성시경 먹을텐데, 츄릅켠 등 먹방 유튜버가 영상에서 실제로 방문한 식당 ${restaurants.length}곳을 지도에서 찾고, 먹은 메뉴와 가격, 영상 속 한마디를 확인하세요.`
  return {
    title,
    description,
    alternates: {
      canonical: SITE_URL,
      types: { 'application/rss+xml': `${SITE_URL}/feed.xml` },
      languages: { ko: SITE_URL, ...Object.fromEntries(LANGS.map((l) => [HREFLANG[l], `${SITE_URL}/${l}`])), 'x-default': SITE_URL },
    },
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'ko_KR', title, description, url: SITE_URL },
  }
}

export default async function Home() {
  const [channels, regions, { restaurants }] = await Promise.all([
    getChannelSummaries(),
    getRegionSummaries(),
    getAll(),
  ])
  // 지도 SDK와 핀 목록을 HTML 파싱과 동시에 받기 시작한다
  ReactDOM.preconnect('https://oapi.map.naver.com')
  ReactDOM.preload(`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}`, { as: 'script' })
  ReactDOM.preload('/api/pins', { as: 'fetch', crossOrigin: 'anonymous' })
  const weekly = newThisWeek(restaurants)
  const posts = getPosts()
  const names = channels.slice(0, 4).map((c) => c.name).join(', ')
  const faq = [
    {
      q: '먹맵은 어떤 사이트인가요?',
      a: `먹맵은 먹방 유튜버가 영상에서 실제로 찾아간 식당을 지도에 모은 사이트입니다. ${todayLabel()} 기준 유튜버 ${channels.length}명이 다녀간 식당 ${restaurants.length}곳이 있습니다.`,
    },
    {
      q: '가게 정보는 어디서 가져오나요?',
      a: '유튜브 영상의 자막과 설명란에서 가게 이름, 먹은 메뉴, 가격, 유튜버가 한 말을 뽑고 네이버 지역 검색으로 주소를 확인합니다. 배달이나 포장으로만 먹은 가게, 문을 닫은 가게는 넣지 않습니다.',
    },
  ]

  return (
    <>
      <h1 className="sr-only">유튜버 맛집 지도 먹맵</h1>
      <HomeExplorer channels={channels}>
        {weekly.length > 0 && (
          <section aria-labelledby="weekly" className="mb-8">
            <h2 id="weekly" className="text-title font-bold text-ink">이번 주 새 영상에 나온 곳</h2>
            <ul className="mt-2">
              {weekly.map(({ r, at }, i) => (
                <li key={r.id}>
                  <a
                    href={`/restaurant/${r.id}`}
                    data-track="weekly_click"
                    data-track-id={r.id}
                    data-track-rank={i + 1}
                    className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-body text-ink">{r.name}</span>
                      <span className="block truncate text-meta text-sub">
                        {[visitorsOf(r).map((v) => v.name).join('·'), r.region, r.city].filter(Boolean).join(', ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-meta text-sub">{Number(at.slice(5, 7))}월 {Number(at.slice(8, 10))}일</span>
                  </a>
                </li>
              ))}
            </ul>
            <a href="/this-week" data-track="weekly_click" data-track-id="all" className="mt-3 inline-flex min-h-[40px] items-center rounded-full border border-line px-3.5 text-body text-ink">
              이번 주 새로 뜬 곳 전체 보기
            </a>
          </section>
        )}

        {posts.length > 0 && (
          <p className="mb-8">
            <a href="/blog" data-track="blog_click" className="inline-flex min-h-[40px] items-center rounded-full border border-line px-3.5 text-body text-ink">
              먹맵 블로그: {posts[0].title}
            </a>
          </p>
        )}

        <section aria-labelledby="by-youtuber">
          <h2 id="by-youtuber" className="text-title font-bold text-ink">유튜버별 맛집</h2>
          <ul className="mt-2">
            {channels.map((c) => (
              <li key={c.id}>
                <a
                  href={`/youtuber/${encodeURIComponent(c.slug || c.id)}`}
                  className="flex min-h-[44px] items-center justify-between border-b border-line text-body text-ink"
                >
                  <span>{c.name} 맛집</span>
                  <span className="text-meta text-sub">{c.restaurant_count}곳</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="by-region" className="mt-8">
          <h2 id="by-region" className="text-title font-bold text-ink">지역별 맛집</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {regions.map((r) => (
              <li key={r.region}>
                <a
                  href={`/region/${encodeURIComponent(r.region)}`}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-line px-3.5 text-body text-ink"
                >
                  {r.region}
                  <span className="text-meta text-sub">{r.count}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="about" className="mt-8">
          <h2 id="about" className="text-title font-bold text-ink">먹맵은 어떤 사이트인가요?</h2>
          <p className="mt-2 text-body text-sub">
            {faq[0].a} {names} 같은 유튜버가 무엇을 먹고 얼마를 냈는지, 영상 몇 분쯤에 나오는지까지 적어 두었습니다.
          </p>
          <h3 className="mt-5 text-body font-bold text-ink">{faq[1].q}</h3>
          <p className="mt-1 text-body text-sub">{faq[1].a}</p>
        </section>

        <p className="mt-8 border-t border-line pt-4 text-meta text-sub">
          오구리웍스 다른 서비스:{' '}
          {[
            ['', '생활 계산기'],
            ['yeonbong/', '연봉 실수령액'],
            ['toejikgeum/', '퇴직금 계산기'],
            ['junggae/', '부동산 중개수수료'],
            ['hyuil/2027/', '2027 공휴일'],
          ].map(([path, name], i) => (
            <span key={path}>
              {i > 0 && ', '}
              {/* 계산기 쪽 GA에서 먹맵 유입을 따로 셀 수 있게 utm을 붙인다 */}
              <a href={`https://kangraemin.github.io/oneul-kkum/${path}?utm_source=mukmap&utm_medium=referral`} className="text-ink underline">{name}</a>
            </span>
          ))}
        </p>
      </HomeExplorer>
      {jsonLdScript(faqJsonLd(faq))}
    </>
  )
}
