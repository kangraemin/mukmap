'use client'
// 목록 페이지 위 지도. 평소엔 손으로 못 미는 작은 지도이고, 핀을 누르면 화면을 다 채우며 그 가게 카드를 띄운다.
// 큰 지도에서 손으로 옮기면 위에 '이 지역에서 다시 찾기'가 뜨고, 누르면 홈 지도처럼 그 화면 안 가게 핀을 다시 찍는다(목록은 그대로)
// 카드가 없을 땐 지도 위에 이 목록 가게가 반쯤 올라와 있고, 끌어올리면 화면을 다 채운다(홈 지도와 같다)
import { useCallback, useEffect, useRef, useState } from 'react'
import NaverMap, { type Face, type MapFocus } from '@/components/NaverMap'
import { PinRow, PreviewCard } from '@/components/PinCard'
import ListSheet, { HALF_RATIO, PEEK_PX, type SheetSnap } from '@/components/ListSheet'
import { inBounds, type Bounds, type Pin } from '@/lib/pins'

interface ListMapProps {
  pins: Pin[]
  /** 다시 찾기에서 고르는 전체 가게 핀 */
  allPins: Pin[]
  faces: Record<string, Face>
  /** 큰 지도 위 '‹ … 목록으로'에 쓰는 이 목록 이름 */
  title: string
  /** 핀을 아직 못 받았으면 개수 대신 자리만 잡는다 */
  loading?: boolean
  /** 큰 지도 위 '전체 지도'가 여는 홈 지도 주소. 지도로 가는 길은 이것 하나만 둔다 */
  mapHref: string
}

const SHEET_PAGE = 40

