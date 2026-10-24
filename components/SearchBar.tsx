'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { REGIONS } from '@/lib/constants'
import type { Pin } from '@/lib/pins'
import { findStations, isStationQuery, loadStations, norm, searchPins, tokensOf, type SearchIndex, type Station, type StationRow } from '@/lib/search'
import { ChannelFace } from './ChannelFace'
import { KO_UI, type UiText } from '@/lib/ui-text'

interface SearchChannel {
  id: string
  name: string
  thumbnail_url: string | null
  /** 이 이름으로도 찾는다(외국어 화면의 한국어 원래 이름) */
  alt?: string
}

interface SearchBarProps {
  /** 받아 둔 핀으로 만든 검색 색인. 아직 없으면 null */
  index: SearchIndex | null
  channels: SearchChannel[]
  onSelectRestaurant: (id: number) => void
  onSelectChannel: (id: string) => void
  onSelectRegion: (name: string) => void
  onSelectStation: (station: Station) => void
  apiBase?: string
  /** 검색어에 맞는 가게 전부를 지도에 띄운다 */
  onSearchAll: (q: string) => void
  /** 검색창을 누르면 */
  onFocus?: () => void
  t?: UiText
}

type Item =
  | { type: 'station'; station: Station }
  | { type: 'all'; q: string; n: number }
  | { type: 'channel'; ch: SearchChannel }
  | { type: 'region'; name: string }
  | { type: 'restaurant'; pin: Pin }

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M14 14l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M8 14.5s5-4.6 5-8.3A5 5 0 0 0 3 6.2c0 3.7 5 8.3 5 8.3z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="6.3" r="1.7" fill="currentColor"/>
    </svg>
  )
}

const MAX_SHOPS = 8

