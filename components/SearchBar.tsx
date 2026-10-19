'use client'

import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { REGIONS } from '@/lib/constants'
import type { Pin } from '@/lib/pins'
import { norm, searchPins, tokensOf, type SearchIndex } from '@/lib/search'
import { ChannelFace } from './ChannelFace'

interface SearchChannel {
  id: string
  name: string
  thumbnail_url: string | null
}

interface SearchBarProps {
  /** 받아 둔 핀으로 만든 검색 색인. 아직 없으면 null */
  index: SearchIndex | null
  channels: SearchChannel[]
  onSelectRestaurant: (id: number) => void
  onSelectChannel: (id: string) => void
  onSelectRegion: (name: string) => void
  /** 검색어에 맞는 가게 전부를 지도에 띄운다 */
  onSearchAll: (q: string) => void
  /** 검색창을 누르면 */
  onFocus?: () => void
}

type Item =
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

export default function SearchBar({ index, channels, onSelectRestaurant, onSelectChannel, onSelectRegion, onSearchAll, onFocus }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const q = useDeferredValue(query.trim())

  const items = useMemo<Item[]>(() => {
    if (!q) return []
    const toks = tokensOf(q, index || undefined)
    const single = toks.length === 1
    const chs = single ? channels.filter((c) => norm(c.name).includes(toks[0])).slice(0, 3) : []
    const regs = single ? REGIONS.filter((r) => r.includes(toks[0])).slice(0, 3) : []
    const shops = index ? searchPins(index, q) : []
    return [
      ...(shops.length > 1 ? [{ type: 'all' as const, q, n: shops.length }] : []),
      ...chs.map((ch) => ({ type: 'channel' as const, ch })),
      ...regs.map((name) => ({ type: 'region' as const, name })),
      ...shops.slice(0, MAX_SHOPS).map((pin) => ({ type: 'restaurant' as const, pin })),
    ]
  }, [q, index, channels])

  const close = () => {
    setOpen(false)
    setActive(-1)
    inputRef.current?.blur()
  }

  const choose = (it: Item) => {
    close()
    setQuery('')
    if (it.type === 'all') onSearchAll(it.q)
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
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="가게, 메뉴, 유튜버, 지역"
          aria-label="검색"
          className="min-w-0 flex-1 bg-transparent text-[16px] leading-[22px] text-ink placeholder:text-sub focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="검색어 지우기"
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
          {!index && <p className="px-4 py-3 text-body text-sub">가게 목록을 받는 중이에요…</p>}
          {index && items.length === 0 && (
            <div className="px-4 py-3">
              <p className="text-body font-bold text-ink">‘{q}’에 맞는 가게가 없어요</p>
              <p className="mt-0.5 text-meta text-sub">메뉴(국밥), 유튜버(쯔양), 지역(광주)을 띄어 써서 찾아보세요.</p>
            </div>
          )}
          <ul>
            {items.map((it, i) => {
              const on = i === active
              const base = `flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left ${on ? 'bg-well' : 'active:bg-well lg:hover:bg-well'}`
              const key = it.type === 'restaurant' ? `r${it.pin.id}` : it.type === 'channel' ? `c${it.ch.id}` : it.type === 'region' ? `g${it.name}` : 'all'
              return (
                <li key={key}>
                  <button type="button" data-testid={`search-${it.type}`} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(it)} className={base}>
                    {it.type === 'all' && (
                      <>
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-caption text-ink"><SearchIcon /></span>
                        <span className="min-w-0 flex-1 truncate text-body text-ink">
                          <b>‘{it.q}’</b> 가게 <b>{it.n}곳</b> 지도에서 보기
                        </span>
                      </>
                    )}
                    {it.type === 'channel' && (
                      <>
                        <ChannelFace face={{ id: it.ch.id, name: it.ch.name, thumbnail: it.ch.thumbnail_url }} size={36} />
                        <span className="min-w-0 flex-1 truncate text-body font-bold text-ink">{it.ch.name}</span>
                        <span className="text-meta text-sub">유튜버</span>
                      </>
                    )}
                    {it.type === 'region' && (
                      <>
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-well text-ink"><PinIcon /></span>
                        <span className="min-w-0 flex-1 truncate text-body font-bold text-ink">{it.name}</span>
                        <span className="text-meta text-sub">지역</span>
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
                            {[it.pin.category, [it.pin.region, it.pin.city].filter(Boolean).join(' '), it.pin.menu].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
