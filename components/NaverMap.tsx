'use client'

import { useEffect, useRef, useState } from 'react'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/lib/constants'
import type { RestaurantWithVideos } from '@/lib/types'

interface Bounds {
  sw_lat: number
  sw_lng: number
  ne_lat: number
  ne_lng: number
}

interface NaverMapProps {
  onBoundsChange: (bounds: Bounds) => void
  restaurants: RestaurantWithVideos[]
  onMarkerClick: (restaurantId: number) => void
  fitToMarkers?: boolean
  focusedRestaurantId?: number | null
  onFitComplete?: () => void
}

export default function NaverMap({
  onBoundsChange,
  restaurants,
  onMarkerClick,
  fitToMarkers,
  focusedRestaurantId,
  onFitComplete,
}: NaverMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<naver.maps.Map | null>(null)
  const markersRef = useRef<naver.maps.Marker[]>([])
  const markerListenersRef = useRef<unknown[]>([])
  // clusterRef removed — using grid-based clustering
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState(false)
  // 줌이 바뀌면 묶음 크기가 달라지므로 마커를 다시 그린다
  const [zoomTick, setZoomTick] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restaurantMarkerMapRef = useRef<Map<number, naver.maps.Marker>>(new Map())

  // Load SDK
  useEffect(() => {
    if ((window as Window & { naver?: { maps?: unknown } }).naver?.maps) {
      setSdkLoaded(true)
      return
    }
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
    if (!clientId) return
    if (!document.querySelector('script[src*="oapi.map.naver.com"]')) {
      const script = document.createElement('script')
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`
      script.async = true
      document.head.appendChild(script)
    }
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const poll = setInterval(() => {
      if ((window as Window & { naver?: { maps?: unknown } }).naver?.maps) {
        clearInterval(poll)
        if (timeoutId) clearTimeout(timeoutId)
        setSdkLoaded(true)
      }
    }, 100)
    timeoutId = setTimeout(() => {
      clearInterval(poll)
      setSdkError(true)
    }, 10000)
    return () => {
      clearInterval(poll)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  // Init map
  useEffect(() => {
    if (!sdkLoaded || !mapElRef.current || mapRef.current) return

    const map = new naver.maps.Map(mapElRef.current, {
      center: new naver.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    })
    mapRef.current = map

    // Initial bounds
    const bounds = map.getBounds()
    onBoundsChange({
      sw_lat: bounds.getSW().lat(),
      sw_lng: bounds.getSW().lng(),
      ne_lat: bounds.getNE().lat(),
      ne_lng: bounds.getNE().lng(),
    })

    // idle event with debounce
    naver.maps.Event.addListener(map, 'idle', () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setZoomTick(map.getZoom())
        const b = map.getBounds()
        onBoundsChange({
          sw_lat: b.getSW().lat(),
          sw_lng: b.getSW().lng(),
          ne_lat: b.getNE().lat(),
          ne_lng: b.getNE().lng(),
        })
      }, 500)
    })

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [sdkLoaded, onBoundsChange])

  // Update markers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !sdkLoaded) return

    // Clear old markers
    markerListenersRef.current.forEach(l => naver.maps.Event.removeListener(l))
    markerListenersRef.current = []
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    restaurantMarkerMapRef.current.clear()

    // 화면에서 56px 안에 겹치는 가게끼리 묶는다(줌과 무관하게 핀이 겹치지 않게)
    const zoom = map.getZoom()
    const el = mapElRef.current
    const bnd = map.getBounds()
    const degPerPx = el && el.clientWidth ? (bnd.getNE().lng() - bnd.getSW().lng()) / el.clientWidth : 0
    const radius = zoom >= 16 || !degPerPx ? 0 : degPerPx * 56
    // 위도는 경도보다 화면에서 길게 보인다(한국 위도 기준 약 1.25배)
    const latScale = Math.cos((36.5 * Math.PI) / 180)

    const validRestaurants = restaurants.filter(r => r.lat && r.lng)
    const clusters: { lat: number; lng: number; items: typeof validRestaurants }[] = []
    for (const r of validRestaurants) {
      const hit = radius
        ? clusters.find(c => Math.abs(c.lng - r.lng!) < radius && Math.abs(c.lat - r.lat!) < radius * latScale)
        : undefined
      if (hit) hit.items.push(r)
      else clusters.push({ lat: r.lat!, lng: r.lng!, items: [r] })
    }
    const groups = clusters.map(c => c.items)

    const newMarkers: naver.maps.Marker[] = []

    groups.forEach((clusterItems) => {
      if (clusterItems.length === 1) {
        const restaurant = clusterItems[0]
        const faces = Array.from(new Map((restaurant.videos ?? []).map(v => [v.channel_id, v.channel_thumbnail ?? ''])).values()).slice(0, 3)
        const selected = restaurant.id === focusedRestaurantId
        const ring = selected ? '#FFE14D' : '#FFFFFF'
        const size = selected ? 44 : 36
        const step = 12
        const width = size + step * (faces.length - 1)
        const faceHtml = faces.map((src, i) => {
          const inner = src
            ? `<img src="${escapeAttr(src)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
            : `<div style="width:100%;height:100%;background:#E5E8EB;"></div>`
          return `<div style="position:absolute;top:0;left:${i * step}px;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:3px solid ${ring};box-sizing:border-box;background:#fff;z-index:${3 - i};box-shadow:0 1px 4px rgba(0,0,0,0.25);">${inner}</div>`
        }).join('')
        const tail = `<div style="position:absolute;left:${size / 2 - 5}px;top:${size - 2}px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${ring};"></div>`
        const content = `<div role="button" aria-label="${escapeAttr(restaurant.name)}" style="position:relative;width:${width}px;height:${size + 6}px;cursor:pointer;">${faceHtml}${tail}</div>`

        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(restaurant.lat!, restaurant.lng!),
          map,
          zIndex: selected ? 100 : 1,
          icon: {
            content,
            size: new naver.maps.Size(width, size + 6),
            anchor: new naver.maps.Point(size / 2, size + 5),
          },
        })

        restaurantMarkerMapRef.current.set(restaurant.id, marker)
        markerListenersRef.current.push(
          naver.maps.Event.addListener(marker, 'click', () => {
            onMarkerClick(restaurant.id)
          })
        )
        newMarkers.push(marker)
      } else {
        const avgLat = clusterItems.reduce((s: number, r: { lat: number | null }) => s + r.lat!, 0) / clusterItems.length
        const avgLng = clusterItems.reduce((s: number, r: { lng: number | null }) => s + r.lng!, 0) / clusterItems.length
        const count = clusterItems.length
        const size = count >= 50 ? 52 : count >= 10 ? 44 : 38

        const clusterContent = `<div role="button" aria-label="가게 ${count}곳" style="width:${size}px;height:${size}px;border-radius:50%;background:#1B1D1F;color:#fff;border:3px solid #fff;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font:700 ${size >= 44 ? 15 : 13}px 'Pretendard Variable',sans-serif;cursor:pointer;">${count}</div>`

        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(avgLat, avgLng),
          map,
          icon: {
            content: clusterContent,
            size: new naver.maps.Size(size, size),
            anchor: new naver.maps.Point(size / 2, size / 2),
          },
        })

        markerListenersRef.current.push(
          naver.maps.Event.addListener(marker, 'click', () => {
            const lats = clusterItems.map(r => r.lat!)
            const lngs = clusterItems.map(r => r.lng!)
            const sw = new naver.maps.LatLng(Math.min(...lats), Math.min(...lngs))
            const ne = new naver.maps.LatLng(Math.max(...lats), Math.max(...lngs))
            map.fitBounds(new naver.maps.LatLngBounds(sw, ne), 80)
          })
        )
        newMarkers.push(marker)
      }
    })

    markersRef.current = newMarkers
  }, [restaurants, sdkLoaded, onMarkerClick, focusedRestaurantId, zoomTick])

  // Focus on restaurant when focusedRestaurantId changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusedRestaurantId) return

    const restaurant = restaurants.find((r) => r.id === focusedRestaurantId)
    if (!restaurant || !restaurant.lat || !restaurant.lng) return

    const pos = new naver.maps.LatLng(restaurant.lat, restaurant.lng)

    const marker = restaurantMarkerMapRef.current.get(focusedRestaurantId)
    if (marker) {
      // 개별 마커 있음 → 이동
      map.morph(pos, Math.max(map.getZoom(), 13), { duration: 500 })
    } else {
      // 클러스터에 묶여있음 → 줌 인하면 개별 마커 생성됨
      // 묶음을 푸는 줌(16)까지 들어가야 고른 핀이 따로 보인다
      map.morph(pos, 16, { duration: 500 })
    }
  }, [focusedRestaurantId, restaurants])

  // Fit bounds to markers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !fitToMarkers || restaurants.length === 0) return

    const validRestaurants = restaurants.filter((r) => r.lat && r.lng)
    if (validRestaurants.length === 0) return

    const bounds = new naver.maps.LatLngBounds(
      new naver.maps.LatLng(
        Math.min(...validRestaurants.map((r) => r.lat!)),
        Math.min(...validRestaurants.map((r) => r.lng!))
      ),
      new naver.maps.LatLng(
        Math.max(...validRestaurants.map((r) => r.lat!)),
        Math.max(...validRestaurants.map((r) => r.lng!))
      )
    )
    map.fitBounds(bounds, 60)
    onFitComplete?.()
  }, [fitToMarkers, restaurants, onFitComplete])

  return (
    <div ref={mapElRef} className="h-full w-full">
      {!sdkLoaded && !sdkError && (
        <div className="flex h-full items-center justify-center bg-well text-body text-sub">
          지도를 불러오는 중
        </div>
      )}
      {sdkError && (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-well text-body text-sub">
          <span>지도를 불러오지 못했어요. 네트워크를 확인하고 다시 시도하세요.</span>
          <button
            onClick={() => window.location.reload()}
            className="min-h-[44px] px-3 font-bold text-ink underline"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  )
}

function escapeAttr(s: string) {
  return s.replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]!))
}
