// 지도 핀 묶음을 DB에서 만든다. 한국어(/api/pins)와 외국어(/api/pins/en 등)가 같이 쓴다
import { supabase } from '@/lib/supabase'
import { retryDb } from '@/lib/retry'
import { CATEGORY, DATA_KEY, bilingualName, type Lang } from '@/lib/i18n'
import type { PinsPayload } from '@/lib/pins'

const PAGE = 1000

interface Card {
  verdict: string | null
  dishes: { name?: string; best?: boolean }[] | null
  dprice: string | null
  wait: string | null
  parking: string | null
}

interface Row {
  id: number
  name: string
  lat: number
  lng: number
  category: string
  region: string | null
  city: string | null
  videos: ({
    video_id: string
    channel_id: string
    published_at: string | null
    quote: string | null
    menu: string | null
    rec: string | null
    /** 외국어판만: 그 언어로 옮긴 칸 */
    label?: string | null
    tcat?: string | null
    tmenu?: string | null
    t?: Card | null
  } & Card)[]
}

// 상세 요약에서 카드에 쓰는 칸만 꺼낸다(전체 detail은 크다)
const DETAIL = 'rec:detail->>recommend,verdict:detail->>verdict,dishes:detail->dishes,dprice:detail->>price,wait:detail->>wait,parking:detail->>parking'
const tDetail = (key: string) =>
  `label:i18n->${key}->>store_label,tcat:i18n->${key}->>category_label,tmenu:i18n->${key}->>menu,` +
  `tverdict:i18n->${key}->detail->>verdict,tdishes:i18n->${key}->detail->dishes,tprice:i18n->${key}->detail->>price,` +
  `twait:i18n->${key}->detail->>wait,tparking:i18n->${key}->detail->>parking`

type Raw = Row['videos'][number] & Record<string, unknown>

/** null이면 DB를 못 읽었다 */
export async function buildPins(lang?: Lang): Promise<PinsPayload | null> {
  const key = lang && DATA_KEY[lang]
  const rows: Row[] = []
  // Supabase는 한 번에 1000행까지만 준다
  for (let from = 0; ; from += PAGE) {
    const data = await retryDb(() =>
      supabase
        .from('restaurants')
        .select(`id,name,lat,lng,category,region,city,videos(video_id,channel_id,published_at,quote,menu,${DETAIL}${key ? `,${tDetail(key)}` : ''})`)
        .eq('is_visible', true)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('id')
        .range(from, from + PAGE - 1),
    ).catch(() => undefined)
    if (data === undefined) return null
    rows.push(...((data || []) as unknown as Row[]))
    if (!data || data.length < PAGE) break
  }

  const channels: string[] = []
  const index = new Map<string, number>()
  const chIndex = (id: string) => {
    if (!index.has(id)) index.set(id, channels.push(id) - 1)
    return index.get(id)!
  }
  const round = (n: number) => Math.round(n * 1e5) / 1e5

  const pins: PinsPayload['pins'] = rows.map((r) => {
    let vs = [...(r.videos || [])].sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))
    let name = r.name
    let category = r.category
    if (lang) {
      // 외국어: 옮긴 글자만 쓴다. 안 옮긴 영상의 한국어 요약·인용·메뉴는 비운다
      vs = vs.map((raw) => {
        const v = raw as Raw
        const t = v.tverdict || v.tmenu ? { verdict: (v.tverdict as string) || null, dishes: (v.tdishes as Card['dishes']) || null, dprice: (v.tprice as string) || null, wait: (v.twait as string) || null, parking: (v.tparking as string) || null } : null
        return { ...v, quote: null, menu: v.tmenu || null, verdict: t?.verdict || null, dishes: t?.dishes || null, dprice: t?.dprice || null, wait: t?.wait || null, parking: t?.parking || null }
      })
      const tr = (r.videos || []) as Raw[]
      name = bilingualName(tr.find((v) => v.label)?.label as string | undefined, r.name)
      category = (tr.find((v) => v.tcat)?.tcat as string | undefined) || CATEGORY[r.category]?.[lang] || r.category
    }
    // 요약이 있는 가장 최근 영상을 대표로 둔다
    const lead = vs.find((v) => v.verdict) || vs.find((v) => v.quote) || vs[0]
    const dishes = (lead?.verdict && lead.dishes) || []
    const best = (dishes.find((d) => d.best) || dishes[0])?.name || null
    return {
      id: r.id,
      name,
      lat: round(r.lat),
      lng: round(r.lng),
      category,
      region: r.region,
      city: r.city,
      date: (vs[0]?.published_at || '').slice(0, 10),
      ch: Array.from(new Set(vs.map((v) => v.channel_id))).map(chIndex),
      vid: lead?.video_id || null,
      line: (lead?.quote || lead?.menu || null)?.slice(0, 40) || null,
      quote: Boolean(lead?.quote),
      menu: Array.from(new Set(vs.flatMap((v) => (v.menu || '').split(/\s*,\s*/)).filter(Boolean))).join(', ').slice(0, 80),
      nv: vs.length,
      ...(lead?.verdict
        ? {
            rec: lead.rec || null,
            verdict: lead.verdict.slice(0, lang ? 120 : 60),
            best,
            price: lead.dprice?.slice(0, 30) || null,
            wait: lead.wait?.slice(0, lang ? 40 : 24) || null,
            park: lead.parking?.slice(0, lang ? 40 : 24) || null,
          }
        : {}),
    }
  })
  return { channels, pins }
}

export const PINS_CACHE = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }
