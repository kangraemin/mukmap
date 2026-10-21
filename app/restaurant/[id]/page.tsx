import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DetailPanel from '@/components/DetailPanel'
import SiteHeader from '@/components/page/SiteHeader'
import { getRestaurant } from '@/lib/data'
import { areaOf, leadVideo, thumbOf, visitorsOf } from '@/lib/format'
import { iGa } from '@/lib/josa'
import { tossHref } from '@/lib/tossLink'
import { breadcrumbJsonLd, jsonLdScript, languagesOf, mapHrefOf, pageMetadata, pathOf, restaurantJsonLd } from '@/lib/seo'
import { DATA_KEY, LANGS, langPath } from '@/lib/i18n'
import LangLinks from '@/components/page/LangLinks'

export const revalidate = 3600

interface Props {
  params: { id: string }
}

async function load(raw: string) {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const r = await getRestaurant(id)
  if (!r) notFound()
  return r
}

/** 번역본이 있는 언어만 외국어 주소를 단다 */
function pathsOf(r: Awaited<ReturnType<typeof load>>) {
  const paths: Record<string, string> = { ko: `/restaurant/${r.id}` }
  for (const l of LANGS) if (r.videos.some((v) => v.i18n?.[DATA_KEY[l]])) paths[l] = langPath(l, 'restaurant', String(r.id))
  return paths
}

function namesOf(r: Awaited<ReturnType<typeof load>>) {
  return visitorsOf(r).map((v) => v.name).join('·')
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load(params.id)
  const lead = leadVideo(r)
  const names = namesOf(r)
  const what = [lead?.menu, lead?.price].filter(Boolean).join(', ')
  return pageMetadata({
    title: `${r.name}, ${names} 방문 (${areaOf(r)} ${r.category}) | 먹맵`,
    description: `${iGa(names)} 다녀간 ${areaOf(r)} ${r.category} ${r.name}. ${what ? `영상에서 먹은 것: ${what}. ` : ''}${lead?.quote ? `"${lead.quote}" ` : ''}주소와 영상 장면 바로가기를 확인하세요.`.slice(0, 170),
    path: `/restaurant/${r.id}`,
    image: lead ? thumbOf(lead) : undefined,
    languages: languagesOf(pathsOf(r)),
  })
}

export default async function RestaurantPage({ params }: Props) {
  const r = await load(params.id)
  const crumbs = [
    ...(r.region ? [{ name: r.region, path: pathOf('region', r.region) }] : []),
    ...(r.region && r.city ? [{ name: r.city, path: pathOf('region', r.region, r.city) }] : []),
    { name: r.name, path: `/restaurant/${r.id}` },
  ]
  const visitors = visitorsOf(r)

  return (
    <>
      <SiteHeader crumbs={crumbs} mapHref={mapHrefOf({ place: r.id })} />
      <main className="mx-auto max-w-2xl sm:px-4 sm:pt-6">
        <DetailPanel
          restaurant={r}
          asPage
          channelHref={(slug) => pathOf('youtuber', slug)}
        />
        <section aria-label="더 보기" className="px-4 pb-[calc(40px+env(safe-area-inset-bottom))] pt-2 sm:px-0">
          <h2 className="text-body font-bold text-ink">이 지역 더 보기</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            <li>
              <a href={tossHref({ place: r.id })} data-testid="open-toss" data-track="toss_open_click" data-track-where="restaurant" data-track-id={r.id} className="inline-flex min-h-[40px] items-center rounded-full border border-line px-3.5 text-body text-ink">
                토스 앱으로 열기
              </a>
            </li>
            {r.region && r.city && (
              <li>
                <a href={pathOf('region', r.region, r.city)} className="inline-flex min-h-[40px] items-center rounded-full border border-line px-3.5 text-body text-ink">
                  {r.region} {r.city} 유튜버 맛집
                </a>
              </li>
            )}
            {r.region && visitors.filter((v) => v.slug).map((v) => (
              <li key={v.id}>
                <a href={pathOf('youtuber', v.slug!, r.region!)} className="inline-flex min-h-[40px] items-center rounded-full border border-line px-3.5 text-body text-ink">
                  {v.name} {r.region} 맛집
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <LangLinks paths={pathsOf(r)} current="ko" />
      {jsonLdScript([
        restaurantJsonLd(r),
        breadcrumbJsonLd([{ name: '먹맵', path: '/' }, ...crumbs]),
      ])}
    </>
  )
}
