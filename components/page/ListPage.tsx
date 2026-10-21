// 유튜버·지역 목록 페이지 공용 틀. 서버에서만 그린다.
import type { RestaurantWithVideos } from '@/lib/types'
import FilterList, { type ChannelInfo, type Facet } from './FilterList'
import { breadcrumbJsonLd, collectionJsonLd, faqJsonLd, jsonLdScript } from '@/lib/seo'
import SiteHeader, { type Crumb } from './SiteHeader'

export interface LinkGroup {
  title: string
  items: { href: string; label: string; count?: number }[]
}

interface ListPageProps {
  crumbs: Crumb[]
  title: string
  h1: string
  description: string
  /** 질문형 소제목과 바로 아래 직답. AI 검색이 이 두 줄을 인용한다 */
  question: string
  answer: string
  restaurants: RestaurantWithVideos[]
  dateModified: string | null
  groups?: LinkGroup[]
  /** 같은 조건으로 여는 지도 주소 (/?yt=..&region=..) */
  mapHref: string
  /** 조건을 넓히는 링크. 필터 줄이 아니라 목록 끝에 둔다 */
  more?: { href: string; label: string }
  /** 그 자리에서 거르는 칩 줄 (구·시, 유튜버 등) */
  facets?: Facet[]
  /** 이 페이지가 이미 걸고 있는 조건. 지도 버튼 주소에 들어간다 */
  base?: { yt?: string; region?: string; city?: string; at?: string }
  /** 카드 아래 한 줄(역에서 걸어서 몇 분) */
  notes?: Record<number, string>
}

/** 카드에 쓰는 칸만 남긴다. 목록 전체가 브라우저로 넘어가므로 크기를 줄인다 */
function slim(r: RestaurantWithVideos): RestaurantWithVideos {
  return {
    id: r.id, name: r.name, category: r.category, address: r.address, region: r.region, city: r.city, lat: r.lat, lng: r.lng,
    videos: r.videos.map((v) => ({
      id: v.id, video_id: v.video_id, channel_id: v.channel_id, menu: v.menu, price: v.price,
      // 대표 장면 고르기(leadVideo)에 인용이 있는지만 쓴다
      quote: v.quote ? '1' : null,
    })),
  } as unknown as RestaurantWithVideos
}

/** 직답의 첫 문장. 화면엔 이것만, 전체는 FAQ 구조화 데이터로 남긴다 */
function firstSentence(text: string): string {
  const m = text.match(/^.+?다\./)
  return m ? m[0] : text
}

/** 유튜버 이름·얼굴은 영상마다 반복되니 한 번만 넘긴다 */
function channelsOf(rs: RestaurantWithVideos[]): ChannelInfo {
  const out: ChannelInfo = {}
  for (const r of rs) for (const v of r.videos) out[v.channel_id] ||= { name: v.channel_name, thumbnail: v.channel_thumbnail, slug: v.channel_slug }
  return out
}

export default function ListPage({
  crumbs, title, h1, description, question, answer, restaurants, dateModified, groups = [], mapHref, more, facets = [], base = {}, notes,
}: ListPageProps) {
  const path = crumbs[crumbs.length - 1].path
  const links = groups.filter((g) => g.items.length > 0)

  return (
    <>
      <SiteHeader crumbs={crumbs} mapHref={mapHref} />
      <main className="mx-auto max-w-3xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))]">
        <h1 className="pt-6 text-display font-bold text-ink">{h1}</h1>
        <p className="mt-1.5 max-w-[60ch] text-body text-sub">{firstSentence(answer)}</p>

        <FilterList restaurants={restaurants.map(slim)} channels={channelsOf(restaurants)} facets={facets} base={base} notes={notes} />

        {more && (
          <p className="mt-8">
            <a href={more.href} className="inline-flex min-h-[44px] items-center text-body font-bold text-ink underline-offset-4 hover:underline">
              {more.label} ›
            </a>
          </p>
        )}

        {links.map((g) => (
          <nav key={g.title} aria-label={g.title} className="mt-10">
            <h2 className="text-lead font-bold text-ink">{g.title}</h2>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body">
              {g.items.map((it) => (
                <li key={it.href}>
                  <a href={it.href} className="inline-flex min-h-[36px] items-center text-sub underline-offset-2 hover:underline">
                    {it.label}{it.count ? ` ${it.count}` : ''}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <p className="mt-10 border-t border-line pt-4 text-meta text-sub">
          가게 이름·메뉴·가격·인용은 유튜브 영상 자막과 설명란에서 자동으로 뽑았습니다. 각 가게의 원본 영상 링크에서 확인할 수 있습니다.
        </p>
      </main>
      {jsonLdScript([
        collectionJsonLd({ title, description, path, restaurants, dateModified }),
        breadcrumbJsonLd([{ name: '먹맵', path: '/' }, ...crumbs]),
        faqJsonLd([{ q: question, a: answer }]),
      ])}
    </>
  )
}
