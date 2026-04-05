'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MARKER_COLORS, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/lib/constants'
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
  const infoWindowRef = useRef<naver.maps.InfoWindow | null>(null)
  // clusterRef removed — using grid-based clustering
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restaurantMarkerMapRef = useRef<Map<number, naver.maps.Marker>>(new Map())

  // Load SDK
  useEffect(() => {
    if (typeof window !== 'undefined' && window.naver?.maps) {
      setSdkLoaded(true)
      return
    }

    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
    if (!clientId) return

    const existing = document.querySelector('script[src*="oapi.map.naver.com"]')
    if (existing) {
      existing.addEventListener('load', () => setSdkLoaded(true))
      return
    }

    const script = document.createElement('script')
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`
    script.async = true
    script.onload = () => setSdkLoaded(true)
    document.head.appendChild(script)
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

    // 지도 빈 곳 클릭 → 인포윈도우 닫기
    naver.maps.Event.addListener(map, 'click', () => {
      if (infoWindowRef.current) infoWindowRef.current.close()
    })

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
    if (selectedChannels.length === 0) return MARKER_COLORS[0]
    const idx = selectedChannels.indexOf(channelId)
    return MARKER_COLORS[idx >= 0 ? idx % MARKER_COLORS.length : 0]
  }, [selectedChannels])

  // Helper to build infowindow content
  const buildInfoWindowContent = useCallback((restaurant: RestaurantWithVideos) => {
    const videos = restaurant.videos || []
    const mainVideo = videos[0]
    const thumbnailHtml = mainVideo?.thumbnail_url
      ? `<img src="${mainVideo.thumbnail_url}" style="width:100%;border-radius:8px;margin-bottom:8px;object-fit:cover;max-height:140px;" />`
      : ''

    const ratingBadgeStyle = (rating: string | null) => {
      switch (rating) {
        case '강력추천': return 'background:#a63300;color:white;'
        case '추천': return 'background:#ff7949;color:white;'
        case '보통': return 'background:#ffdad7;color:#4e211e;'
        case '비추': return 'background:#b31b25;color:white;'
        default: return 'background:#ffdad7;color:#4e211e;'
      }
    }

    const videoItems = videos.slice(0, 3).map((v) => {
      const ytUrl = `https://youtube.com/watch?v=${v.video_id}${v.timestamp_seconds ? `&t=${v.timestamp_seconds}` : ''}`
      return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
        ${v.channel_thumbnail ? `<img src="${v.channel_thumbnail}" style="width:20px;height:20px;border-radius:50%;" />` : ''}
        <span style="font-size:11px;color:#834c48;">${v.channel_name || ''}</span>
        <span style="font-size:10px;padding:2px 6px;border-radius:4px;${ratingBadgeStyle(v.rating)}">${v.rating || ''}</span>
        <a href="${ytUrl}" target="_blank" style="font-size:10px;color:#ff7949;text-decoration:underline;background:transparent;">영상보기</a>
      </div>`
    }).join('')

    const naverMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent((restaurant.name || '') + ' ' + (restaurant.address || ''))}`

    return `<div style="max-width:280px;padding:16px;font-family:'Plus Jakarta Sans','Pretendard Variable',sans-serif;background:#ffffff;border-radius:12px;box-shadow:0 4px 24px rgba(78,33,30,0.12);">
      ${thumbnailHtml}
      <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:700;color:#4e211e;margin:0;">${restaurant.name}</h3>
      <p style="font-size:12px;color:#834c48;margin:4px 0 8px;">${restaurant.category}${restaurant.region ? ' · ' + restaurant.region : ''}</p>
      ${videoItems}
      <div style="display:flex;gap:6px;margin-top:12px;">
        <a href="/restaurant/${restaurant.id}" style="font-size:11px;padding:6px 12px;background:linear-gradient(135deg,#a63300,#ff7949);color:white;border-radius:8px;text-decoration:none;font-weight:600;">상세보기</a>
        <a href="${naverMapUrl}" target="_blank" style="font-size:11px;padding:6px 12px;background:#ffedeb;color:#a63300;border-radius:8px;text-decoration:none;font-weight:600;">네이버지도</a>
      </div>
    </div>`
  }, [])

  // Open infowindow for a given restaurant
  const openInfoWindow = useCallback((restaurant: RestaurantWithVideos, marker: naver.maps.Marker) => {
    const map = mapRef.current
    if (!map) return

    if (infoWindowRef.current) infoWindowRef.current.close()

    const content = buildInfoWindowContent(restaurant)
    const iw = new naver.maps.InfoWindow({
      content,
      borderWidth: 0,
      backgroundColor: 'transparent',
      anchorSize: new naver.maps.Size(12, 12),
      pixelOffset: new naver.maps.Point(0, -4),
      maxWidth: 300,
    })
    iw.open(map, marker)
    infoWindowRef.current = iw
  }, [buildInfoWindowContent])

  // Update markers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !sdkLoaded) return

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    restaurantMarkerMapRef.current.clear()
    // 이전 마커 정리는 위에서 처리
    if (infoWindowRef.current) {
      infoWindowRef.current.close()
    }

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

    groups.forEach((group) => {
      if (group.length === 1) {
        const restaurant = group[0]
        const mainVideo = restaurant.videos?.[0]
        const color = mainVideo ? getChannelColor(mainVideo.channel_id) : MARKER_COLORS[0]

        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(restaurant.lat!, restaurant.lng!),
          map,
          icon: {
            content: `<div style="cursor:pointer;">
              <svg width="32" height="40" viewBox="0 0 32 40">
                <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="${color}"/>
                <circle cx="16" cy="16" r="8" fill="white"/>
              </svg>
            </div>`,
            size: new naver.maps.Size(32, 40),
            anchor: new naver.maps.Point(16, 40),
          },
        })

        restaurantMarkerMapRef.current.set(restaurant.id, marker)
        naver.maps.Event.addListener(marker, 'click', () => {
          openInfoWindow(restaurant, marker)
          onMarkerClick(restaurant.id)
        })
        newMarkers.push(marker)
      } else {
        const avgLat = group.reduce((s: number, r: { lat: number | null }) => s + r.lat!, 0) / group.length
        const avgLng = group.reduce((s: number, r: { lng: number | null }) => s + r.lng!, 0) / group.length
        const count = group.length

        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(avgLat, avgLng),
          map,
          icon: {
            content: `<div style="cursor:pointer;width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#FF6B35,#FF8C5A);color:white;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 3px 12px rgba(255,107,53,0.4);border:2.5px solid white;">${count}</div>`,
            size: new naver.maps.Size(44, 44),
            anchor: new naver.maps.Point(22, 22),
          },
        })

        naver.maps.Event.addListener(marker, 'click', () => {
          if (infoWindowRef.current) infoWindowRef.current.close()
          map.morph(new naver.maps.LatLng(avgLat, avgLng), Math.min(zoom + 3, 16), { duration: 500 })
        })
        newMarkers.push(marker)
      }
    })

    markersRef.current = newMarkers
  }, [restaurants, sdkLoaded, getChannelColor, onMarkerClick, openInfoWindow])

  // Focus on restaurant when focusedRestaurantId changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusedRestaurantId) return

    const restaurant = restaurants.find((r) => r.id === focusedRestaurantId)
    if (!restaurant || !restaurant.lat || !restaurant.lng) return

    if (infoWindowRef.current) infoWindowRef.current.close()
    const pos = new naver.maps.LatLng(restaurant.lat, restaurant.lng)

    const marker = restaurantMarkerMapRef.current.get(focusedRestaurantId)
    if (marker) {
      // 개별 마커 있음 → 이동 + 인포윈도우
      map.morph(pos, Math.max(map.getZoom(), 13), { duration: 500 })
      setTimeout(() => openInfoWindow(restaurant, marker), 600)
    } else {
      // 클러스터에 묶여있음 → 줌 인하면 개별 마커 생성됨
      map.morph(pos, 15, { duration: 500 })
      // 줌 완료 후 마커 찾아서 인포윈도우
      setTimeout(() => {
        const m = restaurantMarkerMapRef.current.get(focusedRestaurantId)
        if (m) openInfoWindow(restaurant, m)
      }, 1500)
    }
  }, [focusedRestaurantId, restaurants, openInfoWindow])

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
        <div className="flex h-full items-center justify-center bg-surface-low text-sm text-on-surface-variant">
          지도를 불러오는 중...
        </div>
      )}
    </div>
  )
}
