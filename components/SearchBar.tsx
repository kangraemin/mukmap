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
        ...data.channels.map((ch) => ({
          type: 'channel' as const,
          id: ch.id,
          label: ch.name,
          sub: '유튜버',
        })),
        ...data.restaurants.map((r) => ({
          type: 'restaurant' as const,
          id: r.id,
          label: r.name,
          sub: `${r.category} · ${r.address || ''}`,
        })),
        ...data.regions.map((r) => ({
          type: 'region' as const,
          id: r,
          label: r,
          sub: '지역',
        })),
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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
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
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(results[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const typeIcon: Record<string, string> = {
    channel: '\uD83D\uDC64',
    restaurant: '\uD83C\uDF7D\uFE0F',
    region: '\uD83D\uDCCD',
  }

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="맛집, 유튜버, 지역 검색..."
        className="w-full rounded-lg bg-surface-high px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-lowest focus:ring-1 focus:ring-primary/20 focus:outline-none"
      />

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl bg-surface-lowest shadow-[0_4px_24px_rgba(78,33,30,0.12)]">
          {results.map((item, idx) => (
            <button
              key={`${item.type}-${item.id}`}
              onMouseDown={() => handleSelect(item)}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                idx === activeIndex ? 'bg-primary-light' : 'hover:bg-surface-low'
              }`}
            >
              <span className="text-base">{typeIcon[item.type]}</span>
              <div className="flex-1 overflow-hidden">
                <span className="font-medium text-on-surface">{item.label}</span>
                {item.sub && (
                  <span className="ml-2 text-xs text-on-surface-variant">{item.sub}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
