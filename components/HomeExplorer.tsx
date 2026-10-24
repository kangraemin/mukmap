'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NaverMap, { type Face, type MapFocus } from '@/components/NaverMap'
import SearchBar from '@/components/SearchBar'
import DetailPanel from '@/components/DetailPanel'
import { ChannelFace } from '@/components/ChannelFace'
import { PinRow, PreviewCard } from '@/components/PinCard'
import ListSheet, { HALF_RATIO, PEEK_PX, type SheetSnap } from '@/components/ListSheet'
import { HeartIcon } from '@/components/HeartIcon'
import { ShareIcon } from '@/components/ShareIcon'
import { listMessage, placeMessage, placeNameMessage, type ShareMessage } from '@/lib/share'
import { webShare } from '@/lib/webShare'
import { localLikeStore, parseLikes, type LikeStore } from '@/lib/likes'
import Toast from '@/components/Toast'
import RetryNotice from '@/components/RetryNotice'
import { entryOf, track, visitInfo } from '@/lib/analytics'
import { uiText } from '@/lib/ui-text'
import { LABELS, channelName, type Lang } from '@/lib/i18n'
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

type Sort = 'latest' | 'visitors'

const PAGE = 40
const LIST_AD_EVERY = 8
const CACHE_KEY = 'mukmap:pins:v2'
// 외국어 지도는 가게 이름·메뉴가 그 언어라 따로 둔다
const cacheKey = (lang?: Lang) => (lang ? `${CACHE_KEY}:${lang}` : CACHE_KEY)
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
  /** 유튜버를 골랐을 때 목록 머리줄에 붙일 버튼. 토스 앱은 '새 맛집 알림' 버튼을 넘긴다 */
  channelAction?: (channel: { id: string; name: string }) => React.ReactNode
  /** 찜한 곳만 볼 때 목록 머리줄에 붙일 버튼. 토스 앱은 '근처 새 맛집 알림' 버튼을 넘긴다 */
  likedAction?: (likedIds: number[]) => React.ReactNode
  /** 찜을 켜거나 끈 뒤 부른다. 바뀐 뒤의 찜 전체와 이번에 켰는지 */
  onLikeChange?: (likedIds: number[], liked: boolean) => void
  /** 외국어 지도(/en 등). 없으면 한국어 그대로 */
  lang?: Lang
}

function readNav(): Nav {
  const mk = (typeof window !== 'undefined' && window.history.state?.mk) as Nav | undefined
  return mk && typeof mk === 'object' && 'v' in mk ? mk : { v: 'map' }
}

