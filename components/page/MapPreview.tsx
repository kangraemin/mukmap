'use client'
// 목록 페이지 위의 지도 미리보기. 손으로 밀거나 확대할 수 없고, 누르면 같은 조건의 전체 지도를 연다.
// 지도를 밀면 목록이 바뀌는 식으로 만들지 않는다: 페이지 제목과 내용이 어긋나고, 휴대폰에선 페이지 스크롤과 부딪힌다
import { useEffect, useRef, useState } from 'react'
import { preloadMapSdk } from '@/components/NaverMap'

interface Spot { lat: number; lng: number }

interface MapPreviewProps {
  spots: Spot[]
  href: string
}

// 수천 곳이어도 무겁지 않게 점 개수를 자른다. 미리보기라 위치 감만 주면 된다
const MAX_DOTS = 300
const DOT = 12

const dotIcon = () => ({
  content: `<div style="width:${DOT}px;height:${DOT}px;border-radius:50%;background:#1B1D1F;border:2px solid #fff;box-sizing:border-box;box-shadow:0 1px 3px rgba(27,29,31,0.35);"></div>`,
  anchor: new naver.maps.Point(DOT / 2, DOT / 2),
})

export default function MapPreview({ spots, href }: MapPreviewProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<naver.maps.Map | null>(null)
  const dotsRef = useRef<naver.maps.Marker[]>([])
  const [ready, setReady] = useState(false)

  // 글과 카드가 먼저 그려지게, 브라우저가 한가해진 뒤에 지도 스크립트를 붙인다
  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | undefined
    const start = () => {
      if (!preloadMapSdk()) return
      poll = setInterval(() => {
        if ((window as Window & { naver?: { maps?: unknown } }).naver?.maps) {
          clearInterval(poll)
          setReady(true)
        }
      }, 100)
    }
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    const t = w.requestIdleCallback ? (w.requestIdleCallback(start, { timeout: 1500 }), undefined) : setTimeout(start, 300)
    const stop = setTimeout(() => clearInterval(poll), 15000)
    return () => {
      if (t) clearTimeout(t)
      clearTimeout(stop)
      clearInterval(poll)
    }
  }, [])

  useEffect(() => {
    const el = elRef.current
    if (!ready || !el) return
    if (!mapRef.current) {
      mapRef.current = new naver.maps.Map(el, {
        draggable: false,
        pinchZoom: false,
        scrollWheel: false,
        keyboardShortcuts: false,
        disableDoubleClickZoom: true,
        disableDoubleTapZoom: true,
        disableTwoFingerTapZoom: true,
        zoomControl: false,
        scaleControl: false,
        mapDataControl: false,
      })
      // 테스트가 지도를 읽는다
      ;(el as HTMLDivElement & { __map?: naver.maps.Map }).__map = mapRef.current
    }
    const map = mapRef.current
    for (const m of dotsRef.current) m.setMap(null)
    const shown = spots.slice(0, MAX_DOTS)
    dotsRef.current = shown.map((s) => new naver.maps.Marker({ map, position: new naver.maps.LatLng(s.lat, s.lng), icon: dotIcon(), clickable: false }))
    el.dataset.dots = String(shown.length)
    if (!shown.length) return
    if (shown.length === 1) {
      map.setCenter(new naver.maps.LatLng(shown[0].lat, shown[0].lng))
      map.setZoom(15)
      return
    }
    const lats = shown.map((s) => s.lat)
    const lngs = shown.map((s) => s.lng)
    const bounds = new naver.maps.LatLngBounds(
      new naver.maps.LatLng(Math.min(...lats), Math.min(...lngs)),
      new naver.maps.LatLng(Math.max(...lats), Math.max(...lngs)),
    )
    map.fitBounds(bounds, 24)
  }, [ready, spots])

  return (
    // 자리를 먼저 잡아 두어 지도가 늦게 떠도 글이 밀려 내려가지 않는다
    <div data-testid="map-preview" className="relative mt-4 h-[180px] overflow-hidden rounded-card bg-well">
      {/* 네이버 지도가 이 칸을 position:relative로 바꿔 inset으로 잡은 높이가 0이 됐다. 높이를 직접 준다 */}
      <div ref={elRef} aria-hidden="true" className="h-full w-full" />
      {/* 지도 위를 덮는 링크. 지도 자체는 손에 반응하지 않고, 어디를 눌러도 전체 지도로 간다. 버튼은 오른쪽 아래 NAVER 로고를 가리지 않게 위에 둔다 */}
      <a href={href} data-testid="map-preview-link" aria-label="지도에서 크게 보기" className="absolute inset-0 z-10 flex items-start justify-end p-3">
        <span className="inline-flex min-h-[36px] items-center rounded-full bg-paper px-3.5 text-meta font-bold text-ink shadow-[0_2px_8px_rgba(27,29,31,0.2)]">
          지도에서 크게 보기
        </span>
      </a>
    </div>
  )
}
