'use client'

import { useEffect, useRef, useState } from 'react'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/lib/constants'
import { faceSrc, type Bounds, type Pin } from '@/lib/pins'
import { KO_UI, type UiText } from '@/lib/ui-text'

export interface Face {
  name: string
  thumbnail: string | null
}

/** 가게 하나, 한 점(역 등, 줌 생략 시 16), 또는 여러 점이 다 보이게(구·시) */
export type MapFocus = { seq: number } & ({ id: number } | { lat: number; lng: number; zoom?: number } | { lats: number[]; lngs: number[] })

interface NaverMapProps {
  /** 거르기가 끝난 핀 전체. 화면 안에 든 것만 그린다 */
  pins: Pin[]
  faces: Record<string, Face>
  selectedId: number | null
  onPinClick: (id: number) => void
  onMapClick: () => void
  onBoundsChange: (b: Bounds) => void
  /** 값이 바뀌면 pins 전체가 보이게 맞춘다 */
  fitKey: number
  /** 값이 바뀌면 이 핀으로 지도를 옮긴다 */
  focus: MapFocus | null
  /** 카드가 떠 있을 때 지도 위·아래가 가려지는 높이(px). 고른 핀을 그 사이 가운데로 옮긴다 */
  insets?: { top: number; bottom: number } | null
  /** 손으로 밀거나 확대하지 못하게 묶는다(목록 페이지 위 작은 지도). 핀과 바탕은 눌린다 */
  still?: boolean
  /** 사람이 손으로 지도를 밀거나 벌렸을 때. 코드가 옮긴 건 알리지 않는다 */
  onUserMove?: () => void
  /** 묶음 핀을 눌렀을 때. 주면 작은 지도 안에서 확대하지 않고 이걸 부른다 */
  onClusterClick?: (lats: number[], lngs: number[]) => void
  /** 지도 아래가 목록 시트로 가려진 높이(px). 핀을 맞출 때 그 위쪽 칸에 맞춘다 */
  fitBottom?: number
  /** 화면 글자. 외국어 첫 화면은 그 언어판 */
  t?: Pick<UiText, 'cluster' | 'mapLoading' | 'mapError' | 'mapRetry'>
  /** 지도 바탕 글자 언어(en·ja·zh) */
  language?: string
}

// 핀끼리 이 거리(px) 안이면 묶는다. 줌과 상관없이 같은 기준이라 얼굴이 겹치지 않는다
const CLUSTER_PX = 64
const FACE = 36
const FACE_SELECTED = 44
const CLUSTER_FACE = 40

function mercY(lat: number) {
  const s = Math.sin((lat * Math.PI) / 180)
  return Math.log((1 + s) / (1 - s)) / 2
}

/** 이 줌에서 핀이 화면 가운데보다 dy(px) 아래에 보이게 하는 지도 중심 */
function centerAbove(lat: number, lng: number, zoom: number, dy: number) {
  const world = 256 * 2 ** zoom
  const y = (0.5 - mercY(lat) / (2 * Math.PI)) * world - dy
  const m = (0.5 - y / world) * 2 * Math.PI
  return new naver.maps.LatLng((Math.atan(Math.sinh(m)) * 180) / Math.PI, lng)
}

function escapeAttr(s: string) {
  return s.replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]!))
}

function faceImg(face: Face | undefined, size: number, ring: string, border: number) {
  const inner = face?.thumbnail
    ? `<img src="${escapeAttr(faceSrc(face.thumbnail))}" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
    : `<div style="width:100%;height:100%;background:#E5E8EB;"></div>`
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:${border}px solid ${ring};box-sizing:border-box;background:#fff;box-shadow:0 2px 8px rgba(27,29,31,0.25);">${inner}</div>`
}

function badge(text: string) {
  return `<div style="position:absolute;top:-4px;right:-8px;min-width:20px;height:20px;padding:0 6px;box-sizing:border-box;border-radius:10px;background:#1B1D1F;color:#fff;border:2px solid #fff;font:700 11px/16px 'Pretendard Variable',sans-serif;text-align:center;">${text}</div>`
}

