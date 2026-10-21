'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NaverMap, { type Face, type MapFocus } from '@/components/NaverMap'
import SearchBar from '@/components/SearchBar'
import DetailPanel from '@/components/DetailPanel'
import { ChannelFace } from '@/components/ChannelFace'
import { PinRow, PreviewCard } from '@/components/PinCard'
import { HeartIcon } from '@/components/HeartIcon'
import { ShareIcon } from '@/components/ShareIcon'
import { listMessage, placeMessage, type ShareMessage } from '@/lib/share'
import { webShare } from '@/lib/webShare'
import { localLikeStore, parseLikes, type LikeStore } from '@/lib/likes'
import Toast from '@/components/Toast'
import RetryNotice from '@/components/RetryNotice'
import { entryOf, track, visitInfo } from '@/lib/analytics'
import { iGa } from '@/lib/josa'
import { decodePins, inBounds, loadPins, type Bounds, type Pin, type PinsPayload } from '@/lib/pins'
import { buildIndex, searchPins, type Station } from '@/lib/search'
import Intro from '@/components/Intro'
import type { Channel, RestaurantWithVideos } from '@/lib/types'

// 화면 상태. 지도 위 카드(preview)·목록(list)·상세(detail)는 각각 방문 기록 한 칸이라
// 브라우저·토스 뒤로가기가 한 단계씩 닫는다
type Nav =
  | { v: 'map' }
  | { v: 'preview'; id: number }
  | { v: 'list' }
  | { v: 'detail'; id: number }

type Sort = 'near' | 'latest' | 'visitors'

const PAGE = 40
const LIST_AD_EVERY = 8
const CACHE_KEY = 'mukmap:pins:v2'
// 앱을 연 기록은 페이지당 한 번(개발 모드의 효과 두 번 실행에도)
let appOpenSent = false

interface HomeExplorerProps {
  channels: (Channel & { restaurant_count: number })[]
  /** 서버에서 그린 유튜버·지역 링크 목록. 목록 맨 아래에 붙는다 */
  children?: React.ReactNode
  /** API 주소 앞부분. 토스 앱은 https://mukmap.kr 을 넘긴다 */
  apiBase?: string
  /** 가게·유튜버 페이지 링크를 걸지. 토스 앱에는 그 페이지가 없어 끈다 */
  pageLinks?: boolean
  /** 앱이 위에 뒤로가기와 제목을 이미 그린다(토스 상단바). 상세의 자체 머리줄을 뺀다 */
  hostNav?: boolean
  /** 가게 상세 버튼 줄 아래 광고. 토스 앱은 배너 광고를 넘긴다 */
  detailAd?: (restaurantId: RestaurantWithVideos['id']) => React.ReactNode
  /** 목록 사이에 끼울 광고. slot은 몇 번째 광고인지 */
  listAd?: (slot: number) => React.ReactNode
  /** 지도 위 가게 카드 맨 아래 광고 */
  previewAd?: (restaurantId: number) => React.ReactNode
  /** 공유 버튼을 누르면 부른다. 받은 사람이 열 주소 쿼리와 공유 글·미리보기 그림. 없으면 웹 공유(mukmap.kr 주소).
   *  공유 창까지 열었으면 true로 끝나 완료 안내를 띄우고, 글을 돌려주면 그 글로 안내한다 */
  onShare?: (msg: ShareMessage) => void | Promise<boolean | string>
  /** 찜 목록을 둘 곳. 토스 앱은 앱 저장소를 넘긴다. 없으면 localStorage */
  likeStore?: LikeStore
}

function readNav(): Nav {
  const mk = (typeof window !== 'undefined' && window.history.state?.mk) as Nav | undefined
  return mk && typeof mk === 'object' && 'v' in mk ? mk : { v: 'map' }
}

function readCache(): Pin[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? decodePins(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeCache(p: PinsPayload) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(p)) } catch {}
}

