'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import NaverMap from '@/components/NaverMap'
import SearchBar from '@/components/SearchBar'
import RestaurantCard from '@/components/RestaurantCard'
import DetailPanel from '@/components/DetailPanel'
import { ChannelFace } from '@/components/ChannelFace'
import Toast from '@/components/Toast'
import type { Channel, RestaurantWithVideos } from '@/lib/types'

interface Bounds {
  sw_lat: number
  sw_lng: number
  ne_lat: number
  ne_lng: number
}

type SheetState = 'collapsed' | 'half' | 'full'
type Sort = 'latest' | 'visitors'

const LIST_LIMIT = 30
const FETCH_LIMIT = 200
// 접힌 시트가 보여주는 높이: 손잡이 + 유튜버 얼굴 줄 + 가게 수 줄
const PEEK = 184

function latestOf(r: RestaurantWithVideos) {
  return r.videos[0]?.published_at || ''
}

function visitorCount(r: RestaurantWithVideos) {
  return new Set(r.videos.map((v) => v.channel_id)).size
}

interface HomeExplorerProps {
  channels: (Channel & { restaurant_count: number })[]
  /** 서버에서 그린 유튜버·지역 링크 목록. 목록 맨 아래에 붙는다 */
  children?: React.ReactNode
  /** API 주소 앞부분. 토스 앱은 https://mukmap.kr 을 넘긴다 */
  apiBase?: string
  /** 가게·유튜버 페이지 링크를 걸지. 토스 앱에는 그 페이지가 없어 끈다 */
  pageLinks?: boolean
}

