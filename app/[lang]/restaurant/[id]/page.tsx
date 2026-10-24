import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DetailPanel from '@/components/DetailPanel'
import LangLinks from '@/components/page/LangLinks'
import SiteHeader from '@/components/page/SiteHeader'
import { getRestaurant, localize } from '@/lib/data'
import { leadVideo, thumbOf, visitorsOf } from '@/lib/format'
import { DATA_KEY, LABELS, LANGS, OG_LOCALE, PAGE, REGIONS, isLang, langPath, type Lang, NAV_LABEL } from '@/lib/i18n'
import { breadcrumbJsonLd, jsonLdScript, languagesOf, mapHrefOf, pageMetadata, restaurantJsonLd } from '@/lib/seo'

export const revalidate = 3600

interface Props {
  params: { lang: string; id: string }
}

async function load(p: Props['params']) {
  const id = Number(p.id)
  if (!isLang(p.lang) || !Number.isInteger(id) || id <= 0) notFound()
  const raw = await getRestaurant(id)
  if (!raw) notFound()
  // 번역 전이어도 공유 링크·검색으로 들어온 외국인이 404를 보지 않게 로마자 이름으로 연다.
  // 다만 내용이 한국어판보다 얇으니 번역될 때까지 색인하지 않고 hreflang에도 넣지 않는다
  const translated = !!localize(raw, p.lang)
  const r = localize(raw, p.lang, true)!
  const paths: Record<string, string> = { ko: `/restaurant/${id}` }
  for (const l of LANGS) if (raw.videos.some((v) => v.i18n?.[DATA_KEY[l]])) paths[l] = langPath(l, 'restaurant', String(id))
  const self = langPath(p.lang, 'restaurant', String(id))
  return { lang: p.lang, r, paths: translated ? paths : { ...paths, [p.lang]: self }, translated }
}

const area = (r: { region: string | null; city: string | null }) => [r.region, r.city].filter(Boolean).join(' ')

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, r, paths, translated } = await load(params)
  const t = PAGE[lang]
  const names = visitorsOf(r).map((v) => v.name).join(', ')
  const lead = leadVideo(r)
  const what = [lead?.menu, lead?.price].filter(Boolean).join(' · ')
  return pageMetadata({
    title: t.restaurant.title(r.label, names, area(r), r.category || ''),
    description: t.restaurant.description(names, area(r), r.category || '', r.label, what ? `${what}. ` : '').slice(0, 170),
    path: paths[lang],
    image: lead ? thumbOf(lead) : undefined,
    locale: OG_LOCALE[lang],
    index: translated,
    languages: translated ? languagesOf(paths) : undefined,
  })
}

export default async function LangRestaurantPage({ params }: Props) {
  const { lang, r, paths } = await load(params)
  const t = PAGE[lang]
  const home = { href: langPath(lang), name: t.siteName }
  const regionHref = r.regionKo && REGIONS[r.regionKo] ? langPath(lang, 'region', REGIONS[r.regionKo].slug) : null
  const crumbs = [
    ...(regionHref ? [{ name: r.region!, path: regionHref }] : []),
    { name: r.label, path: paths[lang] },
  ]
  return (
    <>
      <SiteHeader crumbs={crumbs} mapHref={mapHrefOf({ place: r.id, lang })} home={home} mapLabel={t.openMap} navLabel={NAV_LABEL[lang]} />
      <main className="mx-auto max-w-2xl sm:px-4 sm:pt-6">
        <DetailPanel restaurant={r} asPage labels={LABELS[lang as Lang]} />
        <p className="px-4 pt-2 text-meta text-sub sm:px-0">{t.koreanNote}</p>
        {regionHref && (
          <p className="px-4 pt-4 sm:px-0">
            <a href={regionHref} className="inline-flex min-h-[40px] items-center rounded-full border border-line px-3.5 text-body text-ink">
              {t.more}: {r.region!}
            </a>
          </p>
        )}
      </main>
      <LangLinks paths={paths} current={lang} label={t.langs} />
      {jsonLdScript([
        (() => {
          const ld = restaurantJsonLd(r)
          // 요약이 없는 영상의 기본 설명은 한국어 문장이라 그 언어로 바꾼다
          const subjectOf = ld.subjectOf.map((x, i) => ({ ...x, name: r.videos[i].title || `${r.videos[i].channel_name} · ${r.label}`, description: r.videos[i].why || t.visitedBy(r.videos[i].channel_name) }))
          return { ...ld, subjectOf, url: `https://mukmap.kr${paths[lang]}`, inLanguage: lang }
        })(),
        breadcrumbJsonLd([{ name: t.siteName, path: home.href }, ...crumbs]),
      ])}
    </>
  )
}
