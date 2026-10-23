'use client'
// 지도 위에 반쯤 올라오는 목록. 머리줄을 위로 끌면 화면을 다 채우고, 아래로 끌면 반쯤 → 머리줄만 남게 내려간다. 다 펼쳤을 땐 목록 맨 위에서 끌어내려도 내려간다
// 멈춰 있을 땐 단계 높이 그대로 두고, 끌고 붙는 동안엔 화면 높이로 펴 둔 채 transform으로만 옮긴다.
// 높이를 매 프레임 바꾸면 목록 전체를 다시 배치해 폰에서 버벅인다(2026-10-24 녹화). 움직임은 React 상태 없이 style을 직접 바꾼다.
// iOS는 화면 아래 끝에서 끌면 pointercancel이 오니 그때도 가까운 단계로 붙인다
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export type SheetSnap = 'peek' | 'half' | 'full'

/** 반쯤 올라왔을 때 시트 높이. 지도는 그 위 칸에 핀을 맞춘다 */
export const HALF_RATIO = 0.46

/** 내려 뒀을 때 남는 머리줄 높이(px, 아래 안전 영역 빼고) */
export const PEEK_PX = 76

interface ListSheetProps {
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  /** 카드가 떠 있는 동안처럼 잠깐 내려 둔다 */
  hidden?: boolean
  /** 다 펼쳤을 때 위에 남길 자리(px). 큰 지도 위 막대 높이 */
  fullTop?: number
  /** 끌 수 있는 머리줄 */
  header: ReactNode
  children: ReactNode
  testId?: string
  className?: string
}

type Drag = { y: number; h: number; last: number; moved: boolean }

const MOVE = 6
const SNAP_PX = 48
const EASE = 'cubic-bezier(0.2, 0.9, 0.25, 1)'
const TRANSITION = `transform 0.28s ${EASE}`

/** 단계별 멈춘 높이(CSS) */
const restHeight = (snap: SheetSnap, fullTop: number) => snap === 'full' ? `calc(100dvh - ${fullTop}px)`
  : snap === 'peek' ? `calc(${PEEK_PX}px + env(safe-area-inset-bottom))`
  : `${HALF_RATIO * 100}dvh`

