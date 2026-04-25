'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getChannelHue, channelColor, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/lib/constants'
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
  selectedChannels: string[]
  fitToMarkers?: boolean
  focusedRestaurantId?: number | null
}

export default function NaverMap({
  onBoundsChange,
  restaurants,
  onMarkerClick,
  selectedChannels,
  fitToMarkers,
  focusedRestaurantId,
}: NaverMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<naver.maps.Map | null>(null)
  const markersRef = useRef<naver.maps.Marker[]>([])
  // clusterRef removed — using grid-based clustering
  const [sdkLoaded, setSdkLoaded] = useState(false)
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
    const poll = setInterval(() => {
      if ((window as Window & { naver?: { maps?: unknown } }).naver?.maps) {
        clearInterval(poll)
        setSdkLoaded(true)
      }
    }, 100)
    return () => clearInterval(poll)
  }, [])

  // Init map
  useEffect(() => {
    if (!sdkLoaded || !mapElRef.current || mapRef.current) return

    const map = new naver.maps.Map(mapElRef.current, {
      center: new naver.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT },
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
        const b = map.getBounds()
        onBoundsChange({
          sw_lat: b.getSW().lat(),
          sw_lng: b.getSW().lng(),
          ne_lat: b.getNE().lat(),
          ne_lng: b.getNE().lng(),
        })
      }, 500)
    })
  }, [sdkLoaded, onBoundsChange])

  // Channel color map
  const getChannelColor = useCallback((channelId: string) => {
    const idx = selectedChannels.indexOf(channelId)
    const hue = getChannelHue(channelId, idx >= 0 ? idx : 0)
    return channelColor(hue)
  }, [selectedChannels])

  // Update markers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !sdkLoaded) return

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    restaurantMarkerMapRef.current.clear()

    // 줌 레벨 기반 그리드 클러스터링
    const zoom = map.getZoom()
    const gridSize = zoom <= 8 ? 0.5 : zoom <= 10 ? 0.2 : zoom <= 12 ? 0.05 : zoom <= 14 ? 0.01 : 0

    const validRestaurants = restaurants.filter(r => r.lat && r.lng)
    const groups: Map<string, typeof validRestaurants> = new Map()

    if (gridSize > 0) {
      for (const r of validRestaurants) {
        const key = `${Math.round(r.lat! / gridSize)}_${Math.round(r.lng! / gridSize)}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(r)
      }
    } else {
      for (const r of validRestaurants) {
        groups.set(`s_${r.id}`, [r])
      }
    }

    const newMarkers: naver.maps.Marker[] = []

    groups.forEach((clusterItems) => {
      if (clusterItems.length === 1) {
        const restaurant = clusterItems[0]
        const mainVideo = restaurant.videos?.[0]
        const color = mainVideo ? getChannelColor(mainVideo.channel_id) : channelColor(18)

        const isTopRated = restaurant.videos?.some(v => v.rating === '강력추천')
        const thumbnail = mainVideo?.channel_thumbnail ?? ''
        const badgeHtml = isTopRated
          ? `<div style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:#D9614A;border-radius:50%;border:1.5px solid #fff;font-size:10px;display:flex;align-items:center;justify-content:center;line-height:1;">🔥</div>`
          : ''
        const avatarHtml = thumbnail
          ? `<img src="${thumbnail}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
          : `<div style="width:100%;height:100%;border-radius:50%;background:${color};"></div>`

        const content = `<div style="position:relative;width:40px;height:46px;cursor:pointer;">
  <div style="position:absolute;top:0;left:2px;width:36px;height:36px;border-radius:50% 50% 50% 0;background:#fff;transform:rotate(-45deg);border:2px solid ${color};box-shadow:0 2px 6px rgba(0,0,0,0.22);display:flex;align-items:center;justify-content:center;">
    <div style="transform:rotate(45deg);width:26px;height:26px;overflow:hidden;border-radius:50%;">
      ${avatarHtml}
    </div>
  </div>
  ${badgeHtml}
  <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:8px;height:3px;border-radius:50%;background:rgba(0,0,0,0.2);filter:blur(1px);"></div>
</div>`

        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(restaurant.lat!, restaurant.lng!),
          map,
          icon: {
            content,
            size: new naver.maps.Size(40, 46),
            anchor: new naver.maps.Point(2, 34),
          },
        })

        restaurantMarkerMapRef.current.set(restaurant.id, marker)
        naver.maps.Event.addListener(marker, 'click', () => {
          onMarkerClick(restaurant.id)
        })
        newMarkers.push(marker)
      } else {
        const avgLat = clusterItems.reduce((s: number, r: { lat: number | null }) => s + r.lat!, 0) / clusterItems.length
        const avgLng = clusterItems.reduce((s: number, r: { lng: number | null }) => s + r.lng!, 0) / clusterItems.length
        const count = clusterItems.length

        // 클러스터 내 채널별 count 집계 → 상위 4개 stripe
        const chCountMap = new Map<string, number>()
        for (const r of clusterItems) {
          for (const v of (r.videos ?? [])) {
            chCountMap.set(v.channel_id, (chCountMap.get(v.channel_id) ?? 0) + 1)
          }
        }
        const topChannels = Array.from(chCountMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([id], idx) => ({ hue: getChannelHue(id, idx) }))

        const primaryHue = topChannels[0]?.hue ?? 28
        const hasMust = clusterItems.some(r => r.videos?.some(v => v.rating === '강력추천'))
        const size = count >= 10 ? 56 : count >= 5 ? 48 : 42

        const stripeHtml = topChannels
          .map(ch => `<div style="flex:1;background:${channelColor(ch.hue)};"></div>`)
          .join('')

        const mustBadgeHtml = hasMust
          ? `<div style="position:absolute;top:-3px;right:-3px;width:18px;height:18px;border-radius:50%;background:#D9614A;color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid #fff;font-size:10px;line-height:1;">🔥</div>`
          : ''

        const clusterContent = `<div style="position:relative;width:${size + 12}px;height:${size + 12}px;cursor:pointer;">
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
    <div style="position:relative;width:${size}px;height:${size}px;">
      <div style="position:absolute;inset:-6px;border-radius:50%;background:${hasMust ? 'rgba(217,97,74,0.18)' : 'rgba(15,13,8,0.08)'};"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.18);border:2px solid ${channelColor(primaryHue)};display:flex;align-items:center;justify-content:center;flex-direction:column;overflow:hidden;">
        <div style="font-size:${size >= 56 ? 18 : size >= 48 ? 16 : 14}px;font-weight:800;color:#0F0D08;letter-spacing:-0.03em;line-height:1;margin-top:-1px;">${count}</div>
        <div style="font-size:8.5px;font-weight:600;color:#9A8E78;letter-spacing:0.02em;margin-top:2px;">맛집</div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:4px;display:flex;">${stripeHtml}</div>
      </div>
      ${mustBadgeHtml}
    </div>
  </div>
</div>`

        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(avgLat, avgLng),
          map,
          icon: {
            content: clusterContent,
            size: new naver.maps.Size(size + 12, size + 12),
            anchor: new naver.maps.Point((size + 12) / 2, (size + 12) / 2),
          },
        })

        naver.maps.Event.addListener(marker, 'click', () => {
          map.morph(new naver.maps.LatLng(avgLat, avgLng), Math.min(zoom + 3, 16), { duration: 500 })
        })
        newMarkers.push(marker)
      }
    })

    markersRef.current = newMarkers
  }, [restaurants, sdkLoaded, getChannelColor, onMarkerClick])

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
      map.morph(pos, 15, { duration: 500 })
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
  }, [fitToMarkers, restaurants])

  return (
    <div ref={mapElRef} className="h-full w-full">
      {!sdkLoaded && (
        <div className="flex h-full items-center justify-center bg-surface-low text-sm text-ink-muted">
          지도를 불러오는 중...
        </div>
      )}
    </div>
  )
}