/** 사라질 때도 잠깐 그려 두어 닫히는 움직임을 보여준다 */
function usePresence<T>(value: T | null, ms: number): { shown: T | null; leaving: boolean } {
  const [last, setLast] = useState<T | null>(value)
  useEffect(() => {
    if (value !== null) { setLast(value); return }
    const t = setTimeout(() => setLast(null), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return { shown: value ?? last, leaving: value === null && last !== null }
}

function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">
      <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
  )
}

export default function HomeExplorer({ channels, children, apiBase = '', pageLinks = true, hostNav = false, detailAd, listAd, previewAd, onShare = webShare, likeStore = localLikeStore }: HomeExplorerProps) {
  const [pins, setPins] = useState<Pin[] | null>(null)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [channelId, setChannelId] = useState<string | null>(null)
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  // 웹 목록 페이지에서 '지도로 보기'로 왔으면 그 페이지로 돌아가는 버튼을 띄운다
  const [from, setFrom] = useState('')
  const historyStart = useRef(0)
  // 목록으로 = 뒤로가기. 지도 안에서 쌓은 카드·상세 단계까지 한 번에 건너 목록 페이지로 돌아간다
  const backToList = (e: React.MouseEvent) => {
    let ref: URL | null = null
    try { ref = new URL(document.referrer) } catch { /* 없으면 주소로 간다 */ }
    if (!ref || ref.origin !== window.location.origin || decodeURIComponent(ref.pathname) !== decodeURIComponent(from)) return
    e.preventDefault()
    window.history.go(-(window.history.length - historyStart.current + 1))
  }
  const [text, setText] = useState('')
  const [nav, setNav] = useState<Nav>({ v: 'map' })
  const [sort, setSort] = useState<Sort>('near')
  const [shown, setShown] = useState(PAGE)
  const [fitKey, setFitKey] = useState(0)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [detail, setDetail] = useState<RestaurantWithVideos | null>(null)
  const [toast, setToast] = useState('')
  const [desktop, setDesktop] = useState(false)
  // 가게 목록을 끝내 못 받으면 안내와 다시 받기 버튼을 띄운다. pinsTry를 올리면 다시 받는다
  const [pinsFailed, setPinsFailed] = useState(false)
  const [pinsTry, setPinsTry] = useState(0)
  const hadCache = useRef(false)
  // 찜: 기기에 남긴 가게 id. 찜 칩을 켜면 찜한 곳만 지도 전체에서 본다
  const [likes, setLikes] = useState<Set<number>>(() => new Set())
  const [likedOnly, setLikedOnly] = useState(false)
  useEffect(() => {
    let live = true
    likeStore.get().then((raw) => { if (live) setLikes(new Set(parseLikes(raw))) }).catch(() => {})
    return () => { live = false }
  }, [likeStore])
  useEffect(() => { if (!likes.size) setLikedOnly(false) }, [likes])

  const details = useRef<Map<number, Promise<RestaurantWithVideos | null>>>(new Map())
  const openDetailRef = useRef<(id: number) => void>(() => {})
  const fitWhenLoaded = useRef(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setDesktop(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // 핀은 한 번만 받는다. 전에 받은 게 있으면 먼저 보여주고 뒤에서 새로 받는다
  useEffect(() => {
    const cached = readCache()
    hadCache.current = !!cached
    if (cached) setPins(cached)
    // 토스 앱을 막 띄운 순간엔 요청이 바로 실패하곤 해서 몇 번 더 받아 본다
    let live = true
    const t0 = performance.now()
    const load = (n: number) => loadPins(apiBase)
      .then((p: PinsPayload) => {
        writeCache(p)
        if (live) setPins(decodePins(p))
        track('pins_load', { ok: true, ms: Math.round(performance.now() - t0), tries: n + 1, cached: !!cached })
      })
      .catch(() => {
        if (!live) return
        if (n < 5) {
          track('load_retry', { what: 'pins', n: n + 1 })
          setTimeout(() => load(n + 1), 500 * 2 ** n)
        } else {
          track('pins_load', { ok: false, ms: Math.round(performance.now() - t0), tries: n + 1, cached: !!cached })
          if (!cached) {
            track('load_fail', { what: 'pins' })
            setPinsFailed(true)
          }
        }
      })
    load(0)
    return () => { live = false }
  }, [apiBase, pinsTry])

  const retryPins = useCallback(() => {
    track('load_retry_tap', { what: 'pins' })
    setPinsFailed(false)
    setPinsTry((n) => n + 1)
  }, [])

  // 첫 화면 한 번: 처음 왔는지, 며칠 만인지, 어디서 들어왔는지
  useEffect(() => {
    if (appOpenSent) return
    appOpenSent = true
    track('app_open', { ...visitInfo(), ...entryOf(window.location.search) })
  }, [])

  // 프로필 사진은 우리 주소를 거쳐 받는다(app/api/face)
  const faceChannels = useMemo(() => channels.map((c) => ({ ...c, thumbnail_url: c.thumbnail_url ? `${apiBase}/api/face/${c.id}` : null })), [channels, apiBase])

  // 지도 핀이 빈 동그라미로 먼저 그려지지 않게 시작 화면이 떠 있는 동안 사진을 받아 둔다
  const [facesReady, setFacesReady] = useState(false)
  useEffect(() => {
    const urls = faceChannels.map((c) => c.thumbnail_url).filter((u): u is string => !!u)
    if (!urls.length) return
    let live = true
    Promise.all(urls.map((u) => new Promise((done) => { const img = new Image(); img.onload = img.onerror = done; img.src = u })))
      .then(() => { if (live) setFacesReady(true) })
    return () => { live = false }
  }, [faceChannels])
  // 소개 화면이 걷힐 조건이 처음 갖춰진 순간 = 첫 실행 체감 속도
  const mapReady = pins !== null && bounds !== null && facesReady
  const readySent = useRef(false)
  useEffect(() => {
    if (!mapReady || readySent.current) return
    readySent.current = true
    track('app_ready', { ms: Math.round(performance.now()), cached: hadCache.current })
  }, [mapReady])
  const faces = useMemo(() => {
    const m: Record<string, Face> = {}
    for (const c of faceChannels) m[c.id] = { name: c.name, thumbnail: c.thumbnail_url }
    return m
  }, [faceChannels])

  const pinById = useMemo(() => new Map((pins || []).map((p) => [p.id, p])), [pins])
  const nameOf = useCallback((id: string) => faces[id]?.name || '', [faces])

  const index = useMemo(() => (pins ? buildIndex(pins, (id) => faces[id]?.name || '') : null), [pins, faces])
  const textHits = useMemo(() => (index && text ? new Set(searchPins(index, text).map((p) => p.id)) : null), [index, text])

  const filtered = useMemo(() => (pins || []).filter((p) =>
    (!channelId || p.ch.includes(channelId)) && (!region || p.region === region) && (!city || p.city === city) &&
    (!textHits || textHits.has(p.id)) && (!likedOnly || likes.has(p.id))
  ), [pins, channelId, region, city, textHits, likedOnly, likes])

  // 찜한 곳은 지도 밖에 있어도 다 보여준다
  const inView = useMemo(() => (bounds && !likedOnly ? filtered.filter((p) => inBounds(p, bounds)) : filtered), [filtered, bounds, likedOnly])

  // 칩·검색으로 거른 결과 수를 보낸다. 첫 진입 조건(주소 쿼리)은 app_open이 이미 안다
  const filteredRef = useRef(filtered)
  filteredRef.current = filtered
  const lastFilter = useRef<string | null>(null)
  useEffect(() => {
    if (!pins) return
    const key = `${channelId}|${region}|${city}`
    if (lastFilter.current === null) { lastFilter.current = key; return }
    if (lastFilter.current === key) return
    lastFilter.current = key
    const type = channelId ? 'channel' : region ? 'region' : 'all'
    track('filter_change', { type, value: channelId || [region, city].filter(Boolean).join(' ') || 'all', count: filteredRef.current.length })
  }, [pins, channelId, region, city])
  useEffect(() => {
    if (text && textHits) track('search_result', { q: text.slice(0, 40), count: textHits.size })
  }, [text, textHits])

  // 지금 보이는 지도(지역·검색 조건 포함)에 가게가 하나도 없는 유튜버 칩은 흐리게 보인다. 눌러도 되고, 누르면 그 유튜버 가게로 지도를 옮긴다
  const viewCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pins || []) {
      if ((region && p.region !== region) || (city && p.city !== city) || (textHits && !textHits.has(p.id))) continue
      if (bounds && !inBounds(p, bounds)) continue
      for (const c of p.ch) m.set(c, (m.get(c) || 0) + 1)
    }
    return m
  }, [pins, region, city, textHits, bounds])

  const listOpen = desktop || nav.v === 'list'

  const sorted = useMemo(() => {
    if (!listOpen) return []
    const list = [...inView]
    if (sort === 'latest') return list.sort((a, b) => b.date.localeCompare(a.date))
    if (sort === 'visitors') return list.sort((a, b) => b.ch.length - a.ch.length || b.date.localeCompare(a.date))
    if (!bounds) return list
    const cy = (bounds.sw_lat + bounds.ne_lat) / 2
    const cx = (bounds.sw_lng + bounds.ne_lng) / 2
    const k = Math.cos((cy * Math.PI) / 180)
    const d = (p: Pin) => (p.lat - cy) ** 2 + ((p.lng - cx) * k) ** 2
    return list.sort((a, b) => d(a) - d(b))
  }, [inView, sort, bounds, listOpen])

  useEffect(() => { setShown(PAGE) }, [inView, sort])

  const sortedRef = useRef(sorted)
  sortedRef.current = sorted
  const openFromList = useCallback((id: number) => {
    track('list_click', { id, rank: sortedRef.current.findIndex((p) => p.id === id) + 1, sort })
    openDetailRef.current(id)
  }, [sort])

  useEffect(() => {
    if (fitWhenLoaded.current && pins) {
      fitWhenLoaded.current = false
      setFitKey((k) => k + 1)
    }
  }, [pins])

  // ── 방문 기록 ─────────────────────────────────────────
  const push = useCallback((n: Nav) => {
    window.history.pushState({ ...window.history.state, mk: n }, '')
    setNav(n)
  }, [])
  const replace = useCallback((n: Nav) => {
    window.history.replaceState({ ...window.history.state, mk: n }, '')
    setNav(n)
  }, [])
  const back = useCallback(() => {
    if (readNav().v === 'map') setNav({ v: 'map' })
    else window.history.back()
  }, [])

  // 토스 뒤로가기 처리(toss/src/main.tsx)가 history.state를 못 읽어도 지금 단계를 알 수 있게 둔다
  useEffect(() => { document.documentElement.dataset.mkNav = nav.v }, [nav])

  // 화면이 바뀔 때 연 화면과 앞 화면에 머문 시간을 보낸다
  const navKey = nav.v === 'preview' || nav.v === 'detail' ? `${nav.v}:${nav.id}` : nav.v
  useEffect(() => {
    const [screen, id] = navKey.split(':')
    const t0 = performance.now()
    track('screen_open', { screen, id: id ? Number(id) : undefined }, 'screen')
    return () => track('screen_leave', { screen, id: id ? Number(id) : undefined, ms: Math.round(performance.now() - t0) })
  }, [navKey])

  useEffect(() => {
    setNav(readNav())
    const onPop = () => setNav(readNav())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // ── 상세 데이터: 카드가 뜰 때 미리 받아 둔다 ──────────────────
  const loadDetail = useCallback((id: number) => {
    let p = details.current.get(id)
    if (!p) {
      p = fetch(`${apiBase}/api/restaurants/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      details.current.set(id, p)
    }
    return p
  }, [apiBase])

  const previewId = nav.v === 'preview' ? nav.id : null
  const detailId = nav.v === 'detail' ? nav.id : null

  useEffect(() => { if (previewId) loadDetail(previewId) }, [previewId, loadDetail])

  useEffect(() => {
    if (!detailId) return
    let live = true
    setDetail((d) => (d?.id === detailId ? d : null))
    loadDetail(detailId).then((r) => {
      if (!live) return
      if (r) setDetail(r)
      else {
        details.current.delete(detailId)
        setToast('가게 정보를 불러오지 못했어요.')
      }
    })
    return () => { live = false }
  }, [detailId, loadDetail])

  // ── 동작 ─────────────────────────────────────────────
  const openDetail = useCallback((id: number) => {
    if (readNav().v === 'detail') replace({ v: 'detail', id })
    else push({ v: 'detail', id })
  }, [push, replace])
  openDetailRef.current = openDetail

  const selectPin = useCallback((id: number) => {
    if (desktop) return openDetail(id)
    const cur = readNav()
    if (cur.v === 'preview') replace({ v: 'preview', id })
    else push({ v: 'preview', id })
  }, [desktop, openDetail, push, replace])

  const onMapClick = useCallback(() => {
    if (readNav().v === 'preview') window.history.back()
  }, [])

  // 칩·검색으로 조건을 바꾸면 고른 가게 카드는 내린다
  const closePreview = onMapClick

  const searchAll = useCallback((q: string) => {
    setText(q)
    setChannelId(null)
    setRegion('')
    setCity('')
    setFitKey((k) => k + 1)
    if (readNav().v === 'preview') window.history.back()
  }, [])

  const searchChannel = useCallback((id: string) => {
    track('search_select', { kind: 'channel', id })
    closePreview()
    setText('')
    setChannelId(id)
    setFitKey((k) => k + 1)
  }, [closePreview])

  const searchRegion = useCallback((name: string) => {
    track('search_select', { kind: 'region', id: name })
    closePreview()
    setText('')
    setRegion(name)
    setCity('')
    setFitKey((k) => k + 1)
  }, [closePreview])

  const searchRestaurant = useCallback((id: number) => {
    track('search_select', { kind: 'restaurant', id })
    // 걸린 필터('영등포' 검색·유튜버·지역)에 빠진 가게면 필터를 풀어야 지도가 그 가게로 간다
    if (!filtered.some((p) => p.id === id)) {
      setText('')
      setChannelId(null)
      setRegion('')
      setCity('')
    }
    setFocus({ id, seq: Date.now() })
    if (desktop || readNav().v === 'list') openDetail(id)
    else selectPin(id)
  }, [desktop, openDetail, selectPin, filtered])

  const searchStation = useCallback((station: Station) => {
    track('search_select', { kind: 'station', id: station.name })
    replace({ v: 'map' })
    setFocus({ lat: station.lat, lng: station.lng, seq: Date.now() })
  }, [replace])

  const pickChannel = useCallback((id: string | null) => {
    closePreview()
    setChannelId(id)
    setFitKey((k) => k + 1)
  }, [closePreview])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && readNav().v !== 'map') window.history.back() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 목록·가게 페이지에서 넘어온 조건(?yt=쯔양&region=서울, ?place=12)으로 연다
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const reg = q.get('region')
    const place = Number(q.get('place'))
    // 지도 카드에서 공유한 링크(?pin=12)는 그 가게 카드를 띄운다
    const pin = Number(q.get('pin'))
    if (reg) setRegion(reg)
    if (reg && q.get('city')) setCity(q.get('city')!)
    if (q.get('q')) setText(q.get('q')!)
    const f = q.get('from')
    if (f && f.startsWith('/') && !f.startsWith('//')) setFrom(f)
    historyStart.current = window.history.length
    if (q.get('yt') || reg || q.get('q')) fitWhenLoaded.current = true
    // 웹 목록·역 페이지의 '지도로 보기'(?area=서울&area_city=강남구, ?at=37.5,127.0)는 거르지 않고 그곳에서 시작한다
    const area = q.get('area')
    if (area) startArea.current = { region: area, city: q.get('area_city') || '' }
    const at = (q.get('at') || '').split(',').map(Number)
    if (at.length === 2 && at.every(Number.isFinite)) setFocus({ lat: at[0], lng: at[1], zoom: 15, seq: Date.now() })
    if (Number.isInteger(place) && place > 0 && readNav().v === 'map') {
      push({ v: 'detail', id: place })
      setFocus({ id: place, seq: Date.now() })
    } else if (Number.isInteger(pin) && pin > 0 && readNav().v === 'map') {
      if (window.matchMedia('(min-width: 1024px)').matches) push({ v: 'detail', id: pin })
      else push({ v: 'preview', id: pin })
      setFocus({ id: pin, seq: Date.now() })
    }
    // 첫 진입 한 번만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ?area=는 가게 목록이 와야 그 지역 가게가 다 보이는 범위를 안다
  const startArea = useRef<{ region: string; city: string } | null>(null)
  useEffect(() => {
    const a = startArea.current
    if (!a || !pins) return
    const ps = pins.filter((p) => p.region === a.region && (!a.city || p.city === a.city))
    if (!ps.length) return
    startArea.current = null
    setFocus({ lats: ps.map((p) => p.lat), lngs: ps.map((p) => p.lng), seq: Date.now() })
  }, [pins])

  // ?yt=는 유튜버 목록이 와야 풀 수 있다. 토스 앱은 목록을 늦게 받아서 도착했을 때 한 번 적용한다
  const ytApplied = useRef(false)
  useEffect(() => {
    if (ytApplied.current || !channels.length) return
    ytApplied.current = true
    const yt = new URLSearchParams(window.location.search).get('yt')
    const ch = yt ? channels.find((c) => c.slug === yt || c.id === yt) : undefined
    if (ch) setChannelId(ch.id)
  }, [channels])

  // 목록 끝에 닿으면 더 그린다
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !listOpen) return
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) setShown((n) => n + PAGE)
    }, { root: listRef.current, rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [listOpen, sorted.length])

  const handleToastClose = useCallback(() => setToast(''), [])

  const toggleLike = useCallback((id: number) => {
    setLikes((cur) => {
      const next = new Set(cur)
      const on = !next.has(id)
      if (on) next.add(id)
      else next.delete(id)
      likeStore.set(JSON.stringify(Array.from(next))).catch(() => {})
      track('like_toggle', { id, on, count: next.size })
      setToast(on ? '찜했어요' : '찜을 풀었어요')
      return next
    })
  }, [likeStore])

  const place = [region, city].filter(Boolean).join(' ')
  // 카드가 떠 있으면 지도에서 가려지는 위(검색·칩)·아래(카드) 높이. 고른 핀을 그 사이 가운데에 둔다
  const topBarRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [insets, setInsets] = useState<{ top: number; bottom: number } | null>(null)
  const preview = usePresence(previewId ? pinById.get(previewId) ?? null : null, 200)
  const cardShown = !!preview.shown && !preview.leaving
  useEffect(() => {
    const card = cardRef.current
    const bar = topBarRef.current
    if (!cardShown || !card || !bar) { setInsets(null); return }
    const measure = () => {
      const top = bar.getBoundingClientRect().bottom
      // 카드는 들어오는 동안 움직이니 움직이지 않는 바깥 틀의 위치를 잰다
      const bottom = window.innerHeight - card.parentElement!.getBoundingClientRect().top
      setInsets((cur) => (cur && Math.abs(cur.top - top) < 2 && Math.abs(cur.bottom - bottom) < 2 ? cur : { top, bottom }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(card)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [cardShown, preview.shown?.id])

  const detailP = usePresence(detailId, 240)
  const listP = usePresence(nav.v === 'list' ? true : null, 200)
  const shownDetailId = detailP.shown
  const detailPin = shownDetailId ? pinById.get(shownDetailId) : undefined
  const shownDetail = detail && detail.id === shownDetailId ? detail : null
  const count = pins ? inView.length : null
  // 유튜버·지역·검색으로 거른 지도는 그 조건 그대로 공유한다
  const share = useMemo(() => {
    const ch = channelId ? channels.find((c) => c.id === channelId) : undefined
    if (!pins || (!ch && !region && !text)) return null
    const sp = new URLSearchParams()
    // 한글 이름은 토스 공유 링크를 거치며 깨질 수 있어 영문 채널 id를 넣는다(받는 쪽은 id도 읽는다)
    if (ch) sp.set('yt', ch.id)
    if (region) sp.set('region', region)
    if (city) sp.set('city', city)
    if (text) sp.set('q', text)
    const what = [ch?.name, city ? `${region} ${city}` : region, text && `‘${text}’`].filter(Boolean).join(' ')
    return listMessage(sp.toString(), what, filtered, nameOf)
  }, [pins, channelId, channels, region, city, text, filtered, nameOf])
  // 공유 창까지 열었으면 완료 안내
  const doShare = (msg: ShareMessage) => {
    if (!onShare) return
    Promise.resolve(onShare(msg)).then((ok) => { if (ok) setToast(typeof ok === 'string' ? ok : '공유 링크를 만들었어요') })
  }
  const sharePlace = (id: number, query: string) => {
    const p = pinById.get(id)
    if (p) doShare(placeMessage(p, query, nameOf))
  }
  const search = (
    <SearchBar
      index={index}
      channels={faceChannels}
      onSelectRestaurant={searchRestaurant}
      onSelectChannel={searchChannel}
      onSelectRegion={searchRegion}
      onSelectStation={searchStation}
      apiBase={apiBase}
      onSearchAll={searchAll}
      onFocus={closePreview}
    />
  )

  const chips = (floating: boolean) => (
    <div className="flex items-center">
    {/* 지역으로 거른 지도는 그 칩을 스크롤 밖 왼쪽에 고정해 늘 보이게 한다. 안 그러면 다른 가게가 없는 줄 안다 */}
    {place && (
      <button
        type="button"
        data-testid="place-chip"
        onClick={() => { closePreview(); setRegion(''); setCity('') }}
        className={`ml-4 flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-meta font-bold text-paper lg:ml-5 ${floating ? 'shadow-[0_2px_8px_rgba(27,29,31,0.15)]' : ''}`}
      >
        {place}만
        <XIcon />
        <span className="sr-only">지역 조건 풀기</span>
      </button>
    )}
    <nav aria-label="유튜버 고르기" className={`no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 pr-4 lg:pr-5 ${place ? 'pl-2' : 'pl-4 lg:pl-5'}`}>
      <button
        type="button"
        onClick={() => { setText(''); setLikedOnly(false); pickChannel(null) }}
        aria-pressed={!channelId && !text && !likedOnly}
        className={`flex h-9 flex-shrink-0 items-center rounded-full px-3.5 text-meta font-bold ${
          !channelId && !text && !likedOnly ? 'bg-ink text-paper' : 'bg-paper text-ink'
        } ${floating ? 'shadow-[0_2px_8px_rgba(27,29,31,0.15)]' : 'border border-line'}`}
      >
        전체
      </button>
      {likes.size > 0 && (
        <button
          type="button"
          data-testid="liked-chip"
          onClick={() => { closePreview(); setLikedOnly((v) => !v); setFitKey((k) => k + 1) }}
          aria-pressed={likedOnly}
          className={`flex h-9 flex-shrink-0 items-center gap-1 rounded-full px-3.5 text-meta font-bold ${
            likedOnly ? 'bg-ink text-paper' : 'bg-paper text-ink'
          } ${floating ? 'shadow-[0_2px_8px_rgba(27,29,31,0.15)]' : 'border border-line'}`}
        >
          <HeartIcon on={likedOnly} size={14} />
          찜 {likes.size}
        </button>
      )}
      {channels.map((ch) => {
        const on = ch.id === channelId
        const empty = !on && pins !== null && !viewCount.get(ch.id)
        return (
          <button
            key={ch.id}
            type="button"
            onClick={() => pickChannel(on ? null : ch.id)}
            aria-pressed={on}
            data-empty={empty || undefined}
            className={`flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3 text-meta font-bold ${
              on ? 'bg-ink text-paper' : empty ? 'bg-well text-sub' : 'bg-paper text-ink'
            } ${floating ? 'shadow-[0_2px_8px_rgba(27,29,31,0.15)]' : 'border border-line'}`}
          >
            <span className={`flex ${empty ? 'opacity-40 grayscale' : ''}`}>
              <ChannelFace face={{ id: ch.id, name: ch.name, thumbnail: faces[ch.id]?.thumbnail ?? null }} size={28} />
            </span>
            {ch.name}
            {empty && <span className="sr-only">(이 화면엔 가게 없음)</span>}
          </button>
        )
      })}
      {text && (
        <button
          type="button"
          data-testid="text-chip"
          onClick={() => { closePreview(); setText(''); setFitKey((k) => k + 1) }}
          className={`order-first flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-meta font-bold text-paper ${floating ? 'shadow-[0_2px_8px_rgba(27,29,31,0.15)]' : ''}`}
        >
          ‘{text}’
          <XIcon />
          <span className="sr-only">검색 조건 풀기</span>
        </button>
      )}
    </nav>
    </div>
  )

  // 웹 목록 페이지에서 왔으면 검색창 왼쪽에 뒤로 버튼
  const backBtn = from && (
    <a
      href={from}
      onClick={backToList}
      data-testid="back-to-list"
      aria-label="목록으로"
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-paper text-ink shadow-[0_2px_12px_rgba(27,29,31,0.12)] lg:shadow-none"
    >
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </a>
  )

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-paper">
      {/* 지도 위: 검색 + 유튜버 칩(모바일) */}
      <div ref={topBarRef} className="pointer-events-none fixed inset-x-0 top-0 z-20 pt-[calc(10px+env(safe-area-inset-top))] lg:hidden">
        <div className="pointer-events-auto flex items-center gap-2 px-4">
          {backBtn}
          {search}
        </div>
        <div className="pointer-events-auto mt-2">{chips(true)}</div>
      </div>

      {/* 목록: 모바일은 전체 화면, 데스크톱은 왼쪽 기둥 */}
      <section
        data-testid="list-view"
        aria-label="가게 목록"
        className={`${listP.shown ? 'flex' : 'hidden'} ${listP.leaving ? 'pointer-events-none animate-rise-out' : 'animate-rise-in'} fixed inset-0 z-30 flex-col bg-paper lg:animate-none
          lg:static lg:z-auto lg:flex lg:h-full lg:w-[400px] lg:flex-shrink-0 lg:border-r lg:border-line`}
      >
        <header className="hidden px-5 pb-3 pt-5 lg:block">
          <p className="font-caption text-title text-ink">먹맵</p>
          <p className="mt-0.5 text-meta text-sub">유튜버가 실제로 가서 먹은 집</p>
          <div className="mt-4 flex items-center gap-2">
            {backBtn}
            {search}
          </div>
        </header>

        <div className="border-b border-line bg-paper pt-[env(safe-area-inset-top)] lg:pt-0">
          <div className="flex h-14 items-center justify-between px-4 lg:px-5">
            <h2 className="text-lead font-bold text-ink" aria-live="polite">
              {text ? `‘${text}’ ` : likedOnly ? '찜한 곳 ' : '이 지도 안 '}<span data-testid="list-count">{count ?? 0}</span>곳
            </h2>
            <label className="relative inline-flex min-h-[44px] items-center pl-2 text-meta font-bold text-ink">
              <span className="sr-only">정렬</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="appearance-none bg-transparent pr-5 font-bold text-ink outline-none"
              >
                <option value="near">가까운 순</option>
                <option value="latest">최근 영상순</option>
                <option value="visitors">여러 명 간 순</option>
              </select>
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className="pointer-events-none absolute right-0"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </label>
          </div>
          <div className="pb-3">{chips(false)}</div>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 lg:px-5">
            {pins && sorted.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-body text-ink">
                  {text ? `‘${text}’에 맞는 가게가 이 지도 안에 없어요.`
                    : channelId ? `${iGa(nameOf(channelId) || '고른 유튜버')} 다녀간 가게가 이 지도 안에 없어요.`
                    : '이 지도 안에는 아직 가게가 없어요.'}
                </p>
                <p className="mt-1 text-meta text-sub">지도를 줄이거나 다른 지역으로 옮겨 보세요.</p>
              </div>
            )}
            {sorted.slice(0, shown).map((p, i) => (
              <Fragment key={p.id}>
                <PinRow pin={p} faces={faces} onOpen={openFromList} selected={p.id === detailId} />
                {listAd && i >= 2 && (i - 2) % LIST_AD_EVERY === 0 && listAd((i - 2) / LIST_AD_EVERY)}
              </Fragment>
            ))}
            <div ref={sentinel} />
          </div>
          <div className="px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-8 lg:px-5 lg:pb-8">{children}</div>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center pb-[calc(16px+env(safe-area-inset-bottom))] lg:hidden">
          <button
            type="button"
            data-testid="map-pill"
            onClick={back}
            className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-body font-bold text-paper shadow-[0_4px_16px_rgba(27,29,31,0.16)]"
          >
            <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path d="M2 4.5 6.5 3l5 1.5L16 3v10.5L11.5 15l-5-1.5L2 15z M6.5 3v10.5 M11.5 4.5V15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            지도 보기
          </button>
        </div>
      </section>

      <main className="relative isolate z-0 flex-1 overflow-hidden">
        <NaverMap
          pins={filtered}
          faces={faces}
          selectedId={previewId ?? detailId}
          onPinClick={selectPin}
          onMapClick={onMapClick}
          onBoundsChange={setBounds}
          fitKey={fitKey}
          focus={focus}
          insets={insets}
        />

        {/* 지도 아래: 고른 가게 카드, 아니면 목록 보기 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[calc(16px+env(safe-area-inset-bottom))] lg:hidden">
          {preview.shown ? (
            <div ref={cardRef} className="pointer-events-auto w-full">
              <PreviewCard
                key={preview.shown.id}
                pin={preview.shown}
                faces={faces}
                leaving={preview.leaving}
                onOpen={() => push({ v: 'detail', id: preview.shown!.id })}
                onClose={back}
                onShare={() => sharePlace(preview.shown!.id, `pin=${preview.shown!.id}`)}
                liked={likes.has(preview.shown.id)}
                onLike={() => toggleLike(preview.shown!.id)}
                adSlot={previewAd?.(preview.shown.id)}
              />
            </div>
          ) : (
            <button
              type="button"
              data-testid="list-pill"
              onClick={() => push({ v: 'list' })}
              className="pointer-events-auto flex h-12 animate-sheet-in items-center gap-2 rounded-full bg-ink px-5 text-body font-bold text-paper shadow-[0_4px_16px_rgba(27,29,31,0.16)] transition-transform active:scale-95"
            >
              <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path d="M3 4.5h12M3 9h12M3 13.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              목록 보기
              {count !== null
                ? <span data-testid="pill-count" className="font-normal opacity-80">{count}곳</span>
                : pins === null && <span data-testid="pins-loading" className="font-normal opacity-80">불러오는 중</span>}
            </button>
          )}
          {!preview.shown && share && (
            <button
              type="button"
              data-testid="share-filter"
              onClick={() => doShare(share)}
              className="pointer-events-auto ml-2 flex h-12 animate-sheet-in items-center gap-1.5 rounded-full bg-paper px-4 text-body font-bold text-ink shadow-[0_4px_16px_rgba(27,29,31,0.16)] transition-transform active:scale-95"
            >
              <ShareIcon />
              공유
            </button>
          )}
        </div>
      </main>

      {/* 상세: 모바일은 전체 화면, 데스크톱은 왼쪽 기둥을 덮는다 */}
      {shownDetailId && (
        <section
          data-testid="detail-view"
          aria-label="가게 정보"
          className={`fixed inset-0 z-40 flex flex-col bg-paper shadow-[-8px_0_24px_rgba(27,29,31,0.12)] lg:right-auto lg:w-[400px] lg:border-r lg:border-line lg:shadow-none ${
            detailP.leaving ? 'pointer-events-none animate-slide-out lg:animate-none' : 'animate-slide-in lg:animate-none'
          }`}
        >
          <header className={`${hostNav ? 'hidden' : ''} flex-shrink-0 border-b border-line bg-paper pt-[env(safe-area-inset-top)]`}>
            <div className="flex h-14 items-center gap-1 px-2">
              <button
                type="button"
                data-testid="detail-back"
                onClick={back}
                aria-label="뒤로"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink"
              >
                <BackIcon />
              </button>
              <p className="truncate text-lead font-bold text-ink">{shownDetail?.name || detailPin?.name || ''}</p>
            </div>
          </header>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain sm:px-5"
            onClickCapture={(e) => {
              if ((e.target as Element).closest('[data-track="video_watch_click"]')) setToast('유튜브에서 그 장면부터 열어요')
            }}
          >
            {shownDetail ? (
              <>
                <DetailPanel
                  restaurant={shownDetail}
                  channelHref={pageLinks ? (slug) => `/youtuber/${encodeURIComponent(slug)}` : undefined}
                  adSlot={detailAd?.(shownDetail.id)}
                  onShare={() => sharePlace(shownDetail.id, `place=${shownDetail.id}`)}
                  liked={likes.has(shownDetail.id)}
                  onLike={() => toggleLike(shownDetail.id)}
                />
              </>
            ) : (
              <div aria-busy="true" className="px-4 pt-3 sm:px-0">
                <div className="h-7 w-2/3 rounded bg-well" />
                <div className="mt-2 h-4 w-1/2 rounded bg-well" />
                <div className="mt-4 aspect-video overflow-hidden bg-well sm:rounded-card">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 토스 앱과 같이 쓰는 컴포넌트 */}
                  {detailPin?.vid && <img src={`https://i.ytimg.com/vi/${detailPin.vid}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {pinsFailed && <RetryNotice testId="pins-retry" title="가게 목록을 불러오지 못했어요" onRetry={retryPins} />}
      {toast && <Toast message={toast} onClose={handleToastClose} />}
      <Intro ready={mapReady} loaded={pins !== null} channels={faceChannels} />
    </div>
  )
}
