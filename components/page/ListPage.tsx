// 유튜버·지역 목록 페이지 공용 틀. 서버에서만 그린다.
import type { RestaurantWithVideos } from '@/lib/types'
import { SceneCard } from '@/components/RestaurantCard'
import { breadcrumbJsonLd, collectionJsonLd, faqJsonLd, jsonLdScript, todayLabel } from '@/lib/seo'
import SiteHeader, { type Crumb } from './SiteHeader'

export interface LinkGroup {
  title: string
  items: { href: string; label: string; count: number }[]
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
  /** 카드를 몇 개까지 보여줄지. 넘는 건 아래 묶음 링크로 넘긴다 */
  limit?: number
}

export default function ListPage({
  crumbs, title, h1, description, question, answer, restaurants, dateModified, groups = [], limit = 60,
}: ListPageProps) {
  const path = crumbs[crumbs.length - 1].path
  const shown = restaurants.slice(0, limit)

  return (
    <>
      <SiteHeader crumbs={crumbs} />
      <main className="mx-auto max-w-3xl px-4 pb-[calc(48px+env(safe-area-inset-bottom))]">
        <h1 className="pt-6 text-display font-bold text-ink">{h1}</h1>

        <section aria-labelledby="answer" className="mt-4">
          <h2 id="answer" className="text-lead font-bold text-ink">{question}</h2>
          <p className="mt-1.5 max-w-[60ch] text-body text-sub">{answer}</p>
          <p className="mt-2 text-meta text-sub">{todayLabel()} 기준</p>
        </section>

        {groups.map((g) => g.items.length > 0 && (
          <section key={g.title} aria-label={g.title} className="mt-6">
            <h2 className="text-body font-bold text-ink">{g.title}</h2>
            <ul className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
              {g.items.map((it) => (
                <li key={it.href} className="flex-shrink-0">
                  <a
                    href={it.href}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-line px-3.5 text-body text-ink"
                  >
                    {it.label}
                    <span className="text-meta text-sub">{it.count}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <ol className="mt-8 grid gap-x-5 gap-y-8 sm:grid-cols-2">
          {shown.map((r) => (
            <li key={r.id}>
              <SceneCard restaurant={r} href={`/restaurant/${r.id}`} />
            </li>
          ))}
        </ol>
        {restaurants.length > shown.length && (
          <p className="mt-8 text-body text-sub">
            최근 영상 순으로 {shown.length}곳만 보여드렸어요. 나머지 {restaurants.length - shown.length}곳은 위의 지역 묶음에서 볼 수 있어요.
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
