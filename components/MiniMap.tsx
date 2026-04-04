'use client'

import { useEffect, useRef, useState } from 'react'

interface MiniMapProps {
  markers: { lat: number; lng: number; name?: string }[]
  height?: string
}

export default function MiniMap({ markers, height = '300px' }: MiniMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const [sdkLoaded, setSdkLoaded] = useState(false)

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
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`
    script.async = true
    script.onload = () => setSdkLoaded(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!sdkLoaded || !mapElRef.current || markers.length === 0) return

    const center = markers.length === 1
      ? new naver.maps.LatLng(markers[0].lat, markers[0].lng)
      : new naver.maps.LatLng(
          markers.reduce((s, m) => s + m.lat, 0) / markers.length,
          markers.reduce((s, m) => s + m.lng, 0) / markers.length
        )

    const map = new naver.maps.Map(mapElRef.current, {
      center,
      zoom: markers.length === 1 ? 16 : 11,
    })

    for (const m of markers) {
      new naver.maps.Marker({
        position: new naver.maps.LatLng(m.lat, m.lng),
        map,
        icon: {
          content: `<div style="width:24px;height:24px;border-radius:50%;background:#FF6B35;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
          size: new naver.maps.Size(24, 24),
          anchor: new naver.maps.Point(12, 12),
        },
      })
    }

    if (markers.length > 1) {
      const bounds = new naver.maps.LatLngBounds(
        new naver.maps.LatLng(
          Math.min(...markers.map((m) => m.lat)),
          Math.min(...markers.map((m) => m.lng))
        ),
        new naver.maps.LatLng(
          Math.max(...markers.map((m) => m.lat)),
          Math.max(...markers.map((m) => m.lng))
        )
      )
      map.fitBounds(bounds, 40)
    }
  }, [sdkLoaded, markers])

  return (
    <div ref={mapElRef} style={{ width: '100%', height }} className="rounded-xl bg-gray-100">
      {!sdkLoaded && (
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
          지도 로딩중...
        </div>
      )}
    </div>
  )
}
