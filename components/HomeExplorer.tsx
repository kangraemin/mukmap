'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NaverMap, { type Face } from '@/components/NaverMap'
import SearchBar from '@/components/SearchBar'
import DetailPanel from '@/components/DetailPanel'
import { ChannelFace } from '@/components/ChannelFace'
import { PinRow, PreviewCard } from '@/components/PinCard'
import Toast from '@/components/Toast'
import { decodePins, inBounds, loadPins, type Bounds, type Pin, type PinsPayload } from '@/lib/pins'
import { buildIndex, searchPins } from '@/lib/search'
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
const CACHE_KEY = 'mukmap:pins:v2'

interface HomeExplorerProps {
  channels: (Channel & { restaurant_count: number })[]
  /** 서버에서 그린 유튜버·지역 링크 목록. 목록 맨 아래에 붙는다 */
  children?: React.ReactNode
  /** API 주소 앞부분. 토스 앱은 https://mukmap.kr 을 넘긴다 */
  apiBase?: string
  /** 가게·유튜버 페이지 링크를 걸지. 토스 앱에는 그 페이지가 없어 끈다 */
  pageLinks?: boolean
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

export default function HomeExplorer({ channels, children, apiBase = '', pageLinks = true }: HomeExplorerProps) {
  const [pins, setPins] = useState<Pin[] | null>(null)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [channelId, setChannelId] = useState<string | null>(null)
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [text, setText] = useState('')
  const [nav, setNav] = useState<Nav>({ v: 'map' })
  const [sort, setSort] = useState<Sort>('near')
  const [shown, setShown] = useState(PAGE)
  const [fitKey, setFitKey] = useState(0)
  const [focus, setFocus] = useState<{ id: number; seq: number } | null>(null)
  const [detail, setDetail] = useState<RestaurantWithVideos | null>(null)
  const [toast, setToast] = useState('')
  const [desktop, setDesktop] = useState(false)

  const details = useRef<Map<number, Promise<RestaurantWithVideos | null>>>(new Map())
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
    if (cached) setPins(cached)
    loadPins(apiBase)
      .then((p: PinsPayload) => {
        writeCache(p)
        setPins(decodePins(p))
      })
      .catch(() => {
        if (!cached) setToast('가게 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 보세요.')
      })
  }, [apiBase])

  // 프로필 사진은 우리 주소를 거쳐 받는다(app/api/face)
  const faceChannels = useMemo(() => channels.map((c) => ({ ...c, thumbnail_url: c.thumbnail_url ? `${apiBase}/api/face/${c.id}` : null })), [channels, apiBase])
  const faces = useMemo(() => {
    const m: Record<string, Face> = {}
    for (const c of faceChannels) m[c.id] = { name: c.name, thumbnail: c.thumbnail_url }
    return m
  }, [faceChannels])

  const pinById = useMemo(() => new Map((pins || []).map((p) => [p.id, p])), [pins])

  const index = useMemo(() => (pins ? buildIndex(pins, (id) => faces[id]?.name || '') : null), [pins, faces])
  const textHits = useMemo(() => (index && text ? new Set(searchPins(index, text).map((p) => p.id)) : null), [index, text])

  const filtered = useMemo(() => (pins || []).filter((p) =>
    (!channelId || p.ch.includes(channelId)) && (!region || p.region === region) && (!city || p.city === city) &&
    (!textHits || textHits.has(p.id))
  ), [pins, channelId, region, city, textHits])

  const inView = useMemo(() => (bounds ? filtered.filter((p) => inBounds(p, bounds)) : filtered), [filtered, bounds])

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

  const selectPin = useCallback((id: number) => {
    if (desktop) return openDetail(id)
    const cur = readNav()
    if (cur.v === 'preview') replace({ v: 'preview', id })
    else push({ v: 'preview', id })
  }, [desktop, openDetail, push, replace])

  const onMapClick = useCallback(() => {
    if (readNav().v === 'preview') window.history.back()
  }, [])

  const searchAll = useCallback((q: string) => {
    setText(q)
    setChannelId(null)
    setRegion('')
    setCity('')
    setFitKey((k) => k + 1)
    if (readNav().v === 'preview') window.history.back()
  }, [])

  const searchChannel = useCallback((id: string) => {
    setText('')
    setChannelId(id)
    setFitKey((k) => k + 1)
  }, [])

  const searchRegion = useCallback((name: string) => {
    setText('')
    setRegion(name)
    setCity('')
    setFitKey((k) => k + 1)
  }, [])

  const searchRestaurant = useCallback((id: number) => {
    setFocus({ id, seq: Date.now() })
    if (desktop || readNav().v === 'list') openDetail(id)
    else selectPin(id)
  }, [desktop, openDetail, selectPin])

  const pickChannel = useCallback((id: string | null) => {
    setChannelId(id)
    setFitKey((k) => k + 1)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && readNav().v !== 'map') window.history.back() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 목록·가게 페이지에서 넘어온 조건(?yt=쯔양&region=서울, ?place=12)으로 연다
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const yt = q.get('yt')
    const ch = yt ? channels.find((c) => c.slug === yt || c.id === yt) : undefined
    const reg = q.get('region')
    const place = Number(q.get('place'))
    if (ch) setChannelId(ch.id)
    if (reg) setRegion(reg)
    if (reg && q.get('city')) setCity(q.get('city')!)
    if (ch || reg) fitWhenLoaded.current = true
    if (Number.isInteger(place) && place > 0 && readNav().v === 'map') {
      push({ v: 'detail', id: place })
      setFocus({ id: place, seq: Date.now() })
    }
    // 첫 진입 한 번만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const place = [region, city].filter(Boolean).join(' ')
  const preview = usePresence(previewId ? pinById.get(previewId) ?? null : null, 200)
  const detailP = usePresence(detailId, 240)
  const listP = usePresence(nav.v === 'list' ? true : null, 200)
  const shownDetailId = detailP.shown
  const detailPin = shownDetailId ? pinById.get(shownDetailId) : undefined
  const shownDetail = detail && detail.id === shownDetailId ? detail : null
  const count = pins ? inView.length : null
  const search = (
    <SearchBar
      index={index}
      channels={faceChannels}
      onSelectRestaurant={searchRestaurant}
      onSelectChannel={searchChannel}
      onSelectRegion={searchRegion}
      onSearchAll={searchAll}
    />
  )

  const chips = (floating: boolean) => (
    <nav aria-label="유튜버 고르기" className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-1 lg:px-5">
      <button
        type="button"
        onClick={() => { setText(''); pickChannel(null) }}
        aria-pressed={!channelId && !text}
        className={`flex h-9 flex-shrink-0 items-center rounded-full px-3.5 text-meta font-bold ${
          !channelId && !text ? 'bg-ink text-paper' : 'bg-paper text-ink'
        } ${floating ? 'shadow-[0_2px_8px_rgba(27,29,31,0.15)]' : 'border border-line'}`}
      >
        전체
      </button>
      {channels.map((ch) => {
        const on = ch.id === channelId
        return (
          <button
            key={ch.id}
            type="button"
            onClick={() => pickChannel(on ? null : ch.id)}
            aria-pressed={on}
            className={`flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3 text-meta font-bold ${
              on ? 'bg-ink text-paper' : 'bg-paper text-ink'
            } ${floating ? 'shadow-[0_2px_8px_rgba(27,29,31,0.15)]' : 'border border-line'}`}
          >
            <ChannelFace face={{ id: ch.id, name: ch.name, thumbnail: faces[ch.id]?.thumbnail ?? null }} size={28} />
            {ch.name}
          </button>
        )
      })}
      {text && (
        <button
          type="button"
          data-testid="text-chip"
          onClick={() => { setText(''); setFitKey((k) => k + 1) }}
          className={`order-first flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-meta font-bold text-paper ${floating ? 'shadow-[0_2px_8px_rgba(27,29,31,0.15)]' : ''}`}
        >
          ‘{text}’
          <XIcon />
          <span className="sr-only">검색 조건 풀기</span>
        </button>
      )}
      {place && (
        <button
          type="button"
          onClick={() => { setRegion(''); setCity('') }}
          className={`flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-meta font-bold text-paper ${floating ? 'shadow-[0_2px_8px_rgba(27,29,31,0.15)]' : ''}`}
        >
          {place}
          <XIcon />
          <span className="sr-only">지역 조건 풀기</span>
        </button>
      )}
    </nav>
  )

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-paper">
      {/* 지도 위: 검색 + 유튜버 칩(모바일) */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 pt-[calc(10px+env(safe-area-inset-top))] lg:hidden">
        <div className="pointer-events-auto px-4">
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
          <div className="mt-4">
            {search}
          </div>
        </header>

        <div className="border-b border-line bg-paper pt-[env(safe-area-inset-top)] lg:pt-0">
          <div className="flex h-14 items-center justify-between px-4 lg:px-5">
            <h2 className="text-lead font-bold text-ink" aria-live="polite">
              {text ? `‘${text}’ ` : '이 지도 안 '}<span data-testid="list-count">{count ?? 0}</span>곳
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
                <p className="text-body text-ink">{text ? `‘${text}’에 맞는 가게가 이 지도 안에 없어요.` : '이 지도 안에는 아직 가게가 없어요.'}</p>
                <p className="mt-1 text-meta text-sub">지도를 줄이거나 다른 지역으로 옮겨 보세요.</p>
              </div>
            )}
            {sorted.slice(0, shown).map((p) => (
              <PinRow key={p.id} pin={p} faces={faces} onOpen={openDetail} selected={p.id === detailId} />
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
        />

        {/* 지도 아래: 고른 가게 카드, 아니면 목록 보기 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[calc(16px+env(safe-area-inset-bottom))] lg:hidden">
          {preview.shown ? (
            <div className="pointer-events-auto w-full">
              <PreviewCard
                key={preview.shown.id}
                pin={preview.shown}
                faces={faces}
                leaving={preview.leaving}
                onOpen={() => push({ v: 'detail', id: preview.shown!.id })}
                onClose={back}
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
              {count !== null && <span data-testid="pill-count" className="font-normal opacity-80">{count}곳</span>}
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
          <header className="flex-shrink-0 border-b border-line bg-paper pt-[env(safe-area-inset-top)]">
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
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain sm:px-5">
            {shownDetail ? (
              <>
                <DetailPanel
                  restaurant={shownDetail}
                  channelHref={pageLinks ? (slug) => `/youtuber/${encodeURIComponent(slug)}` : undefined}
                />
                {pageLinks && (
                  <p className="px-4 pb-8 sm:px-0">
                    <a href={`/restaurant/${shownDetail.id}`} className="inline-flex min-h-[44px] items-center text-meta text-sub underline underline-offset-2">
                      이 가게만 따로 보기
                    </a>
                  </p>
                )}
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

      {toast && <Toast message={toast} onClose={handleToastClose} />}
      <Intro ready={pins !== null && bounds !== null} channels={faceChannels} />
    </div>
  )
}
