'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SearchResult } from '@/lib/types'

interface SearchBarProps {
  onSelectRestaurant: (id: number) => void
  onSelectChannel: (id: string) => void
  onSelectRegion: (name: string) => void
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
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

export default function SearchBar({
  onSelectRestaurant,
  onSelectChannel,
  onSelectRegion,
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) { setResults([]); return }
      const data: SearchResult = await res.json()
      const items: ResultItem[] = [
        ...data.channels.map((ch) => ({ type: 'channel' as const, id: ch.id, label: ch.name, sub: '유튜버' })),
        ...data.restaurants.map((r) => ({ type: 'restaurant' as const, id: r.id, label: r.name, sub: `${r.category} · ${r.address || ''}` })),
        ...data.regions.map((r) => ({ type: 'region' as const, id: r, label: r, sub: '지역' })),
      ]
      setResults(items)
      setOpen(items.length > 0)
      setActiveIndex(-1)
    } catch {
      setResults([])
    }
  }, [])

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

  const typeIcon: Record<string, string> = { channel: '👤', restaurant: '🍽️', region: '📍' }

  return (
    <div className="relative flex-1">
      <div className="flex items-center gap-2 rounded-[10px] border border-border bg-white px-3" style={{ height: 40 }}>
        <span className="flex-shrink-0 text-ink-muted"><SearchIcon /></span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="맛집·지역·유튜버 검색"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink-body placeholder:text-ink-muted focus:outline-none"
        />
        {query && (
          <button
            onMouseDown={(e) => { e.preventDefault(); setQuery('') }}
            className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-surface-high text-ink-muted"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-white shadow-lg">
          {results.map((item, idx) => (
            <button
              key={`${item.type}-${item.id}`}
              onMouseDown={() => handleSelect(item)}
              className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm transition-colors ${
                idx === activeIndex ? 'bg-primary-light' : 'hover:bg-surface-low'
              }`}
            >
              <span className="text-base">{typeIcon[item.type]}</span>
              <div className="flex-1 overflow-hidden">
                <span className="font-semibold text-ink-body">{item.label}</span>
                {item.sub && <span className="ml-2 text-xs text-ink-muted">{item.sub}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