export default function ListMap({ pins: pagePins, allPins, faces, title, loading, mapHref }: ListMapProps) {
  // 글과 카드가 먼저 그려지게, 브라우저가 한가해진 뒤에 지도를 붙인다
  const [armed, setArmed] = useState(false)
  const [full, setFull] = useState(false)
  const [sel, setSel] = useState<number | null>(null)
  const [moved, setMoved] = useState(false)
  const [fitKey, setFitKey] = useState(0)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  // 다시 찾은 그 지역 핀. 큰 지도를 닫으면 이 목록 핀으로 돌아간다
  const [found, setFound] = useState<Pin[] | null>(null)
  const pins = full && found ? found : pagePins
  const [insets, setInsets] = useState<{ top: number; bottom: number } | null>(null)
  const [snap, setSnap] = useState<SheetSnap>('half')
  const [rows, setRows] = useState(SHEET_PAGE)
  const [barH, setBarH] = useState(0)
  const bounds = useRef<Bounds | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setArmed(true), { timeout: 1500 })
      return () => w.cancelIdleCallback?.(id)
    }
    const t = setTimeout(() => setArmed(true), 300)
    return () => clearTimeout(t)
  }, [])

  // 핀이 바뀌면(칩·다시 찾기) 작은 지도를 그 핀들에 맞춘다
  const ids = pagePins.map((p) => p.id).join(',')
  useEffect(() => {
    if (!full) setFitKey((k) => k + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])

  // 휴대폰 뒤로 가기로 큰 지도를 닫는다
  useEffect(() => {
    if (!full) return
    const onPop = () => close(false)
    window.addEventListener('popstate', onPop)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('popstate', onPop)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full])

  const open = useCallback((after?: () => void) => {
    setFull(true)
    setMoved(false)
    history.pushState({ ...(history.state || {}), listMap: 1 }, '')
    // 틀이 커진 뒤에 옮겨야 큰 화면 기준으로 맞는다
    setTimeout(() => after?.(), 60)
  }, [])

  const close = useCallback((viaButton: boolean) => {
    if (viaButton && history.state?.listMap) {
      history.back()
      return
    }
    setFull(false)
    setSel(null)
    setMoved(false)
    setFound(null)
    setSnap('half')
    setTimeout(() => setFitKey((k) => k + 1), 60)
  }, [])

  const onPinClick = (id: number) => {
    if (full) {
      setSel(id)
      setMoved(false)
      return
    }
    setSel(id)
    open()
  }

  const onMapClick = () => {
    if (full) setSel(null)
    else open(() => setFitKey((k) => k + 1))
  }

  const onClusterClick = (lats: number[], lngs: number[]) => {
    const go = () => setFocus({ seq: ++seq.current, lats, lngs })
    if (full) go()
    else open(go)
  }

  // 지도는 그 자리에 두고 화면 안 가게 핀만 다시 찍는다
  const search = () => {
    const b = bounds.current
    if (!b) return
    setFound(allPins.filter((p) => inBounds(p, b)))
    setRows(SHEET_PAGE)
    setSel(null)
    setMoved(false)
  }

  useEffect(() => {
    if (full && barRef.current) setBarH(barRef.current.offsetHeight)
  }, [full])

  // 카드가 뜨면 위 막대와 카드 사이 빈 곳 가운데에 고른 핀을 둔다
  const selPin = sel != null ? pins.find((p) => p.id === sel) ?? null : null
  useEffect(() => {
    const bar = barRef.current
    const card = cardRef.current
    if (!full || !selPin || !bar || !card) { setInsets(null); return }
    const measure = () => {
      const top = bar.getBoundingClientRect().bottom
      const bottom = window.innerHeight - card.getBoundingClientRect().top
      setInsets((cur) => (cur && Math.abs(cur.top - top) < 2 && Math.abs(cur.bottom - bottom) < 2 ? cur : { top, bottom }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(card)
    return () => ro.disconnect()
  }, [full, selPin])

  return (
    <div className="mt-4">
      {/* 자리를 먼저 잡아 두어 지도가 늦게 떠도, 큰 지도로 바뀌어도 글이 밀리지 않는다 */}
      <div data-testid="map-preview" className="relative h-[220px] overflow-hidden rounded-card bg-well">
        <div
          data-testid="list-map"
          data-full={full ? '1' : '0'}
          className={full ? 'fixed inset-0 z-50 bg-well' : 'absolute inset-0'}
        >
          {/* 네이버 지도가 이 칸을 position:relative로 바꿔 inset으로 잡은 높이가 0이 됐다. 높이를 직접 준다 */}
          <div className="h-full w-full">
            {/* 다시 찾는 동안엔 지도를 붙이지 않는다. 붙이면 기본 위치(전국)로 잠깐 튄다 */}
            {armed && !loading && (
              <NaverMap
                pins={pins}
                faces={faces}
                selectedId={full ? sel : null}
                onPinClick={onPinClick}
                onMapClick={onMapClick}
                onBoundsChange={(b) => { bounds.current = b }}
                fitKey={fitKey}
                focus={focus}
                insets={full ? insets : null}
                fitBottom={full && !selPin ? (snap === 'peek' ? PEEK_PX : Math.round(window.innerHeight * HALF_RATIO)) : 0}
                still={!full}
                onUserMove={() => {
                  if (!full) return
                  setSel(null)
                  setMoved(true)
                }}
                onClusterClick={full ? undefined : onClusterClick}
              />
            )}
          </div>

          {/* 작은 지도 위에 붙은 '크게 보기'. 지도 아무 데나 눌러도 같다. 오른쪽 아래 NAVER 로고를 가리지 않게 위에 둔다 */}
          {!full && (
            <button
              type="button"
              data-testid="map-expand"
              onClick={() => open(() => setFitKey((k) => k + 1))}
              className="absolute right-2.5 top-2.5 z-10 inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-paper pl-3 pr-3.5 text-meta font-bold text-ink shadow-[0_2px_8px_rgba(27,29,31,0.2)]"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              크게 보기{!loading && <span className="font-normal text-sub">{pins.length}곳</span>}
            </button>
          )}

          {full && (
            <>
              <div ref={barRef} className="absolute inset-x-0 top-0 z-10 flex items-center bg-paper px-2 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(27,29,31,0.08)]">
                <button
                  type="button"
                  data-testid="map-back"
                  onClick={() => close(true)}
                  className="flex min-h-[52px] min-w-0 flex-1 items-center gap-1 px-2 text-left text-body font-bold text-ink"
                >
                  <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" className="flex-shrink-0"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span className="truncate">{title} 목록으로</span>
                </button>
                <a href={mapHref} data-testid="open-map" className="inline-flex min-h-[44px] flex-shrink-0 items-center px-2 text-meta font-bold text-sub">
                  전체 지도
                </a>
              </div>
              {/* 가운데 정렬은 바깥 줄이 맡는다. 버튼에 translate를 주면 나타나는 애니메이션이 덮어써 오른쪽으로 치우쳤다 */}
              {moved && (
                <div style={{ top: 'calc(64px + env(safe-area-inset-top))' }} className="pointer-events-none absolute inset-x-0 z-10 flex justify-center">
                <button
                  type="button"
                  data-testid="search-here"
                  onClick={search}
                  className="pointer-events-auto inline-flex h-11 animate-sheet-in items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 text-body font-bold text-paper shadow-[0_4px_16px_rgba(27,29,31,0.24)]"
                >
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.8h-2.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  이 지역에서 다시 찾기
                </button>
                </div>
              )}
              {selPin && (
                <div ref={cardRef} className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
                  <PreviewCard
                    key={selPin.id}
                    pin={selPin}
                    faces={faces}
                    onOpen={() => { window.location.href = `/restaurant/${selPin.id}` }}
                    // ✕는 카드만 닫고 지도 위에 이 목록을 반쯤 다시 띄운다. 원래 페이지로는 위 '‹ 목록으로'·뒤로 가기로 간다
                    onClose={() => { setSel(null); setSnap('half') }}
                  />
                </div>
              )}
              <ListSheet
                testId="map-list"
                snap={snap}
                onSnap={setSnap}
                hidden={!!selPin}
                fullTop={barH}
                className="z-20"
                header={(
                  <button
                    type="button"
                    data-testid="map-list-head"
                    onClick={() => setSnap(snap === 'peek' ? 'half' : 'full')}
                    className="flex h-12 w-full items-center px-4 text-left text-lead font-bold text-ink"
                  >
                    <span className="truncate">{found ? '이 지역' : title.replace(/\s*[\d,]+곳$/, '')}</span>
                    <span data-testid="map-list-count" className="ml-1.5 flex-shrink-0">{pins.length}곳</span>
                  </button>
                )}
              >
                <div className={`h-full ${snap !== 'full' ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'}`}>
                  <div className="px-4 pb-[calc(96px+env(safe-area-inset-bottom))]">
                    {pins.length === 0 && <p className="py-10 text-center text-body text-sub">이 지도 안에는 가게가 없어요. 지도를 옮겨 다시 찾아 보세요.</p>}
                    {pins.slice(0, rows).map((p) => (
                      <PinRow key={p.id} pin={p} faces={faces} onOpen={(id) => { window.location.href = `/restaurant/${id}` }} />
                    ))}
                    {pins.length > rows && (
                      <button type="button" data-testid="map-list-more" onClick={() => setRows((n) => n + SHEET_PAGE)} className="mt-3 h-12 w-full rounded-card bg-well text-body font-bold text-ink">
                        {pins.length - rows}곳 더 보기
                      </button>
                    )}
                  </div>
                </div>
                {snap === 'full' && (
                  <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center pb-[calc(16px+env(safe-area-inset-bottom))]">
                    <button
                      type="button"
                      data-testid="map-list-map"
                      onClick={() => setSnap('half')}
                      className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-body font-bold text-paper shadow-[0_4px_16px_rgba(27,29,31,0.16)]"
                    >
                      지도 보기
                    </button>
                  </div>
                )}
              </ListSheet>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
