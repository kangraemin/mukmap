'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NaverMap from '@/components/NaverMap'
import ChannelFilter from '@/components/ChannelFilter'
import RegionCategoryFilter from '@/components/RegionCategoryFilter'
import SearchBar from '@/components/SearchBar'
import RestaurantCard from '@/components/RestaurantCard'
import EmptyState from '@/components/EmptyState'
import DetailPanel from '@/components/DetailPanel'
import Onboarding from '@/components/Onboarding'
import Toast from '@/components/Toast'
import type { Channel, RestaurantWithVideos } from '@/lib/types'

interface Bounds {
  sw_lat: number
  sw_lng: number
  ne_lat: number
  ne_lng: number
}

type SheetState = 'collapsed' | 'half' | 'full'

const RATING_WEIGHT: Record<string, number> = {
  '강력추천': 5, '추천': 4, '보통': 3, '비추': 2, '언급없음': 1,
}

function ratingScore(r: RestaurantWithVideos) {
  return r.videos.reduce((s, v) => s + (RATING_WEIGHT[v.rating ?? ''] ?? 0), 0)
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="white">
      <path d="M8 14s5-4.6 5-8.4A5 5 0 0 0 3 5.6C3 9.4 8 14 8 14z" fill="white"/>
      <circle cx="8" cy="6" r="1.6" fill="rgba(255,255,255,0.6)"/>
    </svg>
  )
}

