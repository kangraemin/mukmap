'use client'
// 목록 페이지의 가게 카드 + 구·시·유튜버 칩 거르기. 칩은 페이지를 옮기지 않고 그 자리에서 거른다.
import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { RestaurantWithVideos } from '@/lib/types'
import { SceneCard } from '@/components/RestaurantCard'
import { TOSS_BUTTON, tossHref } from '@/lib/tossLink'
import MapPreview from './MapPreview'

export type Facet = 'region' | 'city' | 'channel'
export type ChannelInfo = Record<string, { name: string; thumbnail: string | null; slug?: string | null }>

interface FilterListProps {
  restaurants: RestaurantWithVideos[]
  channels: ChannelInfo
  facets: Facet[]
  /** 이 페이지가 이미 걸고 있는 조건. 유튜버는 지도에서도 거르고, 지역은 지도를 그곳에서 시작만 한다. at은 지도를 시작할 점(역) */
  base: { yt?: string; region?: string; city?: string; at?: string }
  /** 카드 아래 붙일 한 줄(역에서 걸어서 몇 분). 가게 id → 글 */
  notes?: Record<number, string>
  pageSize?: number
}

const LABEL: Record<Facet, string> = { region: '지역', city: '구·시', channel: '유튜버' }

function keyOf(r: RestaurantWithVideos, f: Facet): string[] {
  if (f === 'region') return r.region ? [r.region] : []
  if (f === 'city') return r.city ? [r.city] : []
  return Array.from(new Set(r.videos.map((v) => v.channel_slug || v.channel_id)))
}

// 지역은 area·area_city로 넘겨 지도에서 거르지 않고 그 구에서 시작만 한다(다른 구 가게도 보이게)
function mapHref(q: Record<string, string | undefined>) {
  const sp = new URLSearchParams()
  const name = { yt: 'yt', region: 'area', city: 'area_city', at: 'at', from: 'from' } as const
  for (const k of ['yt', 'region', 'city', 'at', 'from'] as const) if (q[k]) sp.set(name[k], q[k]!)
  const qs = sp.toString()
  return qs ? `/?${qs}` : '/'
}

export default function FilterList({ restaurants: slimmed, channels, facets, base, notes, pageSize = 30 }: FilterListProps) {
  // 서버가 빼고 보낸 유튜버 이름·얼굴을 다시 붙인다
  const restaurants = useMemo(() => slimmed.map((r) => ({
    ...r,
    videos: r.videos.map((v) => {
      const c = channels[v.channel_id]
      return { ...v, channel_name: c?.name || '', channel_thumbnail: c?.thumbnail || null, channel_slug: c?.slug }
    }),
  })) as RestaurantWithVideos[], [slimmed, channels])
  const pathname = usePathname()
  const [picked, setPicked] = useState<Partial<Record<Facet, string>>>({})
  const [shown, setShown] = useState(pageSize)

  // 칩 이름·개수. 유튜버 칩은 slug로 걸러도 화면엔 이름을 쓴다
  const options = useMemo(() => {
    const out = {} as Record<Facet, { key: string; label: string; n: number }[]>
    for (const f of facets) {
      const m = new Map<string, { key: string; label: string; n: number }>()
      for (const r of restaurants) {
        for (const k of keyOf(r, f)) {
          const label = f === 'channel' ? r.videos.find((v) => (v.channel_slug || v.channel_id) === k)!.channel_name : k
          const o = m.get(k) || { key: k, label, n: 0 }
          o.n += 1
          m.set(k, o)
        }
      }
      out[f] = Array.from(m.values()).sort((a, b) => b.n - a.n)
    }
    return out
  }, [restaurants, facets])

  const list = useMemo(
    () => restaurants.filter((r) => facets.every((f) => !picked[f] || keyOf(r, f).includes(picked[f]!))),
    [restaurants, facets, picked],
  )

  const pick = (f: Facet, k?: string) => {
    setPicked((p) => ({ ...p, [f]: k }))
    setShown(pageSize)
  }

  const q = {
    yt: picked.channel || base.yt,
    region: picked.region || base.region,
    city: picked.city || base.city,
    at: base.at,
  }
  // 지도에서 '목록으로'를 누르면 이 페이지로 돌아온다
  const href = mapHref({ ...q, from: pathname || undefined })
  // 미리보기 지도도 고른 칩대로 거른 가게만 찍는다
  const spots = useMemo(
    () => list.flatMap((r) => (r.lat != null && r.lng != null ? [{ lat: r.lat, lng: r.lng }] : [])),
    [list],
  )

  return (
    <>
      <MapPreview spots={spots} href={href} />

      {facets.filter((f) => options[f].length > 1).map((f) => (
        <div key={f} className="mt-4">
          <p className="text-meta font-bold text-sub">{LABEL[f]}</p>
          <ul data-testid={`facet-${f}`} className="no-scrollbar -mx-4 mt-1.5 flex items-center gap-2 overflow-x-auto px-4 pb-1">
            {[{ key: '', label: '전체', n: restaurants.length }, ...options[f]].map((o) => {
              const on = (picked[f] || '') === o.key
              return (
                <li key={o.key || '_all'} className="flex-shrink-0">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(f, o.key || undefined)}
                    className={`inline-flex min-h-[40px] items-center gap-1 rounded-full border px-3.5 text-body ${
                      on ? 'border-ink bg-ink font-bold text-paper' : 'border-line text-ink'
                    }`}
                  >
                    {o.label}
                    {o.key && <span className={on ? 'text-paper/70' : 'text-sub'}>{o.n}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      <p data-testid="list-count" className="mt-6 text-body font-bold text-ink">{list.length}곳</p>
      <ol className="mt-3 grid gap-x-5 gap-y-8 sm:grid-cols-2">
        {list.slice(0, shown).map((r) => (
          <li key={r.id}>
            <SceneCard restaurant={r} href={`/restaurant/${r.id}`} />
            {notes?.[r.id] && <p data-testid="walk" className="mt-1.5 text-meta font-bold text-sub">{notes[r.id]}</p>}
          </li>
        ))}
      </ol>
      {list.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + pageSize)}
          className="mt-8 flex min-h-[48px] w-full items-center justify-center rounded-full border border-line text-body text-ink"
        >
          {list.length - shown}곳 더 보기
        </button>
      )}

      {/* 화면 아래에 늘 떠 있는 지도 버튼. 고른 칩 조건 그대로 지도를 연다. 옆에 같은 조건으로 토스 미니앱을 여는 작은 버튼 */}
      <div className="fixed bottom-[calc(16px+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap">
      <a
        href={href}
        data-testid="open-map"
        className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ink px-5 text-body font-bold text-paper shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        지도로 보기
      </a>
      <a
        href={tossHref(q)}
        data-testid="open-toss"
        data-track="toss_open_click"
        data-track-where="list"
        className={`${TOSS_BUTTON} min-h-[48px] px-4 text-meta shadow-[0_4px_16px_rgba(0,0,0,0.2)]`}
      >
        토스 앱으로 열기
      </a>
      </div>
    </>
  )
}
