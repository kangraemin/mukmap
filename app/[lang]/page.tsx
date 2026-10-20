import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LangLinks from '@/components/page/LangLinks'
import LangList from '@/components/page/LangList'
import SiteHeader from '@/components/page/SiteHeader'
import { LANGS, OG_LOCALE, PAGE, REGIONS, isLang, langPath, regionName, NAV_LABEL } from '@/lib/i18n'
import { collectionJsonLd, jsonLdScript, languagesOf, pageMetadata } from '@/lib/seo'
import { translatedRestaurants } from './_list'

export const revalidate = 3600

interface Props {
  params: { lang: string }
}

const PATHS: Record<string, string> = { ko: '/', ...Object.fromEntries(LANGS.map((l) => [l, langPath(l)])) }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isLang(params.lang)) notFound()
  const t = PAGE[params.lang].home
  return pageMetadata({
    title: t.title,
    description: t.description,
    path: PATHS[params.lang],
    locale: OG_LOCALE[params.lang],
    languages: languagesOf(PATHS),
  })
}

export default async function LangHome({ params }: Props) {
  if (!isLang(params.lang)) notFound()
  const lang = params.lang
  const t = PAGE[lang]
  const { restaurants, items } = await translatedRestaurants(lang)
  const byRegion = new Map<string, number>()
  for (const r of restaurants) if (r.region && REGIONS[r.region]) byRegion.set(r.region, (byRegion.get(r.region) || 0) + 1)
  const latest = restaurants[0]?.videos[0]?.published_at || null
  const year = new Date().getFullYear()
  return (
    <>
      <SiteHeader crumbs={[]} mapHref="/" home={{ href: PATHS[lang], name: t.siteName }} mapLabel={t.openMap} navLabel={NAV_LABEL[lang]} />
      <main className="mx-auto max-w-2xl px-4 pb-6 pt-6 sm:px-0">
        <h1 className="text-title font-bold text-ink">{t.home.h1}</h1>
        <h2 className="mt-4 text-lead font-bold text-ink">{t.home.question}</h2>
        <p className="mt-1.5 text-body text-ink">{t.home.answer(restaurants.length, year)}</p>
        <h2 className="mt-8 text-lead font-bold text-ink">{t.home.regions}</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {Array.from(byRegion.entries()).sort((a, b) => b[1] - a[1]).map(([r, n]) => (
            <li key={r}>
              <a href={langPath(lang, 'region', REGIONS[r].slug)} className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-line px-3.5 text-body text-ink">
                {regionName(r, lang)} <span className="text-sub">{n}</span>
              </a>
            </li>
          ))}
        </ul>
        <h2 className="mt-8 text-lead font-bold text-ink">{t.home.recent}</h2>
        <LangList items={items.slice(0, 60)} />
        <p className="mt-4 text-meta text-sub">{t.koreanNote}</p>
      </main>
      <LangLinks paths={PATHS} current={lang} label={t.langs} />
      {jsonLdScript({
        ...collectionJsonLd({ title: t.home.title, description: t.home.description, path: PATHS[lang], restaurants: [], dateModified: latest }),
        inLanguage: lang,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.slice(0, 60).map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: `https://mukmap.kr${it.href}`, name: it.label })),
        },
      })}
    </>
  )
}
