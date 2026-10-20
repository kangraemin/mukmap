import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LangLinks from '@/components/page/LangLinks'
import LangList from '@/components/page/LangList'
import SiteHeader from '@/components/page/SiteHeader'
import { translatedNames } from '@/lib/data'
import { LANGS, OG_LOCALE, PAGE, channelName, isLang, langPath, regionBySlug, regionName, type Lang, NAV_LABEL } from '@/lib/i18n'
import { MIN_INDEXABLE } from '@/lib/data'
import { breadcrumbJsonLd, jsonLdScript, languagesOf, mapHrefOf, pageMetadata, pathOf } from '@/lib/seo'
import { translatedRestaurants } from '../../_list'

export const revalidate = 3600

interface Props {
  params: { lang: string; region: string }
}

async function load(p: Props['params']) {
  const region = regionBySlug(p.region)
  if (!isLang(p.lang) || !region) notFound()
  const lang: Lang = p.lang
  const { restaurants, items } = await translatedRestaurants(lang, region)
  if (!items.length) notFound()
  const paths: Record<string, string> = { ko: pathOf('region', region) }
  for (const l of LANGS) {
    const names = l === lang ? null : await translatedNames(l)
    if (!names || restaurants.some((r) => names[r.id])) paths[l] = langPath(l, 'region', p.region)
  }
  const visitors = new Map<string, number>()
  for (const r of restaurants) for (const v of Array.from(new Set(r.videos.map((x) => x.channel_name)))) visitors.set(v, (visitors.get(v) || 0) + 1)
  const names = Array.from(visitors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => channelName(n, lang)).join(', ')
  return { lang, region, label: regionName(region, lang), restaurants, items, paths, names }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, label, items, paths, names } = await load(params)
  const t = PAGE[lang].region
  return pageMetadata({
    title: t.title(label, items.length),
    description: t.description(label, items.length, names),
    path: paths[lang],
    index: items.length >= MIN_INDEXABLE,
    locale: OG_LOCALE[lang],
    languages: languagesOf(paths),
  })
}

export default async function LangRegionPage({ params }: Props) {
  const { lang, region, label, items, paths, names } = await load(params)
  const t = PAGE[lang]
  const home = { href: langPath(lang), name: t.siteName }
  const crumbs = [{ name: label, path: paths[lang] }]
  return (
    <>
      <SiteHeader crumbs={crumbs} mapHref={mapHrefOf({ region })} home={home} mapLabel={t.openMap} navLabel={NAV_LABEL[lang]} />
      <main className="mx-auto max-w-2xl px-4 pb-6 pt-6 sm:px-0">
        <h1 className="text-title font-bold text-ink">{t.region.title(label, items.length).replace(/ \| .*$/, '')}</h1>
        <h2 className="mt-4 text-lead font-bold text-ink">{t.region.question(label)}</h2>
        <p className="mt-1.5 text-body text-ink">{t.region.answer(label, items.length, names)}</p>
        <LangList items={items} />
        <p className="mt-4 text-meta text-sub">{t.koreanNote}</p>
      </main>
      <LangLinks paths={paths} current={lang} label={t.langs} />
      {jsonLdScript([
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: t.region.title(label, items.length),
          url: `https://mukmap.kr${paths[lang]}`,
          inLanguage: lang,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: items.length,
            itemListElement: items.slice(0, 100).map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: `https://mukmap.kr${it.href}`, name: it.label })),
          },
        },
        breadcrumbJsonLd([{ name: t.siteName, path: home.href }, ...crumbs]),
      ])}
    </>
  )
}
