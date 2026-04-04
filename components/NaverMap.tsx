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
}

export default function NaverMap({
  onBoundsChange,
  restaurants,
  onMarkerClick,
  selectedChannels,
  fitToMarkers,
}: NaverMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<naver.maps.Map | null>(null)
  const markersRef = useRef<naver.maps.Marker[]>([])
  const infoWindowRef = useRef<naver.maps.InfoWindow | null>(null)
  const clusterRef = useRef<{ setMap(map: naver.maps.Map | null): void } | null>(null)
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      }, 300)
    })
  }, [sdkLoaded, onBoundsChange])

  // Channel color map
  const getChannelColor = useCallback((channelId: string) => {
    if (selectedChannels.length === 0) return MARKER_COLORS[0]
    const idx = selectedChannels.indexOf(channelId)
    return MARKER_COLORS[idx >= 0 ? idx % MARKER_COLORS.length : 0]
  }, [selectedChannels])

  // Update markers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !sdkLoaded) return

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    if (clusterRef.current) {
      clusterRef.current.setMap(null)
      clusterRef.current = null
    }
    if (infoWindowRef.current) {
      infoWindowRef.current.close()
    }

    const newMarkers: naver.maps.Marker[] = []

    for (const restaurant of restaurants) {
      if (!restaurant.lat || !restaurant.lng) continue

      const mainVideo = restaurant.videos?.[0]
      const color = mainVideo ? getChannelColor(mainVideo.channel_id) : MARKER_COLORS[0]

      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(restaurant.lat, restaurant.lng),
        map,
        icon: {
          content: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:11px;font-weight:bold;">${restaurant.videos?.length || 0}</span>
          </div>`,
          size: new naver.maps.Size(28, 28),
          anchor: new naver.maps.Point(14, 14),
        },
      })

      naver.maps.Event.addListener(marker, 'click', () => {
        if (infoWindowRef.current) infoWindowRef.current.close()

        const videos = restaurant.videos || []
        const videoItems = videos.slice(0, 3).map((v) => {
          const ytUrl = `https://youtube.com/watch?v=${v.video_id}${v.timestamp_seconds ? `&t=${v.timestamp_seconds}` : ''}`
          return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
            ${v.channel_thumbnail ? `<img src="${v.channel_thumbnail}" style="width:20px;height:20px;border-radius:50%;" />` : ''}
            <span style="font-size:11px;color:#636366;">${v.channel_name || ''}</span>
            <span style="font-size:10px;padding:1px 4px;border-radius:3px;background:${v.rating === '강력추천' ? '#FF6B35' : v.rating === '추천' ? '#34C759' : '#E5E5EA'};color:${v.rating === '강력추천' || v.rating === '추천' ? 'white' : '#636366'};">${v.rating || ''}</span>
            <a href="${ytUrl}" target="_blank" style="font-size:10px;color:#2196F3;text-decoration:none;">영상보기</a>
          </div>`
        }).join('')

        const naverMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent((restaurant.name || '') + ' ' + (restaurant.address || ''))}`

        const content = `<div style="max-width:280px;padding:14px;font-family:'Pretendard Variable',sans-serif;">
          <h3 style="font-size:15px;font-weight:700;color:#1A1A2E;margin:0;">${restaurant.name}</h3>
          <p style="font-size:12px;color:#8E8E93;margin:4px 0 8px;">${restaurant.category} · ${restaurant.region || ''}</p>
          ${videoItems}
          <div style="display:flex;gap:6px;margin-top:10px;">
            <a href="/restaurant/${restaurant.id}" style="font-size:11px;padding:4px 10px;background:#FF6B35;color:white;border-radius:6px;text-decoration:none;">상세보기</a>
            <a href="${naverMapUrl}" target="_blank" style="font-size:11px;padding:4px 10px;background:#34C759;color:white;border-radius:6px;text-decoration:none;">네이버지도</a>
          </div>
        </div>`

        const iw = new naver.maps.InfoWindow({
          content,
          borderWidth: 0,
          backgroundColor: 'white',
          anchorSize: new naver.maps.Size(12, 12),
          pixelOffset: new naver.maps.Point(0, -4),
          maxWidth: 300,
        })
        iw.open(map, marker)
        infoWindowRef.current = iw

        onMarkerClick(restaurant.id)
      })

      newMarkers.push(marker)
    }

    // Clustering if 50+ markers
    if (newMarkers.length >= 50 && typeof window.MarkerClustering !== 'undefined') {
      newMarkers.forEach((m) => m.setMap(null))
      clusterRef.current = new window.MarkerClustering({
        minClusterSize: 3,
        maxZoom: 16,
        map,
        markers: newMarkers,
        gridSize: 120,
        stylingFunction: (clusterMarker, count) => {
          clusterMarker.innerHTML = `<div style="width:36px;height:36px;border-radius:50%;background:#FF6B35;color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.2);">${count}</div>`
        },
      })
    }

    markersRef.current = newMarkers
  }, [restaurants, sdkLoaded, getChannelColor, onMarkerClick])

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
        <div className="flex h-full items-center justify-center bg-gray-100 text-sm text-gray-400">
          지도를 불러오는 중...
        </div>
      )}
    </div>
  )
}