function readCache(key: string): Pin[] | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? decodePins(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeCache(key: string, p: PinsPayload) {
  try { localStorage.setItem(key, JSON.stringify(p)) } catch {}
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

export default function HomeExplorer({ channels, children, apiBase = '', pageLinks = true, hostNav = false, detailAd, listAd, previewAd, onShare = webShare, likeStore = localLikeStore, channelAction, likedAction, onLikeChange, lang }: HomeExplorerProps) {
  const t = useMemo(() => uiText(lang), [lang])
  const [pins, setPins] = useState<Pin[] | null>(null)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  // 핀을 누르면 지도가 그 가게로 다가간다. 목록은 누르기 전 지도 기준으로 붙잡아 둬서, 카드를 닫아도 보던 목록 그대로다
  const [heldBounds, setHeldBounds] = useState<Bounds | null>(null)
  const listBounds = heldBounds ?? bounds
  const boundsRef = useRef(bounds)
  boundsRef.current = bounds
  const [peek, setPeek] = useState(false)
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
  const [sort, setSort] = useState<Sort>('visitors')
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
  // 강추만: 유튜버가 강추한 곳만
  const [strongOnly, setStrongOnly] = useState(false)
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
    const cached = readCache(cacheKey(lang))
    hadCache.current = !!cached
    if (cached) setPins(cached)
    // 토스 앱을 막 띄운 순간엔 요청이 바로 실패하곤 해서 몇 번 더 받아 본다
    let live = true
    const t0 = performance.now()
    const load = (n: number) => loadPins(apiBase, lang)
      .then((p: PinsPayload) => {
        writeCache(cacheKey(lang), p)
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
  }, [apiBase, pinsTry, lang])

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
  // 외국어 지도는 유튜버 이름을 그 언어로 보이고, 한글 이름(alt)으로도 찾게 한다
  const faceChannels = useMemo(() => channels.map((c) => ({
    ...c,
    name: lang ? channelName(c.name, lang) : c.name,
    alt: lang ? c.name : undefined,
    thumbnail_url: c.thumbnail_url ? `${apiBase}/api/face/${c.id}` : null,
  })), [channels, apiBase, lang])

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

  const koName = useMemo(() => new Map(channels.map((c) => [c.id, c.name])), [channels])
  const index = useMemo(() => (pins ? buildIndex(pins, (id) => faces[id]?.name || '', lang
    ? (p) => [...p.ch.map((id) => koName.get(id) || ''), t.area(p.region, p.city)].join(' ')
    : undefined) : null), [pins, faces, lang, koName, t])
  const textHits = useMemo(() => (index && text ? new Set(searchPins(index, text).map((p) => p.id)) : null), [index, text])

  const filtered = useMemo(() => (pins || []).filter((p) =>
    (!channelId || p.ch.includes(channelId)) && (!region || p.region === region) && (!city || p.city === city) &&
    (!textHits || textHits.has(p.id)) && (!likedOnly || likes.has(p.id)) && (!strongOnly || p.rec === '강추')
  ), [pins, channelId, region, city, textHits, likedOnly, likes, strongOnly])

  // 찜한 곳은 지도 밖에 있어도 다 보여준다
  const inView = useMemo(() => (listBounds && !likedOnly ? filtered.filter((p) => inBounds(p, listBounds)) : filtered), [filtered, listBounds, likedOnly])

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

  // 목록 시트: 지도에선 반쯤(내려 두면 머리줄만), 목록 단계에선 전체. 카드가 뜨면 내려 두고, 상세는 열기 전 높이를 기억한다
  const sheetLast = useRef<SheetSnap>('half')
  if (nav.v === 'list') sheetLast.current = 'full'
  else if (nav.v !== 'detail') sheetLast.current = peek ? 'peek' : 'half'
  const sheetSnap = sheetLast.current
  const sheetHidden = nav.v === 'preview' || (nav.v === 'detail' && sheetSnap !== 'full')
  const listOpen = desktop || !sheetHidden

  const sorted = useMemo(() => {
    if (!listOpen) return []
    const list = [...inView]
    if (sort === 'latest') return list.sort((a, b) => b.date.localeCompare(a.date))
    return list.sort((a, b) => b.ch.length - a.ch.length || b.date.localeCompare(a.date))
  }, [inView, sort, listOpen])

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
      p = fetch(`${apiBase}/api/restaurants/${id}${lang ? `?lang=${lang}` : ''}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      details.current.set(id, p)
    }
    return p
  }, [apiBase, lang])

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
        setToast(t.loadFail)
      }
    })
    return () => { live = false }
  }, [detailId, loadDetail, t])

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
    else {
      setHeldBounds((b) => b ?? boundsRef.current)
      push({ v: 'preview', id })
    }
  }, [desktop, openDetail, push, replace])

  // 지도를 직접 옮기거나 조건·위치를 새로 정하면 붙잡아 둔 목록을 놓는다
  const releaseList = useCallback(() => setHeldBounds(null), [])
  useEffect(() => { releaseList() }, [fitKey, channelId, region, city, text, likedOnly, strongOnly, releaseList])
  useEffect(() => { if (focus && !('id' in focus)) releaseList() }, [focus, releaseList])

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

  // 바깥(onLikeChange)에 한 번만 알리려고 상태 갱신 함수 밖에서 계산한다(StrictMode는 갱신 함수를 두 번 부른다)
  const likesRef = useRef(likes)
  likesRef.current = likes
  const toggleLike = useCallback((id: number) => {
    const next = new Set(likesRef.current)
    const on = !next.has(id)
    if (on) next.add(id)
    else next.delete(id)
    likesRef.current = next
    setLikes(next)
    likeStore.set(JSON.stringify(Array.from(next))).catch(() => {})
    track('like_toggle', { id, on, count: next.size })
    setToast(on ? t.liked : t.unliked)
    onLikeChange?.(Array.from(next), on)
  }, [likeStore, onLikeChange, t])

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
    if (lang) {
      const what = [ch && nameOf(ch.id), region && t.area(region, city), text && t.quoted(text).trim()].filter(Boolean).join(' · ')
      return { query: sp.toString(), text: `🍽️ ${what} — ${t.brand}` }
    }
    const what = [ch?.name, city ? `${region} ${city}` : region, text && `‘${text}’`].filter(Boolean).join(' ')
    return listMessage(sp.toString(), what, filtered, nameOf)
  }, [pins, channelId, channels, region, city, text, filtered, nameOf, lang, t])
  // 공유 창까지 열었으면 완료 안내
  const doShare = (msg: ShareMessage) => {
    if (!onShare) return
    // 외국어 지도의 웹 공유는 그 언어 페이지 주소와 안내 글로
    const run = lang && onShare === webShare ? webShare(msg, { lang, copied: t.copied }) : onShare(msg)
    Promise.resolve(run).then((ok) => { if (ok) setToast(typeof ok === 'string' ? ok : t.shared) })
  }
  const sharePlace = (id: number, query: string) => {
    const p = pinById.get(id)
    if (lang) {
      const name = p?.name || (detail?.id === id ? detail.name : '')
      if (name) doShare({ query, text: `🍽️ ${name} — ${t.tagline}` })
    } else if (p) doShare(placeMessage(p, query, nameOf))
    // 핀 목록보다 상세가 먼저 뜬 경우에도 누르면 공유한다
    else if (detail?.id === id) doShare(placeNameMessage(detail.name, detail.address, query))
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
      t={t}
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
        {t.placeOnly(lang ? t.area(region, city) : place)}
        <XIcon />
        <span className="sr-only">{t.clearPlace}</span>
      </button>
    )}
    <nav aria-label={t.pickYoutuber} className={`no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 pr-4 lg:pr-5 ${place ? 'pl-2' : 'pl-4 lg:pl-5'}`}>
      <button
        type="button"
        onClick={() => { setText(''); setLikedOnly(false); setStrongOnly(false); pickChannel(null) }}
        aria-pressed={!channelId && !text && !likedOnly && !strongOnly}
        className={`flex h-9 flex-shrink-0 items-center rounded-full px-3.5 text-meta font-bold ${
          !channelId && !text && !likedOnly && !strongOnly ? 'bg-ink text-paper' : 'bg-paper text-ink'
        } ${floating ? 'shadow-[0_2px_8px_rgba(27,29,31,0.15)]' : 'border border-line'}`}
      >
        {t.all}
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
          {t.likedN(likes.size)}
        </button>
      )}
      <button
        type="button"
        data-testid="strong-chip"
        onClick={() => { closePreview(); setStrongOnly((v) => !v) }}
        aria-pressed={strongOnly}
        className={`flex h-9 flex-shrink-0 items-center rounded-full px-3.5 text-meta font-bold ${
          strongOnly ? 'bg-ink text-paper' : 'bg-paper text-ink'
        } ${floating ? 'shadow-[0_2px_8px_rgba(27,29,31,0.15)]' : 'border border-line'}`}
      >
        {t.strongOnly}
      </button>
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
              <ChannelFace face={{ id: ch.id, name: faces[ch.id]?.name || ch.name, thumbnail: faces[ch.id]?.thumbnail ?? null }} size={28} />
            </span>
            {faces[ch.id]?.name || ch.name}
            {empty && <span className="sr-only">{t.noPlacesHere}</span>}
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
          {t.quoted(text).trim()}
          <XIcon />
          <span className="sr-only">{t.clearSearch}</span>
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
      aria-label={t.backToList}
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-paper text-ink shadow-[0_2px_12px_rgba(27,29,31,0.12)] lg:shadow-none"
    >
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </a>
  )

  const label = text ? t.quoted(text) : likedOnly ? t.likedPlaces : t.inMap
  const halfSheet = !desktop && sheetSnap !== 'full' && !sheetHidden
  // 시트 머리줄: 개수·공유·정렬. 반쯤일 땐 개수를 누르면 목록을 다 펼친다
  const listHead = (
    <div className="flex h-14 items-center justify-between gap-2 px-4 lg:px-5">
      {halfSheet ? (
        <button type="button" data-testid="list-pill" onClick={() => (peek ? setPeek(false) : push({ v: 'list' }))} className="flex min-h-[44px] min-w-0 flex-1 items-center text-left text-lead font-bold text-ink">
          {label}
          {count !== null
            ? <span data-testid="pill-count" className="ml-1">{t.count(count)}</span>
            : pins === null && <span data-testid="pins-loading" className="ml-1 font-normal text-sub">{t.loading}</span>}
        </button>
      ) : (
        <h2 className="text-lead font-bold text-ink" aria-live="polite">
          {label}
          {lang ? <span data-testid="list-count">{t.count(count ?? 0)}</span> : <><span data-testid="list-count">{count ?? 0}</span>곳</>}
        </h2>
      )}
      <div className="flex flex-shrink-0 items-center gap-1">
        {channelAction && channelId && channelAction({ id: channelId, name: nameOf(channelId) || '' })}
        {likedAction && likedOnly && likedAction(Array.from(likes))}
        {share && (
          <button
            type="button"
            data-testid="share-filter"
            onClick={() => doShare(share)}
            className="flex min-h-[44px] items-center gap-1 px-2 text-meta font-bold text-ink"
          >
            <ShareIcon />
            {t.share}
          </button>
        )}
        <label className="relative inline-flex min-h-[44px] items-center pl-2 text-meta font-bold text-ink">
          <span className="sr-only">{t.sort}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="appearance-none bg-transparent pr-5 font-bold text-ink outline-none"
          >
            <option value="visitors">{t.sortVisitors}</option>
            <option value="latest">{t.sortLatest}</option>
          </select>
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className="pointer-events-none absolute right-0"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </label>
      </div>
    </div>
  )
  const listBody = (
    <div ref={listRef} className={`h-full ${halfSheet ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'}`}>
      <div className="px-4 lg:px-5">
        {pins && sorted.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-body text-ink">
              {text ? t.emptyText(text)
                : channelId ? t.emptyChannel(nameOf(channelId) || null)
                : t.emptyMap}
            </p>
            <p className="mt-1 text-meta text-sub">{t.emptyHint}</p>
          </div>
        )}
        {sorted.slice(0, shown).map((p, i) => (
          <Fragment key={p.id}>
            <PinRow pin={p} faces={faces} onOpen={openFromList} selected={p.id === detailId} t={t} />
            {listAd && i >= 2 && (i - 2) % LIST_AD_EVERY === 0 && listAd((i - 2) / LIST_AD_EVERY)}
          </Fragment>
        ))}
        <div ref={sentinel} />
      </div>
      <div className="px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-8 lg:px-5 lg:pb-8">{children}</div>
    </div>
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

      {/* 목록: 모바일은 지도 위에 반쯤 올라온 시트(끌어올리면 전체 화면), 데스크톱은 왼쪽 기둥 */}
      {desktop ? (
        <section data-testid="list-view" aria-label={t.listTitle} className="static flex h-full w-[400px] flex-shrink-0 flex-col border-r border-line bg-paper">
          <header className="px-5 pb-3 pt-5">
            <p className="font-caption text-title text-ink">{t.brand}</p>
            <p className="mt-0.5 text-meta text-sub">{t.tagline}</p>
            <div className="mt-4 flex items-center gap-2">
              {backBtn}
              {search}
            </div>
          </header>
          <div className="border-b border-line bg-paper">
            {listHead}
            <div className="pb-3">{chips(false)}</div>
          </div>
          {listBody}
        </section>
      ) : (
        <ListSheet
          testId="list-view"
          snap={sheetSnap}
          hidden={sheetHidden}
          onSnap={(s) => {
            if (s === 'full') {
              setPeek(false)
              if (readNav().v === 'map') push({ v: 'list' })
            } else {
              setPeek(s === 'peek')
              if (readNav().v === 'list') back()
            }
          }}
          className="z-30"
          header={sheetSnap === 'full' ? (
            <div className="border-b border-line bg-paper pt-[env(safe-area-inset-top)]">
              {listHead}
              <div className="pb-3">{chips(false)}</div>
            </div>
          ) : listHead}
        >
          {listBody}
          {sheetSnap === 'full' && (
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center pb-[calc(16px+env(safe-area-inset-bottom))]">
              <button
                type="button"
                data-testid="map-pill"
                onClick={back}
                className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-body font-bold text-paper shadow-[0_4px_16px_rgba(27,29,31,0.16)]"
              >
                <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path d="M2 4.5 6.5 3l5 1.5L16 3v10.5L11.5 15l-5-1.5L2 15z M6.5 3v10.5 M11.5 4.5V15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                {t.viewMap}
              </button>
            </div>
          )}
        </ListSheet>
      )}

      <main className="relative isolate z-0 flex-1 overflow-hidden">
        <NaverMap
          pins={filtered}
          faces={faces}
          selectedId={previewId ?? detailId}
          onPinClick={selectPin}
          onMapClick={onMapClick}
          onBoundsChange={setBounds}
          onUserMove={releaseList}
          fitKey={fitKey}
          focus={focus}
          insets={insets}
          t={t}
          language={lang ? (lang.startsWith('zh') ? 'zh' : lang) : undefined}
          fitBottom={desktop || sheetHidden || sheetSnap === 'full' || typeof window === 'undefined' ? 0 : sheetSnap === 'peek' ? PEEK_PX : Math.round(window.innerHeight * HALF_RATIO)}
        />

        {/* 지도 아래: 고른 가게 카드. 카드가 없으면 목록 시트가 반쯤 올라와 있다 */}
        {preview.shown && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[calc(16px+env(safe-area-inset-bottom))] lg:hidden">
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
                t={t}
              />
            </div>
          </div>
        )}
      </main>

      {/* 상세: 모바일은 전체 화면, 데스크톱은 왼쪽 기둥을 덮는다 */}
      {shownDetailId && (
        <section
          data-testid="detail-view"
          aria-label={t.detailTitle}
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
                aria-label={t.back}
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
              if ((e.target as Element).closest('[data-track="video_watch_click"]')) setToast(t.openScene)
            }}
          >
            {shownDetail ? (
              <>
                <DetailPanel
                  restaurant={shownDetail}
                  channelHref={pageLinks && !lang ? (slug) => `/youtuber/${encodeURIComponent(slug)}` : undefined}
                  adSlot={detailAd?.(shownDetail.id)}
                  onShare={() => sharePlace(shownDetail.id, `place=${shownDetail.id}`)}
                  liked={likes.has(shownDetail.id)}
                  onLike={() => toggleLike(shownDetail.id)}
                  {...(lang && { labels: LABELS[lang], closeLabel: t.close, likeLabel: t.like })}
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

      {pinsFailed && <RetryNotice testId="pins-retry" title={t.pinsFail} hint={t.retryHint} retry={t.retry} onRetry={retryPins} />}
      {toast && <Toast message={toast} onClose={handleToastClose} />}
      <Intro ready={mapReady} loaded={pins !== null} channels={faceChannels} brand={t.brand} tagline={t.tagline} />
    </div>
  )
}
