// 외국어 첫 화면·지역 페이지가 같이 쓰는 목록 재료
import { getAll, translatedNames } from '@/lib/data'
import { visitorsOf } from '@/lib/format'
import { PAGE, channelName, cityName, langPath, regionName, type Lang } from '@/lib/i18n'
import type { LangItem } from '@/components/page/LangList'

export async function translatedRestaurants(lang: Lang, region?: string) {
  const [{ restaurants }, names] = await Promise.all([getAll(), translatedNames(lang)])
  const rs = restaurants
    .filter((r) => names[r.id] && (!region || r.region === region))
    .sort((a, b) => (b.videos[0]?.published_at || '').localeCompare(a.videos[0]?.published_at || '') || b.id - a.id)
  const items: LangItem[] = rs.map((r) => {
    const v = visitorsOf(r).map((x) => channelName(x.name, lang)).join(', ')
    return {
      href: langPath(lang, 'restaurant', String(r.id)),
      label: names[r.id].label,
      name: r.name,
      category: names[r.id].category,
      area: [regionName(r.region, lang), cityName(r.region, r.city, lang)].filter(Boolean).join(' '),
      visitors: PAGE[lang].visitedBy(v),
    }
  })
  return { restaurants: rs, items }
}