export default function ListSheet({ snap, onSnap, hidden, fullTop = 0, header, children, testId, className = '' }: ListSheetProps) {
  const ref = useRef<HTMLElement>(null)
  const drag = useRef<Drag | null>(null)
  const swallowClick = useRef(false)
  const [dragging, setDragging] = useState(false)
  /** 손을 뗀 순간 보이던 높이. 다음 단계로 붙는 움직임의 출발점 */
  const fromPx = useRef<number | null>(null)
  const restPx = useRef(0)
  const endTimer = useRef<ReturnType<typeof setTimeout>>()
  // 머리줄 높이가 늦게 재져 fullTop이 바뀌어도 끌던 손을 놓치지 않게 ref로 읽는다
  const fullTopRef = useRef(fullTop)
  fullTopRef.current = fullTop

  const visible = (el: HTMLElement) => window.innerHeight - el.getBoundingClientRect().top
  /** 끄는 동안: 화면 높이로 펴고 보이는 높이 h만큼만 올라오게 옮긴다 */
  const follow = (h: number) => {
    const el = ref.current
    if (!el) return
    const full = window.innerHeight - fullTopRef.current
    el.style.transition = 'none'
    el.style.height = `${full}px`
    el.style.transform = `translateY(${full - Math.min(full, Math.max(PEEK_PX, h))}px)`
  }
  /** 보이는 높이 from에서 to 단계로 transform만 움직이고, 다 붙으면 단계 높이로 되돌린다 */
  const glide = (from: number, to: SheetSnap) => {
    const el = ref.current
    if (!el) return
    clearTimeout(endTimer.current)
    const rest = restHeight(to, fullTopRef.current)
    el.style.transition = 'none'
    el.style.transform = ''
    el.style.height = rest
    const toPx = el.offsetHeight
    restPx.current = toPx
    if (Math.abs(from - toPx) < 1) return
    const full = window.innerHeight - fullTopRef.current
    const top = Math.max(full, from, toPx)
    el.style.height = `${top}px`
    el.style.transform = `translateY(${top - from}px)`
    void el.offsetHeight
    el.style.transition = TRANSITION
    el.style.transform = `translateY(${top - toPx}px)`
    const done = (e?: TransitionEvent) => {
      // 안쪽 칩 색 바뀜 같은 남의 transition은 거른다
      if (e && (e.target !== el || e.propertyName !== 'transform')) return
      el.removeEventListener('transitionend', done)
      clearTimeout(endTimer.current)
      el.style.transition = 'none'
      el.style.height = rest
      el.style.transform = hiddenRef.current ? 'translateY(100%)' : ''
      void el.offsetHeight
      el.style.transition = TRANSITION
    }
    el.addEventListener('transitionend', done)
    endTimer.current = setTimeout(() => done(), 400)
  }

  // 단계가 바뀌면(끌어서든 눌러서든) 직전 높이에서 새 단계로 미끄러진다. 그리기 전에 덮어 써 한 프레임도 튀지 않는다
  // 내려 뒀다 다시 올라올 땐 hidden transform이 알아서 미끄러지니 덮지 않는다
  const firstRun = useRef(true)
  const hiddenRef = useRef(hidden)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const from = fromPx.current ?? restPx.current
    fromPx.current = null
    const wasHidden = hiddenRef.current
    hiddenRef.current = hidden
    if (firstRun.current || hidden || wasHidden) {
      firstRun.current = false
      restPx.current = el.offsetHeight
      return
    }
    glide(from, snap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, hidden])
  useEffect(() => () => clearTimeout(endTimer.current), [])

  const settle = (d: Drag | null) => {
    if (!d?.moved) return
    swallowClick.current = true
    setTimeout(() => { swallowClick.current = false }, 0)
    const dy = d.last - d.y
    setDragging(false)
    const now = Math.min(window.innerHeight - fullTopRef.current, Math.max(PEEK_PX, d.h - dy))
    if (Math.abs(dy) < SNAP_PX) { glide(now, snap); return }
    // 손을 뗀 높이에 가장 가까운 단계로 붙인다. 같은 단계면 끈 쪽으로 한 칸 옮긴다
    const vh = window.innerHeight
    const heights: Record<SheetSnap, number> = { peek: PEEK_PX, half: vh * HALF_RATIO, full: vh - fullTop }
    const order: SheetSnap[] = ['peek', 'half', 'full']
    const h = d.h - dy
    let next = order.reduce((a, b) => (Math.abs(heights[b] - h) < Math.abs(heights[a] - h) ? b : a))
    if (next === snap) next = order[Math.max(0, Math.min(2, order.indexOf(snap) + (dy < 0 ? 1 : -1)))]
    if (next === snap) { glide(now, snap); return }
    fromPx.current = now
    onSnap(next)
  }
  const finish = () => {
    const d = drag.current
    drag.current = null
    settle(d)
  }
  const settleRef = useRef(settle)
  settleRef.current = settle
  const followRef = useRef(follow)
  followRef.current = follow
  const startDrag = () => {
    clearTimeout(endTimer.current)
    setDragging(true)
  }
  const startRef = useRef(startDrag)
  startRef.current = startDrag

  // 다 펼친 목록은 맨 위까지 올라가 있을 때 아래로 끌면 시트째 내려간다(목록 어디를 잡아도).
  // 브라우저가 스크롤로 가져가지 않게 터치 이벤트를 passive 없이 직접 받는다
  useEffect(() => {
    const el = ref.current
    if (!el || snap !== 'full') return
    let t: (Drag & { top: boolean }) | null = null
    const scrollerOf = (n: Element | null) => {
      for (; n && n !== el; n = n.parentElement) {
        const o = getComputedStyle(n).overflowY
        if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n
      }
      return null
    }
    const start = (e: TouchEvent) => {
      const target = e.target as Element
      if (e.touches.length !== 1 || target.closest('[data-grip]')) { t = null; return }
      const sc = scrollerOf(target)
      const y = e.touches[0].clientY
      t = { y, last: y, h: visible(el), moved: false, top: !sc || sc.scrollTop <= 0 }
    }
    const move = (e: TouchEvent) => {
      if (!t?.top) return
      const y = e.touches[0].clientY
      const dy = y - t.y
      if (!t.moved) {
        if (dy < -MOVE) { t.top = false; return }
        if (dy < MOVE) return
        t.moved = true
        startRef.current()
      }
      e.preventDefault()
      t.last = y
      followRef.current(t.h - dy)
    }
    const end = () => {
      const d = t
      t = null
      settleRef.current(d)
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [snap])


  // 반쯤·내려 둔 상태에선 시트 어디를 끌어도 되고, 다 펼쳤을 땐 머리줄만 끈다(목록은 스크롤)
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (snap === 'full' && !(e.target as Element).closest('[data-grip]')) return
    drag.current = { y: e.clientY, h: visible(ref.current!), last: e.clientY, moved: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    d.last = e.clientY
    const dy = e.clientY - d.y
    if (!d.moved) {
      if (Math.abs(dy) < MOVE) return
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
      startDrag()
    }
    follow(d.h - dy)
  }

  return (
    <section
      ref={ref}
      data-testid={testId}
      data-snap={hidden ? 'hidden' : snap}
      aria-hidden={hidden || undefined}
      style={{
        height: restHeight(snap, fullTop),
        transform: hidden ? 'translateY(100%)' : undefined,
        transition: TRANSITION,
        willChange: 'transform',
      }}
      className={`fixed inset-x-0 bottom-0 flex flex-col bg-paper ${snap === 'full' && !dragging ? '' : 'rounded-t-sheet shadow-[0_-4px_20px_rgba(27,29,31,0.14)]'} ${snap !== 'full' ? 'touch-none' : ''} ${hidden ? 'pointer-events-none' : ''} ${className}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={finish}
      // iOS가 제스처를 가져가면 pointercancel만 온다. 마지막 위치로 붙인다
      onPointerCancel={finish}
      onClickCapture={(e) => {
        // 끌고 손을 뗀 건 누른 게 아니다
        if (swallowClick.current) { e.stopPropagation(); e.preventDefault() }
      }}
    >
      <div data-grip className="flex-shrink-0 touch-none select-none">
        {snap !== 'full' || dragging ? (
          <div className="flex justify-center pt-2"><span className="h-1 w-10 rounded-full bg-line" /></div>
        ) : null}
        {header}
      </div>
      {/* 반쯤일 땐 목록이 스크롤을 가져가지 않게 children 쪽에서 overflow를 막는다 */}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}
