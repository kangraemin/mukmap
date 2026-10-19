'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SearchResult } from '@/lib/types'

interface SearchBarProps {
  onSelectRestaurant: (id: number) => void
  onSelectChannel: (id: string) => void
  onSelectRegion: (name: string) => void
  /** 토스 앱처럼 다른 도메인에서 쓸 때 API 주소 앞부분 */
  apiBase?: string
}

interface ResultItem {
  type: 'restaurant' | 'channel' | 'region'
  id: string | number
  label: string
  sub?: string
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M14 14l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

export default function SearchBar({
  onSelectRestaurant,
  onSelectChannel,
  onSelectRegion,
  apiBase = '',
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchCacheRef = useRef<Map<string, ResultItem[]>>(new Map())

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    const cached = searchCacheRef.current.get(q)
    if (cached) { setResults(cached); setOpen(cached.length > 0); setActiveIndex(-1); return }
    try {
      const res = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) { setResults([]); return }
      const data: SearchResult = await res.json()
      const items: ResultItem[] = [
        ...data.channels.map((ch) => ({ type: 'channel' as const, id: ch.id, label: ch.name, sub: '유튜버' })),
        ...data.restaurants.map((r) => ({ type: 'restaurant' as const, id: r.id, label: r.name, sub: r.address || r.category })),
        ...data.regions.map((r) => ({ type: 'region' as const, id: r, label: r, sub: '지역' })),
      ]
      if (searchCacheRef.current.size > 100) searchCacheRef.current.clear()
      searchCacheRef.current.set(q, items)
      setResults(items)
      setOpen(items.length > 0)
      setActiveIndex(-1)
    } catch {
      setResults([])
    }
  }, [apiBase])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  const handleSelect = (item: ResultItem) => {
    setOpen(false)
    setQuery('')
    if (item.type === 'restaurant') onSelectRestaurant(item.id as number)
    else if (item.type === 'channel') onSelectChannel(item.id as string)
    else onSelectRegion(item.id as string)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); handleSelect(results[activeIndex]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="relative flex-1">
      <label className="flex h-12 items-center gap-2 rounded-full border border-line bg-paper px-4">
        <span className="flex-shrink-0 text-sub"><SearchIcon /></span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="가게, 지역, 유튜버 이름"
          aria-label="검색"
          className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-sub focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onMouseDown={(e) => { e.preventDefault(); setQuery('') }}
            className="-mr-2 flex h-11 w-11 flex-shrink-0 items-center justify-center text-sub"
          >
            <CloseIcon />
          </button>
        )}
      </label>

      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-card border border-line bg-paper py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          {results.map((item, idx) => (
            <li key={`${item.type}-${item.id}`}>
              <button
                type="button"
                onMouseDown={() => handleSelect(item)}
                className={`flex min-h-[48px] w-full items-center gap-3 px-4 text-left ${idx === activeIndex ? 'bg-well' : 'hover:bg-well'}`}
              >
                <span className="w-9 flex-shrink-0 text-meta text-sub">{KIND[item.type]}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-body font-bold text-ink">{item.label}</span>
                  {item.type === 'restaurant' && item.sub && <span className="ml-2 text-meta text-sub">{item.sub}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const KIND: Record<ResultItem['type'], string> = { channel: '유튜버', restaurant: '가게', region: '지역' }