function singleIcon(pin: Pin, faces: Record<string, Face>, selected: boolean): naver.maps.MarkerIcon {
  const size = selected ? FACE_SELECTED : FACE
  const ring = selected ? '#FFE14D' : '#FFFFFF'
  const more = pin.ch.length > 1 ? badge(`+${pin.ch.length - 1}`) : ''
  const tail = `<div style="position:absolute;left:${size / 2 - 6}px;top:${size - 2}px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${ring};"></div>`
  const content = `<div class="mk-pop" role="button" aria-label="${escapeAttr(pin.name)}" data-pin="${pin.id}" style="position:relative;width:${size}px;height:${size + 8}px;cursor:pointer;">${faceImg(faces[pin.ch[0]], size, ring, selected ? 3 : 2)}${tail}${more}</div>`
  return { content, size: new naver.maps.Size(size, size + 8), anchor: new naver.maps.Point(size / 2, size + 6) }
}

function clusterIcon(items: Pin[], faces: Record<string, Face>, label: string): naver.maps.MarkerIcon {
  // 대표 얼굴: 이 묶음에서 가장 많이 다녀간 유튜버
  const tally = new Map<string, number>()
  for (const p of items) for (const c of p.ch) tally.set(c, (tally.get(c) || 0) + 1)
  const top = Array.from(tally.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
  const count = items.length > 999 ? '999+' : String(items.length)
  const content = `<div class="mk-pop" role="button" aria-label="${label}" data-cluster="${items.length}" style="position:relative;width:${CLUSTER_FACE}px;height:${CLUSTER_FACE}px;cursor:pointer;">${faceImg(top ? faces[top] : undefined, CLUSTER_FACE, '#FFFFFF', 2)}${badge(count)}</div>`
  return { content, size: new naver.maps.Size(CLUSTER_FACE, CLUSTER_FACE), anchor: new naver.maps.Point(CLUSTER_FACE / 2, CLUSTER_FACE / 2) }
}

// 지도가 아직 자리를 못 잡았으면 네이버 SDK 안에서 터진다(토스 웹뷰, 유튜버 목록을 못 받은 채 오래 둘 때). 그땐 건너뛴다
function readBounds(map: naver.maps.Map): Bounds | null {
  try {
    const b = map.getBounds()
    return { sw_lat: b.getSW().lat(), sw_lng: b.getSW().lng(), ne_lat: b.getNE().lat(), ne_lng: b.getNE().lng() }
  } catch {
    return null
  }
}

function sendBounds(map: naver.maps.Map, on: (b: Bounds) => void) {
  const b = readBounds(map)
  if (b) on(b)
}

/** 지도 스크립트를 미리 붙인다. 토스 앱은 화면을 그리기 전에 부른다 */
/** 여러 점이 다 보이는 줌. fitBounds는 순간 이동이라, 같은 줌을 구해 morph로 날아간다 */
function boundsZoom(map: naver.maps.Map, lats: number[], lngs: number[], pad: number, bottom = 0): number {
  const merc = (lat: number) => { const s = Math.sin((lat * Math.PI) / 180); return Math.log((1 + s) / (1 - s)) / 2 }
  const size = map.getSize()
  const lngFrac = Math.max((Math.max(...lngs) - Math.min(...lngs)) / 360, 1e-9)
  const latFrac = Math.max((merc(Math.max(...lats)) - merc(Math.min(...lats))) / (2 * Math.PI), 1e-9)
  const z = Math.min(
    Math.log2((size.width - pad * 2) / 256 / lngFrac),
    Math.log2(Math.max(size.height - pad * 2 - bottom, 80) / 256 / latFrac),
  )
  return Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Math.floor(z)))
}

function flyToFit(map: naver.maps.Map, lats: number[], lngs: number[], pad: number, bottom = 0) {
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2
  const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2
  const zoom = boundsZoom(map, lats, lngs, pad, bottom)
  // 아래가 가려져 있으면 남은 위쪽 칸 가운데에 둔다
  map.morph(bottom ? centerAbove(lat, lng, zoom, -bottom / 2) : new naver.maps.LatLng(lat, lng), zoom, { duration: 600, easing: 'easeOutCubic' })
}

/** 핀을 눌렀을 때 갈 줌. 전국 지도(7)에서 한 번에 15까지 당기면 흐린 타일이 수백 배로 커지며 지도가 앞으로 확 덮쳐 왔다(10/25).
 * 한 번에 세 단계까지만 당기고, 이미 가까우면 그대로 둔다 */
export function tapZoom(z: number) {
  return Math.max(z, Math.min(15, Math.floor(z) + 3))
}