export default function SearchBar({ index, channels, onSelectRestaurant, onSelectChannel, onSelectRegion, onSelectStation, apiBase = '', onSearchAll, onFocus, t = KO_UI }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const q = useDeferredValue(query.trim())
  const [stationResult, setStationResult] = useState<{ q: string; rows: Station[] } | null>(null)
  // 전국 역 목록. 있으면 역 검색이 서버를 거치지 않고 바로 뜬다(실기기에서 서버 왕복으로 1~2초 걸렸다)
  const [stationRows, setStationRows] = useState<StationRow[] | null>(null)
  const term = query.trim()
  const stationQuery = isStationQuery(term)
  // '역'을 안 붙여도 앞 글자가 맞는 역을 띄운다(구 → 구의역·구로역, 사용자 지시 2026-10-25). 한 낱말일 때만
  const stationPrefix = !stationQuery && /^[가-힣]+$/.test(term)
  const localStations = useMemo(() => ((stationQuery || stationPrefix) && stationRows ? findStations(stationRows, term) : []), [stationQuery, stationPrefix, stationRows, term])
  // 목록에 없는 역만 서버(네이버 검색)에 묻는다. 답이 오기 전엔 '찾는 중'
  const askServer = stationQuery && stationRows !== null && localStations.length === 0
  const stationPending = stationQuery && (stationRows === null || (askServer && stationResult?.q !== term))

  useEffect(() => {
    if (open && !stationRows) loadStations().then(setStationRows)
  }, [open, stationRows])

  useEffect(() => {
    if (!open || !askServer) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${apiBase}/api/station?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        const rows: Station[] = response.ok ? await response.json() : []
        if (!controller.signal.aborted) {
          setStationResult({ q: term, rows })
          setActive(-1)
        }
      } catch {
        if (!controller.signal.aborted) setStationResult({ q: term, rows: [] })
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [term, open, askServer, apiBase])

  const items = useMemo<Item[]>(() => {
    if (!q) return []
    const toks = tokensOf(q, index || undefined)
    const single = toks.length === 1
    const chs = single ? channels.filter((c) => norm(c.name).includes(toks[0]) || (c.alt && norm(c.alt).includes(toks[0]))).slice(0, 3) : []
    const regs = single ? REGIONS.filter((r) => r.includes(toks[0]) || norm(t.regionLabel(r)).includes(toks[0])).slice(0, 3) : []
    const shops = index ? searchPins(index, q) : []
    return [
      ...(localStations.length ? localStations : stationResult?.q === query.trim() ? stationResult.rows : []).map((station) => ({ type: 'station' as const, station })),
      ...(shops.length > 1 ? [{ type: 'all' as const, q, n: shops.length }] : []),
      ...chs.map((ch) => ({ type: 'channel' as const, ch })),
      ...regs.map((name) => ({ type: 'region' as const, name })),
      ...shops.slice(0, MAX_SHOPS).map((pin) => ({ type: 'restaurant' as const, pin })),
    ]
  }, [q, query, index, channels, stationResult, localStations, t])

  const close = () => {
    setOpen(false)
    setActive(-1)
    inputRef.current?.blur()
  }

  const choose = (it: Item) => {
    close()
    setQuery('')
    if (it.type === 'station') onSelectStation(it.station)
    else if (it.type === 'all') onSearchAll(it.q)
    else if (it.type === 'channel') onSelectChannel(it.ch.id)
    else if (it.type === 'region') onSelectRegion(it.name)
    else onSelectRestaurant(it.pin.id)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const it = items[active] || items[0]
      if (it) choose(it)
    } else if (e.key === 'Escape') close()
  }

  const show = open && query.trim().length > 0

  return (
    <div className="relative flex-1">
      <label className="flex h-12 items-center gap-2.5 rounded-full bg-paper px-4 shadow-[0_2px_12px_rgba(27,29,31,0.12)] lg:border lg:border-line lg:shadow-none">
        <span className="flex-shrink-0 text-ink"><SearchIcon /></span>
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(-1) }}
          onKeyDown={onKeyDown}
          onFocus={() => { setOpen(true); onFocus?.() }}
          onBlur={() => setTimeout(() => {
            // 결과 선택 직후 다시 입력하면 앞선 blur가 새 검색까지 닫지 않게 한다.
            if (document.activeElement !== inputRef.current) setOpen(false)
          }, 150)}
          placeholder={t.placeholder}
          aria-label={t.searchLabel}
          className="min-w-0 flex-1 bg-transparent text-[16px] leading-[22px] text-ink placeholder:text-sub focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label={t.clearQuery}
            onMouseDown={(e) => { e.preventDefault(); setQuery(''); setActive(-1) }}
            className="-mr-2 flex h-11 w-11 flex-shrink-0 items-center justify-center text-sub"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-well"><CloseIcon /></span>
          </button>
        )}
      </label>

      {show && (
        <div
          data-testid="search-results"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[60vh] animate-drop-in overflow-y-auto overscroll-contain rounded-card bg-paper py-1.5 shadow-[0_12px_32px_rgba(27,29,31,0.18)]"
        >
          {!index && <p className="px-4 py-3 text-body text-sub">{t.indexLoading}</p>}
          {stationPending && <p data-testid="station-pending" className="px-4 py-3 text-body text-sub">{t.stationPending}</p>}
          {index && items.length === 0 && !stationPending && (
            <div className="px-4 py-3">
              <p className="text-body font-bold text-ink">{t.noMatch(q)}</p>
              <p className="mt-0.5 text-meta text-sub">{t.noMatchHint}</p>
            </div>
          )}
          <ul>
            {items.map((it, i) => {
              const on = i === active
              const base = `flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left ${on ? 'bg-well' : 'active:bg-well lg:hover:bg-well'}`
              const key = it.type === 'station' ? `s${it.station.name}` : it.type === 'restaurant' ? `r${it.pin.id}` : it.type === 'channel' ? `c${it.ch.id}` : it.type === 'region' ? `g${it.name}` : 'all'
              return (
                <li key={key}>
                  <button type="button" data-testid={`search-${it.type}`} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(it)} className={base}>
                    {it.type === 'station' && (
                      <span className="min-w-0 flex-1 truncate text-body text-ink">📍 <b>{it.station.name}</b>{t.stationGo}</span>
                    )}
                    {it.type === 'all' && (
                      <>
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-caption text-ink"><SearchIcon /></span>
                        <span className="min-w-0 flex-1 truncate text-body text-ink">
                          {(([a, b, c, d]) => <><b>{a}</b>{b}<b>{c}</b>{d}</>)(t.seeAll(it.q, it.n))}
                        </span>
                      </>
                    )}
                    {it.type === 'channel' && (
                      <>
                        <ChannelFace face={{ id: it.ch.id, name: it.ch.name, thumbnail: it.ch.thumbnail_url }} size={36} />
                        <span className="min-w-0 flex-1 truncate text-body font-bold text-ink">{it.ch.name}</span>
                        <span className="text-meta text-sub">{t.youtuber}</span>
                      </>
                    )}
                    {it.type === 'region' && (
                      <>
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-well text-ink"><PinIcon /></span>
                        <span className="min-w-0 flex-1 truncate text-body font-bold text-ink">{t.regionLabel(it.name)}</span>
                        <span className="text-meta text-sub">{t.region}</span>
                      </>
                    )}
                    {it.type === 'restaurant' && (
                      <>
                        <span className="h-9 w-12 flex-shrink-0 overflow-hidden rounded-[8px] bg-well">
                          {/* eslint-disable-next-line @next/next/no-img-element -- 토스 앱과 같이 쓰는 컴포넌트 */}
                          {it.pin.vid && <img src={`https://i.ytimg.com/vi/${it.pin.vid}/default.jpg`} alt="" className="h-full w-full object-cover" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body font-bold text-ink">{it.pin.name}</span>
                          <span className="block truncate text-meta text-sub">
                            {[it.pin.category && t.category(it.pin.category), t.area(it.pin.region, it.pin.city), it.pin.menu].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          {localStations.length > 0 && <p className="px-4 pb-1 pt-0.5 text-[11px] text-sub">{t.osm}</p>}
        </div>
      )}
    </div>
  )
}
