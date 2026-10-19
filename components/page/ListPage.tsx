// 유튜버·지역 목록 페이지 공용 틀. 서버에서만 그린다.
import type { RestaurantWithVideos } from '@/lib/types'
import { SceneCard } from '@/components/RestaurantCard'
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
  /** 처음에 보여줄 카드 수. 나머지는 '더 보기'로 펼친다 */
  limit?: number
}

/** 직답의 첫 문장. 화면엔 이것만, 전체는 FAQ 구조화 데이터로 남긴다 */
function firstSentence(text: string): string {
  const m = text.match(/^.+?다\./)
  return m ? m[0] : text
}

export default function ListPage({
  crumbs, title, h1, description, question, answer, restaurants, dateModified, groups = [], mapHref, more, limit = 60,
}: ListPageProps) {
  const path = crumbs[crumbs.length - 1].path
  const shown = restaurants.slice(0, limit)
  const rest = restaurants.slice(limit)
  const chips = groups.filter((g) => g.items.length > 0)

  return (
    <>
      <SiteHeader crumbs={crumbs} mapHref={mapHref} />
      <main className="mx-auto max-w-3xl px-4 pb-[calc(48px+env(safe-area-inset-bottom))]">
        <h1 className="pt-6 text-display font-bold text-ink">{h1}</h1>
        <p className="mt-1.5 max-w-[60ch] text-body text-sub">{firstSentence(answer)}</p>

        {chips.length > 0 && (
          <nav aria-label="좁혀 보기" className="mt-4">
            <ul className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
              {chips.map((g, gi) => [
                gi > 0 && <li key={`sep-${g.title}`} aria-hidden="true" className="mx-1 h-5 w-px flex-shrink-0 bg-line" />,
                ...g.items.map((it) => (
                  <li key={it.href} className="flex-shrink-0">
                    <a
                      href={it.href}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-line px-3.5 text-body text-ink"
                    >
                      {it.label}
                    </a>
                  </li>
                )),
              ])}
            </ul>
          </nav>
        )}

        <a
          href={mapHref}
          className="mt-4 flex min-h-[48px] items-center gap-2 border-y border-line text-body text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0 text-sub" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span className="flex-1">{restaurants.length}곳을 지도에서 위치로 보기</span>
          <span aria-hidden="true" className="text-sub">›</span>
        </a>

        <ol className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2">
          {shown.map((r) => (
            <li key={r.id}>
              <SceneCard restaurant={r} href={`/restaurant/${r.id}`} />
            </li>
          ))}
        </ol>
        {rest.length > 0 && (
          <details className="group mt-8">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-center rounded-full border border-line text-body text-ink group-open:hidden">
              나머지 {rest.length}곳 더 보기
            </summary>
            <ol className="grid gap-x-5 gap-y-8 sm:grid-cols-2">
              {rest.map((r) => (
                <li key={r.id}>
                  <SceneCard restaurant={r} href={`/restaurant/${r.id}`} />
                </li>
              ))}
            </ol>
          </details>
        )}

        {more && (
          <p className="mt-8">
            <a href={more.href} className="inline-flex min-h-[44px] items-center text-body font-bold text-ink underline-offset-4 hover:underline">
              {more.label} ›
            </a>
          </p>
        )}

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
