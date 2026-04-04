'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import NaverMap from '@/components/NaverMap'
import ChannelFilter from '@/components/ChannelFilter'
import RegionCategoryFilter from '@/components/RegionCategoryFilter'
import SearchBar from '@/components/SearchBar'
import RestaurantCard from '@/components/RestaurantCard'
import EmptyState from '@/components/EmptyState'
import Toast from '@/components/Toast'
import type { RestaurantWithVideos } from '@/lib/types'

interface Bounds {
  sw_lat: number
  sw_lng: number
  ne_lat: number
  ne_lng: number
}

type SheetState = 'collapsed' | 'half' | 'full'

export default function Home() {
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
      .then((data) => setRestaurants(data.restaurants || []))
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
    // Could scroll to card in sidebar
    console.debug('marker clicked:', id)
  }, [])

  const handleSelectRestaurant = useCallback((id: number) => {
    // Could center map on restaurant
    console.debug('restaurant selected:', id)
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
      // Swipe up
      setSheetState((s) => (s === 'collapsed' ? 'half' : s === 'half' ? 'full' : s))
    } else if (diff < -50) {
      // Swipe down
      setSheetState((s) => (s === 'full' ? 'half' : s === 'half' ? 'collapsed' : s))
    }
  }

  const sheetHeight: Record<SheetState, string> = {
    collapsed: 'h-[120px]',
    half: 'h-[50vh]',
    full: 'h-[90vh]',
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar */}
      <header className="relative z-20 flex h-14 items-center gap-3 bg-white px-4 shadow-sm">
        <h1 className="flex-shrink-0 text-lg font-bold text-primary">MukMap</h1>
        <SearchBar
          onSelectRestaurant={handleSelectRestaurant}
          onSelectChannel={handleSelectChannel}
          onSelectRegion={handleSelectRegion}
        />
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-80 flex-shrink-0 flex-col overflow-y-auto bg-gray-50 p-4 lg:flex">
          <ChannelFilter
            selectedChannels={selectedChannels}
            onChannelToggle={handleChannelToggle}
            onMaxExceeded={() => setToast('유튜버는 최대 5명까지 선택 가능합니다')}
          />
          <div className="my-4 border-t border-gray-200" />
          <RegionCategoryFilter
            region={region}
            categories={categories}
            onRegionChange={setRegion}
            onCategoryToggle={handleCategoryToggle}
            onReset={handleReset}
          />
          <div className="my-4 border-t border-gray-200" />

          {/* Restaurant count */}
          <p className="mb-2 text-xs text-gray-400">
            {loading ? '검색 중...' : `총 ${restaurants.length}개 맛집`}
          </p>

          {/* Restaurant cards */}
          <div className="space-y-2">
            {restaurants.length === 0 && !loading && <EmptyState />}
            {restaurants.slice(0, 30).map((r) => (
              <RestaurantCard
                key={r.id}
                name={r.name}
                category={r.category}
                region={r.region}
                thumbnailUrl={r.videos?.[0]?.thumbnail_url}
                rating={r.videos?.[0]?.rating}
                channelName={r.videos?.[0]?.channel_name}
                onClick={() => handleMarkerClick(r.id)}
              />
            ))}
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1">
          <NaverMap
            onBoundsChange={handleBoundsChange}
            restaurants={restaurants}
            onMarkerClick={handleMarkerClick}
            selectedChannels={selectedChannels}
            fitToMarkers={fitToMarkers}
          />
        </div>

        {/* Mobile bottom sheet */}
        <div
          ref={sheetRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`fixed bottom-0 left-0 right-0 z-30 rounded-t-2xl bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 lg:hidden ${sheetHeight[sheetState]}`}
        >
          {/* Handle */}
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-gray-200" />
          </div>

          <div className="overflow-y-auto px-4" style={{ maxHeight: 'calc(100% - 24px)' }}>
            {/* Channel chips (horizontal scroll) */}
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
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    categories.includes(cat)
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Restaurant list */}
            <p className="mb-2 text-xs text-gray-400">
              {loading ? '검색 중...' : `총 ${restaurants.length}개 맛집`}
            </p>
            <div className="space-y-2 pb-4">
              {restaurants.length === 0 && !loading && <EmptyState />}
              {restaurants.slice(0, 20).map((r) => (
                <RestaurantCard
                  key={r.id}
                  name={r.name}
                  category={r.category}
                  region={r.region}
                  thumbnailUrl={r.videos?.[0]?.thumbnail_url}
                  rating={r.videos?.[0]?.rating}
                  channelName={r.videos?.[0]?.channel_name}
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

// Simple channel chips for mobile
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
          className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
            selectedChannels.includes(ch.id)
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {ch.name}
        </button>
      ))}
    </>
  )
}
