'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NaverMap from '@/components/NaverMap'
import ChannelFilter from '@/components/ChannelFilter'
import RegionCategoryFilter from '@/components/RegionCategoryFilter'
import SearchBar from '@/components/SearchBar'
import RestaurantCard from '@/components/RestaurantCard'
import EmptyState from '@/components/EmptyState'
import DetailPanel from '@/components/DetailPanel'
import Toast from '@/components/Toast'
import type { RestaurantWithVideos } from '@/lib/types'

interface Bounds {
  sw_lat: number
  sw_lng: number
  ne_lat: number
  ne_lng: number
}

type SheetState = 'collapsed' | 'half' | 'full'

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="white">
      <path d="M8 14s5-4.6 5-8.4A5 5 0 0 0 3 5.6C3 9.4 8 14 8 14z" fill="white"/>
      <circle cx="8" cy="6" r="1.6" fill="rgba(255,255,255,0.6)"/>
    </svg>
  )
}

export default function Home() {
  const [focusedRestaurantId, setFocusedRestaurantId] = useState<number | null>(null)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [restaurants, setRestaurants] = useState<RestaurantWithVideos[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [region, setRegion] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [toast, setToast] = useState('')
  const [fitToMarkers, setFitToMarkers] = useState(false)
  const [loading, setLoading] = useState(false)

  // Mobile bottom sheet
  const [sheetState, setSheetState] = useState<SheetState>('collapsed')
  const touchStartY = useRef(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Derive focused restaurant from list
  const focusedRestaurant = useMemo(
    () => restaurants.find((r) => r.id === focusedRestaurantId) ?? null,
    [restaurants, focusedRestaurantId]
  )

  // Fetch restaurants when bounds/filters change
  useEffect(() => {
    if (!bounds) return

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
        setRestaurants((prev) => {
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

  const handleMarkerClick = useCallback((id: number) => {
    setFocusedRestaurantId(id)
  }, [])

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

  // Mobile sheet touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartY.current - e.changedTouches[0].clientY
    if (diff > 50) {
      setSheetState((s) => (s === 'collapsed' ? 'half' : s === 'half' ? 'full' : s))
    } else if (diff < -50) {
      setSheetState((s) => (s === 'full' ? 'half' : s === 'half' ? 'collapsed' : s))
    }
  }

  const sheetHeight: Record<SheetState, string> = {
    collapsed: 'h-[120px]',
    half: 'h-[50vh]',
    full: 'h-[90vh]',
  }

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

        {/* Count */}
        <div className="flex items-baseline gap-1 px-4 py-3">
          <span className="text-[17px] font-extrabold tracking-tight text-ink">
            {loading ? '...' : restaurants.length}
          </span>
          <span className="text-xs text-ink-tertiary">곳의 맛집</span>
        </div>

        {/* Restaurant list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="space-y-2">
            {restaurants.length === 0 && !loading && (
              <EmptyState onReset={handleReset} />
            )}
            {restaurants.map((r, idx) => (
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
          <div className="absolute inset-y-0 right-0 z-25 w-[380px] animate-slide-in-r shadow-[-8px_0_28px_rgba(0,0,0,0.08)]">
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
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`fixed bottom-0 left-0 right-0 z-30 rounded-t-2xl bg-cream shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 lg:hidden ${sheetHeight[sheetState]}`}
        >
          {/* Handle */}
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          <div className="overflow-y-auto px-4" style={{ maxHeight: 'calc(100% - 24px)' }}>
            {/* Channel chips */}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              <ChannelChips
                selectedChannels={selectedChannels}
                onToggle={handleChannelToggle}
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

            {/* Restaurant list */}
            <p className="mb-2 text-xs text-ink-muted">
              {loading ? '검색 중...' : `총 ${restaurants.length}곳`}
            </p>
            <div className="space-y-2 pb-4">
              {restaurants.length === 0 && !loading && <EmptyState onReset={handleReset} />}
              {restaurants.slice(0, 20).map((r, idx) => (
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
                  summary={r.videos?.[0]?.summary}
                  isSelected={r.id === focusedRestaurantId}
                  onClick={() => handleMarkerClick(r.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}

function ChannelChips({
  selectedChannels,
  onToggle,
}: {
  selectedChannels: string[]
  onToggle: (id: string) => void
}) {
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/channels')
      .then((r) => r.json())
      .then((data) => setChannels(data.channels || []))
      .catch(() => {})
  }, [])

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
