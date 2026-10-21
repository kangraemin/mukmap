// 검색 노출용 공용 값과 구조화 데이터(JSON-LD). 서버 페이지에서만 쓴다.
import type { RestaurantWithVideos } from '@/lib/types'
import { leadVideo, sceneUrl, thumbOf } from '@/lib/format'
import { HREFLANG, type Lang } from '@/lib/i18n'

export const SITE_URL = 'https://mukmap.kr'
export const SITE_NAME = '먹맵'
const ORG_ID = `${SITE_URL}/#org`
const SITE_ID = `${SITE_URL}/#website`

export function abs(path: string) {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/** 한글 slug·지역이 들어간 경로. canonical·sitemap은 이 값을 쓴다 */
export function pathOf(...parts: string[]) {
  return '/' + parts.map((p) => encodeURIComponent(p)).join('/')
}

/** 같은 조건으로 홈 지도를 여는 주소. HomeExplorer가 yt·area·at·place를 읽는다.
 *  지역은 거르지 않고 그 구에서 시작만 한다(area·area_city). at은 시작할 점(역) */
/** from: 돌아갈 목록 페이지 경로. 지도 위 '목록으로' 버튼이 쓴다 */
export function mapHrefOf(q: { yt?: string; region?: string | null; city?: string | null; at?: string; place?: string | number; from?: string }) {
  const sp = new URLSearchParams()
  if (q.yt) sp.set('yt', q.yt)
  if (q.region) sp.set('area', q.region)
  if (q.city) sp.set('area_city', q.city)
  if (q.at) sp.set('at', q.at)
  if (q.place != null) sp.set('place', String(q.place))
  if (q.from) sp.set('from', q.from)
  const qs = sp.toString()
  return qs ? `/?${qs}` : '/'
}

export function todayLabel(d = new Date()) {
  const k = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return `${k.getFullYear()}년 ${k.getMonth() + 1}월 ${k.getDate()}일`
}

export function jsonLdScript(data: object | object[]) {
  return (
    <script
      type="application/ld+json"
      // JSON 안의 </script> 를 끊어 둔다
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

export function siteJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': ORG_ID,
      name: SITE_NAME,
      url: SITE_URL,
      logo: abs('/apple-touch-icon.png'),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': SITE_ID,
      name: SITE_NAME,
      alternateName: '먹맵 유튜버 맛집 지도',
      url: SITE_URL,
      inLanguage: 'ko-KR',
      publisher: { '@id': ORG_ID },
    },
  ]
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  }
}

export function faqJsonLd(faq: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

export function collectionJsonLd(opts: {
  title: string
  description: string
  path: string
  restaurants: RestaurantWithVideos[]
  dateModified: string | null
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.title,
    description: opts.description,
    url: abs(opts.path),
    inLanguage: 'ko-KR',
    isPartOf: { '@id': SITE_ID },
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.restaurants.length,
      itemListElement: opts.restaurants.slice(0, 100).map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: abs(`/restaurant/${r.id}`),
        name: r.name,
      })),
    },
  }
}

export function restaurantJsonLd(r: RestaurantWithVideos) {
  const lead = leadVideo(r)
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': abs(`/restaurant/${r.id}#place`),
    name: r.name,
    url: abs(`/restaurant/${r.id}`),
    ...(lead ? { image: thumbOf(lead) } : {}),
    ...(r.category ? { servesCuisine: r.category } : {}),
    ...(r.address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: r.address,
            addressRegion: r.region || undefined,
            addressLocality: r.city || undefined,
            addressCountry: 'KR',
          },
        }
      : {}),
    ...(r.lat && r.lng ? { geo: { '@type': 'GeoCoordinates', latitude: r.lat, longitude: r.lng } } : {}),
    subjectOf: r.videos.map((v) => ({
      '@type': 'VideoObject',
      name: v.title || `${v.channel_name} ${r.name}`,
      description: v.why || v.summary || `${v.channel_name}가 ${r.name}에 다녀간 영상`,
      thumbnailUrl: thumbOf(v),
      contentUrl: sceneUrl({ video_id: v.video_id, timestamp_seconds: null }),
      embedUrl: `https://www.youtube.com/embed/${v.video_id}`,
      ...(v.published_at ? { uploadDate: v.published_at } : {}),
      author: { '@type': 'Person', name: v.channel_name },
    })),
  }
}

/** hreflang 묶음. ko는 원래 주소, 나머지는 번역 페이지가 있을 때만 넣는다 */
export function languagesOf(paths: Partial<Record<string, string>>) {
  const out: Record<string, string> = {}
  for (const [k, p] of Object.entries(paths)) if (p) out[HREFLANG[k as Lang] || k] = abs(p)
  if (paths.ko) out['x-default'] = abs(paths.ko)
  return out
}

export function pageMetadata(opts: {
  title: string
  description: string
  path: string
  index?: boolean
  image?: string
  /** og:locale. 기본 ko_KR */
  locale?: string
  /** languagesOf() 결과 */
  languages?: Record<string, string>
}) {
  const url = abs(opts.path)
  return {
    title: opts.title,
    description: opts.description,
    // 페이지의 alternates·openGraph는 layout 값을 통째로 덮으므로 RSS·사이트 이름도 여기서 다시 넣는다
    alternates: {
      canonical: url,
      types: { 'application/rss+xml': abs('/feed.xml') },
      ...(opts.languages && Object.keys(opts.languages).length > 1 ? { languages: opts.languages } : {}),
    },
    robots: opts.index === false ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'website' as const,
      siteName: SITE_NAME,
      locale: opts.locale || 'ko_KR',
      title: opts.title,
      description: opts.description,
      url,
      // 여기서 images를 넣으면 그 경로의 opengraph-image 파일을 덮는다. 파일이 없는 경로만 넘긴다
      ...(opts.image ? { images: [{ url: opts.image }] } : {}),
    },
  }
}