export default function HomeExplorer({ channels, children, apiBase = '', pageLinks = true }: HomeExplorerProps) {
  const [focusedRestaurantId, setFocusedRestaurantId] = useState<number | null>(null)
  const [focused, setFocused] = useState<RestaurantWithVideos | null>(null)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [restaurants, setRestaurants] = useState<RestaurantWithVideos[]>([])
  const [channelId, setChannelId] = useState<string | null>(null)
  const [region, setRegion] = useState('')
  const [toast, setToast] = useState('')
  const [fitToMarkers, setFitToMarkers] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sort, setSort] = useState<Sort>('latest')

  const restaurantCache = useRef<Map<string, RestaurantWithVideos[]>>(new Map())

  // 바텀시트(모바일). 데스크톱에서는 같은 패널이 왼쪽 목록이 된다
  const [, setSheetState] = useState<SheetState>('collapsed')
  const sheetRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const snapOffsets = useRef<Record<SheetState, number>>({ full: 0, half: 0, collapsed: 0 })
  const currentSnapOffset = useRef(0)

  const sorted = useMemo(() => {
    const list = [...restaurants]
    if (sort === 'visitors') {
      return list.sort((a, b) => visitorCount(b) - visitorCount(a) || latestOf(b).localeCompare(latestOf(a)))
    }
    return list.sort((a, b) => latestOf(b).localeCompare(latestOf(a)))
  }, [restaurants, sort])

  useEffect(() => {
    if (!bounds) return

    const boundsKey = [bounds.sw_lat, bounds.sw_lng, bounds.ne_lat, bounds.ne_lng]
      .map((n) => n.toFixed(3)).join(',')
    const cacheKey = `${boundsKey}|${channelId || ''}|${region}`

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
      limit: String(FETCH_LIMIT),
    })
    if (channelId) params.set('channel_ids', channelId)
    if (region) params.set('region', region)

    const controller = new AbortController()
    setLoading(true)
    fetch(`${apiBase}/api/restaurants?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const list = data.restaurants || []
        if (restaurantCache.current.size > 50) restaurantCache.current.clear()
        restaurantCache.current.set(cacheKey, list)
        setRestaurants(list)
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') {
          setRestaurants([])
          setToast('가게 목록을 불러오지 못했어요. 잠시 뒤 지도를 다시 움직여 보세요.')
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [bounds, channelId, region, apiBase])

  const handleBoundsChange = useCallback((b: Bounds) => {
    setBounds(b)
    setFitToMarkers(false)
  }, [])

  const goToState = useCallback((state: SheetState) => {
    const offset = snapOffsets.current[state]
    currentSnapOffset.current = offset
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)'
      sheetRef.current.style.transform = `translateY(${offset}px)`
    }
    setSheetState(state)
  }, [])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onScroll = () => {
      el.style.touchAction = el.scrollTop > 0 ? 'pan-y' : 'pan-up'
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    el.style.touchAction = 'pan-up'
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return

    const recalculate = () => {
      const vh = window.innerHeight
      snapOffsets.current = { full: 0, half: vh * 0.9 - vh * 0.5, collapsed: vh * 0.9 - PEEK }
      currentSnapOffset.current = snapOffsets.current.collapsed
      sheet.style.transition = 'none'
      sheet.style.transform = `translateY(${snapOffsets.current.collapsed}px)`
    }

    recalculate()
    window.addEventListener('resize', recalculate)
    return () => window.removeEventListener('resize', recalculate)
  }, [])

  const nearestSnap = useCallback((y: number): SheetState =>
    (['full', 'half', 'collapsed'] as SheetState[])
      .sort((a, b) => Math.abs(y - snapOffsets.current[a]) - Math.abs(y - snapOffsets.current[b]))[0]
  , [])

  // 손잡이: 끄는 만큼 시트가 따라오고, 놓으면 가까운 높이로 붙는다
  useDrag(
    ({ movement: [, my], last, first, memo, event }) => {
      if (event && 'cancelable' in event && (event as Event).cancelable) {
        try { (event as Event).preventDefault() } catch {}
      }
      const startOffset = first ? currentSnapOffset.current : (memo as number)
      const newY = Math.max(0, Math.min(startOffset + my, snapOffsets.current.collapsed))
      if (last) {
        goToState(nearestSnap(newY))
      } else if (sheetRef.current) {
        sheetRef.current.style.transition = 'none'
        sheetRef.current.style.transform = `translateY(${newY}px)`
      }
      return startOffset
    },
    { target: handleRef, axis: 'y', filterTaps: false, eventOptions: { passive: false } }
  )

  // 내용: 맨 위에서 끌면 시트가 움직이고, 스크롤된 상태에서 아래로 끌면 스크롤에 양보한다
  useDrag(
    ({ movement: [, my], last, first, memo, event, cancel }) => {
      const content = contentRef.current
      if (!content) return memo
      if (window.matchMedia('(min-width: 1024px)').matches) return memo

      if (first) return currentSnapOffset.current

      const startOffset = (memo as number | undefined) ?? currentSnapOffset.current
      if (Math.abs(my) < 5) return startOffset

      if (my > 5 && content.scrollTop > 0) {
        cancel()
        return startOffset
      }

      if (event && 'cancelable' in event && (event as Event).cancelable) {
        try { (event as Event).preventDefault() } catch {}
      }

      const newY = Math.max(0, Math.min(startOffset + my, snapOffsets.current.collapsed))
      if (last) {
        goToState(nearestSnap(newY))
      } else if (sheetRef.current) {
        sheetRef.current.style.transition = 'none'
        sheetRef.current.style.transform = `translateY(${newY}px)`
      }
      return startOffset
    },
    { target: contentRef, axis: 'y', filterTaps: false, eventOptions: { passive: false } }
  )

  // 응답이 늦게 온 예전 선택이 지금 선택을 덮지 않게 마지막 요청 번호만 받는다
  const openSeq = useRef(0)

  const openRestaurant = useCallback((id: number) => {
    const seq = ++openSeq.current
    setFocusedRestaurantId(id)
    const hit = restaurants.find((r) => r.id === id)
    if (hit) {
      setFocused(hit)
    } else {
      // 검색으로 고른 가게는 지금 지도 범위 밖일 수 있다
      fetch(`${apiBase}/api/restaurants/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((r) => {
          if (seq !== openSeq.current) return
          if (!r) return setToast('이 가게는 지금 볼 수 없어요.')
          setFocused(r)
          setRestaurants((prev) => (prev.some((p) => p.id === r.id) ? prev : [...prev, r]))
        })
        .catch(() => seq === openSeq.current && setToast('가게 정보를 불러오지 못했어요.'))
    }
    contentRef.current?.scrollTo({ top: 0 })
    goToState('full')
  }, [restaurants, goToState, apiBase])

  const closeRestaurant = useCallback(() => {
    openSeq.current++
    setFocusedRestaurantId(null)
    setFocused(null)
    goToState('half')
  }, [goToState])

  const toggleChannel = useCallback((id: string) => {
    setChannelId((prev) => (prev === id ? null : id))
    setFitToMarkers(true)
  }, [])

  const pickChannel = useCallback((id: string) => {
    setChannelId(id)
    setFitToMarkers(true)
    goToState('half')
  }, [goToState])

  const pickRegion = useCallback((name: string) => {
    setRegion(name)
    setFitToMarkers(true)
    goToState('half')
  }, [goToState])

  const handleToastClose = useCallback(() => setToast(''), [])

  const activeChannel = channels.find((c) => c.id === channelId)
  const filterLabel = [region, activeChannel?.name].filter(Boolean).join(' · ')

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-paper">
      {/* 지도 위 검색(모바일) */}
      <div className="fixed inset-x-0 top-0 z-20 px-4 pt-[calc(12px+env(safe-area-inset-top))] lg:hidden">
        <SearchBar apiBase={apiBase} onSelectRestaurant={openRestaurant} onSelectChannel={pickChannel} onSelectRegion={pickRegion} />
      </div>

      {/* 목록 패널: 모바일은 바텀시트, 데스크톱은 왼쪽 기둥 */}
      <div
        ref={sheetRef}
        data-testid="bottom-sheet"
        className="fixed inset-x-0 bottom-0 z-30 flex h-[90vh] flex-col rounded-t-sheet bg-paper shadow-[0_-6px_24px_rgba(0,0,0,0.12)]
          lg:static lg:z-auto lg:h-full lg:w-[400px] lg:flex-shrink-0 lg:rounded-none lg:border-r lg:border-line lg:shadow-none lg:![transform:none]"
        style={{ transform: `translateY(calc(90vh - ${PEEK}px))` }}
      >
        <div ref={handleRef} data-testid="sheet-handle" className="flex cursor-grab touch-none justify-center pb-2 pt-3 lg:hidden">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>

        <header className="hidden px-5 pb-3 pt-5 lg:block">
          <p className="font-caption text-title text-ink">먹맵</p>
          <p className="mt-0.5 text-meta text-sub">유튜버가 실제로 가서 먹은 집</p>
          <div className="mt-4">
            <SearchBar apiBase={apiBase} onSelectRestaurant={openRestaurant} onSelectChannel={pickChannel} onSelectRegion={pickRegion} />
          </div>
        </header>

        <div
          ref={contentRef}
          data-testid="sheet-content"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {focused ? (
            <div className="sm:px-5 sm:pt-2">
              <DetailPanel
                restaurant={focused}
                onClose={closeRestaurant}
                closeLabel="목록으로"
                channelHref={pageLinks ? (slug) => `/youtuber/${encodeURIComponent(slug)}` : undefined}
              />
              {pageLinks && (
                <p className="px-4 pb-6 sm:px-0">
                  <a href={`/restaurant/${focused.id}`} className="inline-flex min-h-[44px] items-center text-meta text-sub underline underline-offset-2">
                    이 가게만 따로 보기
                  </a>
                </p>
              )}
            </div>
          ) : (
            <>
              <nav aria-label="유튜버 고르기" className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-3 pt-1 lg:px-5">
                {channels.map((ch) => {
                  const on = ch.id === channelId
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggleChannel(ch.id)}
                      aria-pressed={on}
                      className="flex w-[60px] flex-shrink-0 flex-col items-center gap-1.5"
                    >
                      <span className={`rounded-full p-[3px] ${on ? 'bg-caption' : 'bg-transparent'}`}>
                        <ChannelFace face={{ id: ch.id, name: ch.name, thumbnail: ch.thumbnail_url }} size={48} />
                      </span>
                      <span className={`w-full truncate text-center text-meta ${on ? 'font-bold text-ink' : 'text-sub'}`}>{ch.name}</span>
                    </button>
                  )
                })}
              </nav>

              <div className="flex min-h-[44px] items-center justify-between border-b border-line px-4 lg:px-5">
                <p className="text-body text-ink" aria-live="polite">
                  {loading ? '찾는 중' : sorted.length >= FETCH_LIMIT
                    ? <>이 지도 안에 <b>{FETCH_LIMIT}곳 넘게</b></>
                    : <>이 지도 안에 <b>{sorted.length}곳</b></>}
                </p>
                <div className="flex items-center">
                  {filterLabel && (
                    <button
                      type="button"
                      onClick={() => { setRegion(''); setChannelId(null) }}
                      className="mr-1 inline-flex min-h-[44px] items-center gap-1 px-2 text-meta text-sub"
                    >
                      {filterLabel}
                      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      <span className="sr-only">조건 풀기</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSort((s) => (s === 'latest' ? 'visitors' : 'latest'))}
                    className="inline-flex min-h-[44px] items-center px-2 text-meta font-bold text-ink"
                  >
                    {sort === 'latest' ? '최근 영상 순' : '여러 명 간 순'}
                  </button>
                </div>
              </div>

              <div className="px-4 lg:px-5">
                {sorted.length === 0 && !loading && (
                  <div className="py-10 text-center">
                    <p className="text-body text-ink">이 지도 안에는 아직 가게가 없어요.</p>
                    <p className="mt-1 text-meta text-sub">지도를 줄이거나 다른 지역으로 옮겨 보세요.</p>
                  </div>
                )}
                {sorted.slice(0, LIST_LIMIT).map((r) => (
                  <RestaurantCard
                    key={r.id}
                    restaurant={r}
                    href={pageLinks ? `/restaurant/${r.id}` : undefined}
                    onClick={() => openRestaurant(r.id)}
                    selected={r.id === focusedRestaurantId}
                  />
                ))}
                {sorted.length > LIST_LIMIT && (
                  <p className="py-4 text-center text-meta text-sub">
                    {sorted.length - LIST_LIMIT}곳이 더 있어요. 지도를 키우면 좁혀집니다.
                  </p>
                )}
              </div>

              <div className="px-4 pb-[calc(32px+env(safe-area-inset-bottom))] pt-8 lg:px-5">{children}</div>
            </>
          )}
        </div>
      </div>

      <main className="relative isolate z-0 flex-1 overflow-hidden">
        <NaverMap
          onBoundsChange={handleBoundsChange}
          restaurants={restaurants}
          onMarkerClick={openRestaurant}
          fitToMarkers={fitToMarkers}
          focusedRestaurantId={focusedRestaurantId}
          onFitComplete={() => setFitToMarkers(false)}
        />
      </main>

      {toast && <Toast message={toast} onClose={handleToastClose} />}
    </div>
  )
}