// 앞 움직임이 막 끝난 참에 morph를 부르면 네이버 지도가 가끔 그냥 삼킨다(역을 눌렀는데 전국 지도 그대로).
// 멈췄을 때 목표 줌에 못 갔으면 한 번 더 보낸다
function morphSure(map: naver.maps.Map, center: naver.maps.LatLng, zoom: number, duration: number) {
  map.morph(center, zoom, { duration, easing: 'easeOutCubic' })
  const l = naver.maps.Event.addListener(map, 'idle', () => {
    naver.maps.Event.removeListener(l)
    if (map.getZoom() !== zoom) map.morph(center, zoom, { duration, easing: 'easeOutCubic' })
  })
}

export const mapSdkUrl = (clientId: string | undefined, language?: string) =>
  `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}${language ? `&language=${language}` : ''}`

/** language: 지도 글자 언어(ko·en·ja·zh, 네이버 지도 공식 지원). 없으면 한국어 */
export function preloadMapSdk(language?: string): boolean {
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
  if (!clientId) return false
  if (!document.querySelector('script[src*="oapi.map.naver.com"]')) {
    const script = document.createElement('script')
    script.src = mapSdkUrl(clientId, language)
    script.async = true
    document.head.appendChild(script)
  }
  return true
}

export default function NaverMap({ pins, faces, selectedId, onPinClick, onMapClick, onBoundsChange, fitKey, focus, insets, still = false, onUserMove, onClusterClick, fitBottom = 0, t = KO_UI, language }: NaverMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<naver.maps.Map | null>(null)
  const markersRef = useRef<Map<string, { marker: naver.maps.Marker; listener: unknown; sig: string }>>(new Map())
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState(false)
  // 지도가 멈출 때마다 올라간다. 마커를 다시 묶는 신호
  const [idleTick, setIdleTick] = useState(0)

  // 콜백은 바뀌어도 리스너를 다시 달지 않게 ref로 읽는다
  const cb = useRef({ onPinClick, onMapClick, onBoundsChange, onUserMove, onClusterClick, fitBottom, t })
  cb.current = { onPinClick, onMapClick, onBoundsChange, onUserMove, onClusterClick, fitBottom, t }

  useEffect(() => {
    if ((window as Window & { naver?: { maps?: unknown } }).naver?.maps) {
      setSdkLoaded(true)
      return
    }
    if (!preloadMapSdk(language)) return
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const poll = setInterval(() => {
      if ((window as Window & { naver?: { maps?: unknown } }).naver?.maps) {
        clearInterval(poll)
        if (timeoutId) clearTimeout(timeoutId)
        setSdkLoaded(true)
      }
    }, 50)
    timeoutId = setTimeout(() => {
      clearInterval(poll)
      setSdkError(true)
    }, 10000)
    return () => {
      clearInterval(poll)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [language])

  useEffect(() => {
    if (!sdkLoaded || !mapElRef.current || mapRef.current) return
    const map = new naver.maps.Map(mapElRef.current, {
      center: new naver.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    })
    mapRef.current = map
    // 테스트가 지도 가운데를 읽는다
    ;(mapElRef.current as HTMLDivElement & { __map?: naver.maps.Map }).__map = map
    sendBounds(map, cb.current.onBoundsChange)
    setIdleTick((t) => t + 1)
    naver.maps.Event.addListener(map, 'idle', () => {
      sendBounds(map, cb.current.onBoundsChange)
      setIdleTick((t) => t + 1)
    })
    naver.maps.Event.addListener(map, 'click', () => cb.current.onMapClick())
    for (const t of ['dragend', 'pinchend']) naver.maps.Event.addListener(map, t, () => cb.current.onUserMove?.())
  }, [sdkLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setOptions({
      draggable: !still,
      pinchZoom: !still,
      scrollWheel: !still,
      keyboardShortcuts: !still,
      disableDoubleClickZoom: still,
      disableDoubleTapZoom: still,
      disableTwoFingerTapZoom: still,
    })
  }, [still, sdkLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapElRef.current) return
    // 지도는 만들 때의 틀 크기로 굳는다. 토스 웹뷰는 처음에 틀이 작다가 커져서 위쪽만 그려지고 0곳이 됐다
    // 크기는 바깥 틀에서 잰다. 네이버 지도가 setSize 때 이 칸에 px 크기를 박아 넣어, 이 칸만 보면 큰 지도를 닫아도 664px 그대로였다
    const el = mapElRef.current.parentElement || mapElRef.current
    const ro = new ResizeObserver(() => {
      const s = map.getSize()
      if (!el.clientWidth || !el.clientHeight || (s.width === el.clientWidth && s.height === el.clientHeight)) return
      map.setSize({ width: el.clientWidth, height: el.clientHeight })
      sendBounds(map, cb.current.onBoundsChange)
      setIdleTick((t) => t + 1)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [sdkLoaded])

  // 화면 안 핀만 묶어서 그린다. 바뀐 마커만 갈아 끼워 깜빡이지 않게 한다
  useEffect(() => {
    const map = mapRef.current
    const el = mapElRef.current
    if (!map || !el || !el.clientWidth) return

    const b = readBounds(map)
    if (!b) return
    // 화면 가장자리 핀이 갑자기 생기지 않게 반 화면씩 여유를 둔다
    const padLat = (b.ne_lat - b.sw_lat) / 2
    const padLng = (b.ne_lng - b.sw_lng) / 2
    const pxPerLng = el.clientWidth / (b.ne_lng - b.sw_lng)
    const pxPerMerc = pxPerLng * (180 / Math.PI)

    const cells = new Map<string, Pin[]>()
    let selected: Pin | undefined
    for (const p of pins) {
      if (p.lat < b.sw_lat - padLat || p.lat > b.ne_lat + padLat || p.lng < b.sw_lng - padLng || p.lng > b.ne_lng + padLng) continue
      // 고른 핀은 묶지 않고 따로 그린다
      if (p.id === selectedId) { selected = p; continue }
      const key = `${Math.floor((p.lng * pxPerLng) / CLUSTER_PX)}:${Math.floor((-mercY(p.lat) * pxPerMerc) / CLUSTER_PX)}`
      const cell = cells.get(key)
      if (cell) cell.push(p)
      else cells.set(key, [p])
    }

    const next = new Map<string, { pins: Pin[]; selected: boolean }>()
    cells.forEach((items) => {
      next.set(items.length === 1 ? `p${items[0].id}` : `c${items[0].id}-${items.length}`, { pins: items, selected: false })
    })
    if (selected) next.set(`p${selected.id}`, { pins: [selected], selected: true })

    // 유튜버 사진이 핀보다 늦게 오면(토스는 채널을 따로 받는다) 이미 그린 핀도 다시 그려야 한다
    const facesKey = Object.values(faces).filter((f) => f.thumbnail).length
    const current = markersRef.current
    current.forEach((m, key) => {
      const want = next.get(key)
      if (!want || m.sig !== `${want.selected}:${facesKey}`) {
        naver.maps.Event.removeListener(m.listener)
        m.marker.setMap(null)
        current.delete(key)
      }
    })

    next.forEach((want, key) => {
      if (current.has(key)) return
      const items = want.pins
      let marker: naver.maps.Marker
      let listener: unknown
      if (items.length === 1) {
        const p = items[0]
        marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(p.lat, p.lng),
          map,
          zIndex: want.selected ? 1000 : 10,
          icon: singleIcon(p, faces, want.selected),
        })
        listener = naver.maps.Event.addListener(marker, 'click', () => {
          cb.current.onPinClick(p.id)
        })
      } else {
        const lat = items.reduce((s, p) => s + p.lat, 0) / items.length
        const lng = items.reduce((s, p) => s + p.lng, 0) / items.length
        marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(lat, lng),
          map,
          zIndex: 20 + Math.min(items.length, 500),
          icon: clusterIcon(items, faces, cb.current.t.cluster(items.length)),
        })
        listener = naver.maps.Event.addListener(marker, 'click', () => {
          const lats = items.map((p) => p.lat)
          const lngs = items.map((p) => p.lng)
          if (cb.current.onClusterClick) {
            cb.current.onClusterClick(lats, lngs)
            return
          }
          const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs))
          // 같은 건물처럼 거의 한 자리면 더 키워도 안 갈라진다. 첫 가게를 바로 보여준다
          if (span < 0.0002 || map.getZoom() >= 19) {
            cb.current.onPinClick(items[0].id)
            return
          }
          flyToFit(map, lats, lngs, 80, cb.current.fitBottom)
        })
      }
      current.set(key, { marker, listener, sig: `${want.selected}:${facesKey}` })
    })
  }, [pins, faces, selectedId, idleTick])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !fitKey || pins.length === 0) return
    // 틀 크기가 막 바뀌었으면(큰 지도 → 작은 지도) 맞추기 전에 크기부터 맞춘다. 안 그러면 큰 화면 기준으로 맞춰 작은 틀엔 왼쪽 위만 보였다
    const el = mapElRef.current?.parentElement
    if (el && el.clientWidth && el.clientHeight) {
      const s = map.getSize()
      if (s.width !== el.clientWidth || s.height !== el.clientHeight) map.setSize({ width: el.clientWidth, height: el.clientHeight })
    }
    const lats = pins.map((p) => p.lat)
    const lngs = pins.map((p) => p.lng)
    if (pins.length === 1) {
      map.morph(fitBottom ? centerAbove(lats[0], lngs[0], 15, -fitBottom / 2) : new naver.maps.LatLng(lats[0], lngs[0]), 15, { duration: 500, easing: 'easeOutCubic' })
      return
    }
    flyToFit(map, lats, lngs, 60, fitBottom)
    // pins가 바뀔 때마다 맞추지 않는다. fitKey가 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, sdkLoaded])

  const cardZoom = useRef<{ id: number; zoom: number } | null>(null)
  // 핀보다 focus가 먼저 오면(공유 링크 ?place, 느린 망) 못 옮긴 focus를 기억해 두고 그 가게 핀이 오면 한 번 옮긴다
  const missedFocus = useRef<typeof focus>(null)
  const appliedFocus = useRef<typeof focus>(null)
  const missedReady = !!missedFocus.current && 'id' in missedFocus.current && pins.some((x) => x.id === (missedFocus.current as { id: number }).id)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus || appliedFocus.current === focus) return
    if ('lats' in focus) {
      appliedFocus.current = focus
      if (focus.lats.length) flyToFit(map, focus.lats, focus.lngs, 60, fitBottom)
      return
    }
    const p = 'id' in focus ? pins.find((x) => x.id === focus.id) : focus
    missedFocus.current = p ? null : focus
    if (!p) return
    appliedFocus.current = focus
    const zoom = 'id' in focus ? Math.max(map.getZoom(), 15) : 'zoom' in focus && focus.zoom ? focus.zoom : 16
    // 같은 가게로 카드도 뜨면 카드 쪽 이동도 이 줌을 쓴다(둘이 다른 줌으로 서로 덮어쓰지 않게)
    if ('id' in focus) cardZoom.current = { id: focus.id, zoom }
    morphSure(map, fitBottom ? centerAbove(p.lat, p.lng, zoom, -fitBottom / 2) : new naver.maps.LatLng(p.lat, p.lng), zoom, 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, sdkLoaded, missedReady])

  // 카드가 뜨면 고른 가게로 확대해, 위 검색·칩과 카드 사이 빈 곳 가운데에 둔다
  const insetTop = insets?.top ?? null
  const insetBottom = insets?.bottom ?? null
  useEffect(() => {
    const map = mapRef.current
    const el = mapElRef.current
    if (selectedId == null) cardZoom.current = null
    if (!map || !el || selectedId == null || insetTop == null || insetBottom == null) return
    const p = pins.find((x) => x.id === selectedId)
    if (!p) return
    const h = el.clientHeight
    const freeMid = insetTop + (h - insetTop - insetBottom) / 2
    // 줌은 그 가게를 처음 고를 때 한 번만 정한다. 카드 높이를 잰 뒤 다시 불릴 때 움직이는 중의 줌으로 다시 정하면
    // 목표가 바뀌어 지도가 한 번 더 튀었다(10/25 실기기, 가끔만 재현)
    if (cardZoom.current?.id !== selectedId) cardZoom.current = { id: selectedId, zoom: tapZoom(map.getZoom()) }
    const zoom = cardZoom.current.zoom
    map.morph(centerAbove(p.lat, p.lng, zoom, freeMid - h / 2), zoom, { duration: 500, easing: 'easeOutCubic' })
    // 핀 목록이 바뀔 때마다 다시 옮기지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, insetTop, insetBottom, sdkLoaded])

  return (
    <div ref={mapElRef} data-testid="map" className="h-full w-full">
      {!sdkLoaded && !sdkError && (
        <div className="flex h-full items-center justify-center bg-well text-body text-sub">
          {t.mapLoading}
        </div>
      )}
      {sdkError && (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-well text-body text-sub">
          <span>{t.mapError}</span>
          <button
            onClick={() => window.location.reload()}
            className="min-h-[44px] px-3 font-bold text-ink underline"
          >
            {t.mapRetry}
          </button>
        </div>
      )}
    </div>
  )
}