export default function Home() {
  const [onboarded, setOnboarded] = useState(() =>
    typeof window !== 'undefined' && !!localStorage.getItem('mukmap_onboarded')
  )
  const [allChannels, setAllChannels] = useState<Channel[]>([])

  const [focusedRestaurantId, setFocusedRestaurantId] = useState<number | null>(null)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [restaurants, setRestaurants] = useState<RestaurantWithVideos[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [region, setRegion] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [toast, setToast] = useState('')
  const [fitToMarkers, setFitToMarkers] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState<'rating' | 'latest'>('rating')
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')

  // Client-side cache for restaurant API results
  const restaurantCache = useRef<Map<string, RestaurantWithVideos[]>>(new Map())

  // Mobile bottom sheet
  const [_sheetState, setSheetState] = useState<SheetState>('collapsed')
  const touchStartY = useRef(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const snapOffsets = useRef<Record<SheetState, number>>({ full: 0, half: 0, collapsed: 0 })
  const currentSnapOffset = useRef(0)
  const isDragging = useRef(false)

  // Derive focused restaurant from list
  const focusedRestaurant = useMemo(
    () => restaurants.find((r) => r.id === focusedRestaurantId) ?? null,
    [restaurants, focusedRestaurantId]
  )

  // Sorted restaurants
  const sorted = useMemo(() => {
    if (sortBy === 'rating') {
      return [...restaurants].sort((a, b) => ratingScore(b) - ratingScore(a))
    }
    return [...restaurants].sort((a, b) => {
      const ta = new Date(a.videos[0]?.published_at ?? 0).getTime()
      const tb = new Date(b.videos[0]?.published_at ?? 0).getTime()
      return tb - ta
    })
  }, [restaurants, sortBy])

  // Fetch all channels once on mount (shared by onboarding + ChannelChips)
  useEffect(() => {
    fetch('/api/channels')
      .then((r) => r.json())
      .then((data) => setAllChannels(data.channels || []))
      .catch(() => {})
  }, [])

  const handleOnboardingComplete = useCallback((ids: string[]) => {
    localStorage.setItem('mukmap_onboarded', '1')
    if (ids.length > 0) setSelectedChannels(ids)
    setOnboarded(true)
  }, [])

  // Fetch restaurants when bounds/filters change (with client-side cache)
  useEffect(() => {
    if (!bounds) return

    const boundsKey = [bounds.sw_lat, bounds.sw_lng, bounds.ne_lat, bounds.ne_lng]
      .map(n => n.toFixed(3)).join(',')
    const cacheKey = `${boundsKey}|${[...selectedChannels].sort().join(',')}|${region}|${[...categories].sort().join(',')}`

    const cached = restaurantCache.current.get(cacheKey)
    if (cached) {
      setRestaurants(cached)
      return
    }

    const params = new URLSearchParams({
      sw_lat: String(bounds.sw_lat),
      sw_lng: String(bounds.sw_lng),
      ne_lat: String(bounds.ne_lat),
      ne_lng: String(bounds.ne_lng),
      limit: '200',
    })

    if (selectedChannels.length > 0) {
      params.set('channel_ids', selectedChannels.join(','))
    }
    if (region) params.set('region', region)
    if (categories.length > 0) params.set('category', categories.join(','))

    setLoading(true)
    fetch(`/api/restaurants?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const newList = data.restaurants || []
        if (restaurantCache.current.size > 50) restaurantCache.current.clear()
        restaurantCache.current.set(cacheKey, newList)
        setRestaurants(prev => {
          if (prev.length === newList.length && prev.length > 0 && prev[0]?.id === newList[0]?.id) return prev
          return newList
        })
      })
      .catch(() => setRestaurants([]))
      .finally(() => setLoading(false))
  }, [bounds, selectedChannels, region, categories])

  const handleBoundsChange = useCallback((b: Bounds) => {
    setBounds(b)
    setFitToMarkers(false)
  }, [])

  const handleChannelToggle = useCallback((channelId: string) => {
    setSelectedChannels((prev) => {
      const next = prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
      if (next.length > prev.length) setFitToMarkers(true)
      return next
    })
  }, [])

  const handleCategoryToggle = useCallback((cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }, [])

  const handleReset = useCallback(() => {
    setRegion('')
    setCategories([])
  }, [])

  const goToState = useCallback((state: SheetState) => {
    const offset = snapOffsets.current[state]
    currentSnapOffset.current = offset
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 300ms ease-out'
      sheetRef.current.style.transform = `translateY(${offset}px)`
    }
    setSheetState(state)
  }, [])

  // 초기화 + native touch listeners (touchmove: passive:false → e.preventDefault() 가능)
  useEffect(() => {
    const sheet = sheetRef.current
    const handle = handleRef.current
    const content = contentRef.current
    if (!sheet || !handle) return

    const vh = window.innerHeight
    snapOffsets.current = { full: 0, half: vh * 0.9 - vh * 0.5, collapsed: vh * 0.9 - 120 }
    currentSnapOffset.current = snapOffsets.current.collapsed
    sheet.style.transition = 'none'
    sheet.style.transform = `translateY(${snapOffsets.current.collapsed}px)`

    const onStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY
      isDragging.current = true
      sheet.style.transition = 'none'
    }

    const onHandleMove = (e: TouchEvent) => {
      if (!isDragging.current) return
      e.preventDefault()
      const deltaY = e.touches[0].clientY - touchStartY.current
      const newOffset = Math.max(0, Math.min(currentSnapOffset.current + deltaY, snapOffsets.current.collapsed))
      sheet.style.transform = `translateY(${newOffset}px)`
    }

    const onContentMove = (e: TouchEvent) => {
      if (!isDragging.current) return
      const scrollTop = content?.scrollTop ?? 0
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (scrollTop > 0 || deltaY <= 0) return
      e.preventDefault()
      const newOffset = Math.max(0, Math.min(currentSnapOffset.current + deltaY, snapOffsets.current.collapsed))
      sheet.style.transform = `translateY(${newOffset}px)`
    }

    const onEnd = () => {
      if (!isDragging.current) return
      isDragging.current = false
      const match = sheet.style.transform.match(/translateY\((-?[\d.]+)px\)/)
      const currentY = match ? parseFloat(match[1]) : currentSnapOffset.current
      const offsets = snapOffsets.current
      const nearest = ([
        ['full', offsets.full],
        ['half', offsets.half],
        ['collapsed', offsets.collapsed],
      ] as [SheetState, number][])
        .sort((a, b) => Math.abs(currentY - a[1]) - Math.abs(currentY - b[1]))[0][0]
      goToState(nearest)
    }

    handle.addEventListener('touchstart', onStart, { passive: false })
    handle.addEventListener('touchmove', onHandleMove, { passive: false })
    handle.addEventListener('touchend', onEnd, { passive: true })

    if (content) {
      content.addEventListener('touchstart', onStart, { passive: true })
      content.addEventListener('touchmove', onContentMove, { passive: false })
      content.addEventListener('touchend', onEnd, { passive: true })
    }

    return () => {
      handle.removeEventListener('touchstart', onStart)
      handle.removeEventListener('touchmove', onHandleMove)
      handle.removeEventListener('touchend', onEnd)
      if (content) {
        content.removeEventListener('touchstart', onStart)
        content.removeEventListener('touchmove', onContentMove)
        content.removeEventListener('touchend', onEnd)
      }
    }
  }, [goToState])

  const handleMarkerClick = useCallback((id: number) => {
    setFocusedRestaurantId(id)
    setMobileView('detail')
    goToState('full')
  }, [goToState])

  const handleSelectRestaurant = useCallback((id: number) => {
    setFocusedRestaurantId(id)
  }, [])

  const handleSelectChannel = useCallback((id: string) => {
    setSelectedChannels((prev) => {
      if (prev.includes(id)) return prev
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
    setFitToMarkers(true)
  }, [])

  const handleSelectRegion = useCallback((name: string) => {
    setRegion(name)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      {/* Desktop Sidebar */}
      <aside className="hidden w-80 flex-shrink-0 flex-col border-r border-border bg-cream lg:flex">
        {/* Brand row */}
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
            <PinIcon />
          </div>
          <div>
            <p className="text-[15px] font-extrabold tracking-tight text-ink">MukMap</p>
            <p className="-mt-0.5 text-[10.5px] text-ink-muted">유튜버 맛집 지도</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-2 pt-3">
          <SearchBar
            onSelectRestaurant={handleSelectRestaurant}
            onSelectChannel={handleSelectChannel}
            onSelectRegion={handleSelectRegion}
          />
        </div>

        {/* Region + Categories */}
        <div className="px-4 pb-3">
          <RegionCategoryFilter
            region={region}
            categories={categories}
            onRegionChange={setRegion}
            onCategoryToggle={handleCategoryToggle}
            onReset={handleReset}
          />
        </div>

        <div className="border-t border-border" />

        {/* Channels */}
        <div className="px-4 py-3.5">
          <ChannelFilter
            selectedChannels={selectedChannels}
            onChannelToggle={handleChannelToggle}
            onMaxExceeded={() => setToast('유튜버는 최대 5명까지 선택 가능합니다')}
          />
        </div>

        <div className="border-t border-border" />

        {/* Count + Sort toggle */}
        <div className="flex items-baseline justify-between px-4 py-3">
          <div>
            <span className="text-[17px] font-extrabold tracking-tight text-ink">
              {loading ? '...' : restaurants.length}
            </span>
            <span className="ml-1 text-[12px] text-ink-tertiary">곳의 맛집</span>
          </div>
          <button
            onClick={() => setSortBy(s => s === 'rating' ? 'latest' : 'rating')}
            className="flex items-center gap-1 text-[11.5px] text-ink-muted"
          >
            {sortBy === 'rating' ? '평점순' : '최신순'}
            <ChevronDownIcon />
          </button>
        </div>

        {/* Restaurant list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="space-y-2">
            {sorted.length === 0 && !loading && (
              <EmptyState onReset={handleReset} />
            )}
            {sorted.map((r, idx) => (
              <RestaurantCard
                key={r.id}
                name={r.name}
                category={r.category}
                region={r.region}
                thumbnailUrl={r.videos?.[0]?.thumbnail_url}
                rating={r.videos?.[0]?.rating}
                channelName={r.videos?.[0]?.channel_name}
                channelThumbnail={r.videos?.[0]?.channel_thumbnail}
                channelId={r.videos?.[0]?.channel_id}
                channelIndex={idx}
                channelThumbnails={r.videos.map(v => v.channel_thumbnail ?? null)}
                summary={r.videos?.[0]?.summary}
                isSelected={r.id === focusedRestaurantId}
                onClick={() => handleMarkerClick(r.id)}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* Map + Detail Panel */}
      <div className="relative flex-1 overflow-hidden">
        <NaverMap
          onBoundsChange={handleBoundsChange}
          restaurants={restaurants}
          onMarkerClick={handleMarkerClick}
          selectedChannels={selectedChannels}
          fitToMarkers={fitToMarkers}
          focusedRestaurantId={focusedRestaurantId}
        />

        {/* Desktop: slide-in Detail Panel */}
        {focusedRestaurantId && focusedRestaurant && (
          <div className="absolute inset-y-0 right-0 z-25 hidden w-[380px] animate-slide-in-r shadow-[-8px_0_28px_rgba(0,0,0,0.08)] lg:block">
            <DetailPanel
              restaurant={focusedRestaurant}
              onClose={() => setFocusedRestaurantId(null)}
            />
          </div>
        )}

        {/* Mobile: floating search bar */}
        <div className="absolute left-3 right-3 top-3 z-20 lg:hidden">
          <SearchBar
            onSelectRestaurant={handleSelectRestaurant}
            onSelectChannel={handleSelectChannel}
            onSelectRegion={handleSelectRegion}
          />
        </div>

        {/* Mobile bottom sheet */}
        <div
          ref={sheetRef}
          className="fixed bottom-0 left-0 right-0 z-30 rounded-t-2xl bg-cream shadow-[0_-4px_20px_rgba(0,0,0,0.1)] lg:hidden h-[90vh]"
          data-testid="bottom-sheet"
          style={{ transform: 'translateY(calc(90vh - 120px))' }}
        >
          {/* Handle — 스와이프 전용 */}
          <div ref={handleRef} data-testid="sheet-handle" className="flex justify-center py-3 touch-none cursor-grab">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          <div ref={contentRef} className="overflow-y-auto px-4" style={{ maxHeight: 'calc(100% - 24px)' }}>
            {mobileView === 'detail' && focusedRestaurant ? (
              <DetailPanel
                restaurant={focusedRestaurant}
                mobile
                onClose={() => {
                  setFocusedRestaurantId(null)
                  setMobileView('list')
                  goToState('half')
                }}
              />
            ) : (
              <div>
                {/* Channel chips */}
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  <ChannelChips
                    selectedChannels={selectedChannels}
                    onToggle={handleChannelToggle}
                    channels={allChannels}
                  />
                </div>

                {/* Category chips */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {['한식','일식','중식','양식','카페/디저트','분식','고기/구이','해산물','기타'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleCategoryToggle(cat)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        categories.includes(cat)
                          ? 'border-ink-body bg-ink-body text-white'
                          : 'border-border bg-white text-ink-section'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Count + Sort toggle */}
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-xs text-ink-muted">
                    {loading ? '검색 중...' : `총 ${sorted.length}곳`}
                  </p>
                  <button
                    onClick={() => setSortBy(s => s === 'rating' ? 'latest' : 'rating')}
                    className="flex items-center gap-1 text-[11.5px] text-ink-muted"
                  >
                    {sortBy === 'rating' ? '평점순' : '최신순'}
                    <ChevronDownIcon />
                  </button>
                </div>

                {/* Restaurant list */}
                <div className="space-y-2 pb-4">
                  {sorted.length === 0 && !loading && <EmptyState onReset={handleReset} />}
                  {sorted.slice(0, 20).map((r, idx) => (
                    <RestaurantCard
                      key={r.id}
                      name={r.name}
                      category={r.category}
                      region={r.region}
                      thumbnailUrl={r.videos?.[0]?.thumbnail_url}
                      rating={r.videos?.[0]?.rating}
                      channelName={r.videos?.[0]?.channel_name}
                      channelThumbnail={r.videos?.[0]?.channel_thumbnail}
                      channelId={r.videos?.[0]?.channel_id}
                      channelIndex={idx}
                      channelThumbnails={r.videos.map(v => v.channel_thumbnail ?? null)}
                      summary={r.videos?.[0]?.summary}
                      isSelected={r.id === focusedRestaurantId}
                      onClick={() => handleMarkerClick(r.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {!onboarded && (
        <Onboarding
          channels={allChannels}
          onComplete={handleOnboardingComplete}
          restaurantCount={restaurants.length}
        />
      )}
    </div>
  )
}

function ChannelChips({
  selectedChannels,
  onToggle,
  channels,
}: {
  selectedChannels: string[]
  onToggle: (id: string) => void
  channels: { id: string; name: string }[]
}) {
  return (
    <>
      {channels.map((ch) => (
        <button
          key={ch.id}
          onClick={() => onToggle(ch.id)}
          className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
            selectedChannels.includes(ch.id)
              ? 'border-ink-body bg-ink-body text-white'
              : 'border-border bg-white text-ink-section'
          }`}
        >
          {ch.name}
        </button>
      ))}
    </>
  )
}
