'use client'
// 지도 위에 반쯤 올라오는 목록. 머리줄을 위로 끌면 화면을 다 채우고, 아래로 끌면 반쯤 → 머리줄만 남게 내려간다. 다 펼쳤을 땐 목록 맨 위에서 끌어내려도 내려간다
// 높이는 늘 화면 높이로 두고, 단계는 transform으로만 나타낸다. 높이를 바꾸면 목록 전체(약 2,400개)를 다시 배치하고 다시 그려
// 끌기 시작·손 뗄 때마다 폰에서 툭 끊겼다(2026-10-24). 움직임은 React 상태 없이 style을 직접 바꾼다.
// iOS는 화면 아래 끝에서 끌면 pointercancel이 오니 그때도 가까운 단계로 붙인다
import { useEffect, useRef, useState, type ReactNode } from 'react'

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

/** v: 손가락 속도(px/ms, 아래가 +), t: 마지막 움직임 시각 */
type Drag = { y: number; h: number; last: number; moved: boolean; v: number; t: number }

const MOVE = 6
const SNAP_PX = 48
/** 이보다 빠르게 튕기면 짧게 끌어도 그 방향 다음 단계로 넘어간다 */
const FLICK = 0.5

/** 손가락 위치를 받아 속도를 부드럽게 갱신한다. 멈췄다 떼면 속도는 0이 된다 */
function track(d: Drag, y: number) {
  const now = performance.now()
  const dt = now - d.t
  if (dt > 0) d.v = 0.7 * ((y - d.last) / dt) + 0.3 * d.v
  d.last = y
  d.t = now
}
const EASE = 'cubic-bezier(0.2, 0.9, 0.25, 1)'
const TRANSITION = `transform 0.28s ${EASE}`

/** 단계별로 보이는 높이(CSS) */
const restVisible = (snap: SheetSnap, fullTop: number) => snap === 'full' ? `calc(100dvh - ${fullTop}px)`
  : snap === 'peek' ? `calc(${PEEK_PX}px + env(safe-area-inset-bottom))`
  : `${HALF_RATIO * 100}dvh`

/** 화면 높이로 편 시트를 그 단계만큼만 보이게 내린다 */
const restTransform = (snap: SheetSnap, fullTop: number) => snap === 'full' ? 'translateY(0px)'
  : `translateY(calc(100% - ${restVisible(snap, fullTop)}))`

export default function ListSheet({ snap, onSnap, hidden, fullTop = 0, header, children, testId, className = '' }: ListSheetProps) {
  const ref = useRef<HTMLElement>(null)
  const drag = useRef<Drag | null>(null)
  const swallowClick = useRef(false)
  const [dragging, setDragging] = useState(false)
  // 머리줄 높이가 늦게 재져 fullTop이 바뀌어도 끌던 손을 놓치지 않게 ref로 읽는다
  const fullTopRef = useRef(fullTop)
  fullTopRef.current = fullTop
  const hiddenRef = useRef(hidden)
  hiddenRef.current = hidden
  const snapRef = useRef(snap)
  snapRef.current = snap

  const visible = (el: HTMLElement) => window.innerHeight - el.getBoundingClientRect().top
  /** 끄는 동안: 보이는 높이 h만큼만 올라오게 옮긴다. 한 프레임에 한 번만 쓴다 */
  const frame = useRef(0)
  const want = useRef(0)
  const follow = (h: number) => {
    want.current = h
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const el = ref.current
      if (!el) return
      const full = el.offsetHeight
      el.style.transition = 'none'
      el.style.transform = `translateY(${full - Math.min(full, Math.max(PEEK_PX, want.current))}px)`
    })
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  /** 손을 뗀 자리에서 to 단계로 미끄러진다. 단계가 바뀌면 React가 같은 transform을 다시 써도 그대로다 */
  const glide = (to: SheetSnap) => {
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(frame.current)
    frame.current = 0
    el.style.transition = TRANSITION
    el.style.transform = hiddenRef.current ? 'translateY(100%)' : restTransform(to, fullTopRef.current)
  }

  const settle = (d: Drag | null) => {
    if (!d?.moved) return
    swallowClick.current = true
    setTimeout(() => { swallowClick.current = false }, 0)
    const dy = d.last - d.y
    setDragging(false)
    const order: SheetSnap[] = ['peek', 'half', 'full']
    const step = (dir: number) => order[Math.max(0, Math.min(2, order.indexOf(snap) + dir))]
    const v = performance.now() - d.t > 100 ? 0 : d.v
    let next: SheetSnap
    // 튕기면 그 방향으로 한 칸
    if (Math.abs(v) > FLICK && Math.sign(v) === Math.sign(dy)) next = step(v < 0 ? 1 : -1)
    else if (Math.abs(dy) < SNAP_PX) next = snap
    else {
      // 손을 뗀 높이에 가장 가까운 단계로 붙인다. 같은 단계면 끈 쪽으로 한 칸 옮긴다
      const vh = window.innerHeight
      const heights: Record<SheetSnap, number> = { peek: PEEK_PX, half: vh * HALF_RATIO, full: vh - fullTop }
      const h = d.h - dy
      next = order.reduce((a, b) => (Math.abs(heights[b] - h) < Math.abs(heights[a] - h) ? b : a))
      if (next === snap) next = step(dy < 0 ? 1 : -1)
    }
    glide(next)
    if (next === snap) return
    onSnap(next)
    // 부모가 그 단계를 받지 않으면(다른 화면으로 넘어가는 중 등) 실제 단계 자리로 되돌린다
    requestAnimationFrame(() => { if (snapRef.current !== next) glide(snapRef.current) })
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
  const startDrag = () => setDragging(true)
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
      t = { y, last: y, h: visible(el), moved: false, v: 0, t: performance.now(), top: !sc || sc.scrollTop <= 0 }
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
      track(t, y)
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
    drag.current = { y: e.clientY, h: visible(ref.current!), last: e.clientY, moved: false, v: 0, t: performance.now() }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    track(d, e.clientY)
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
        height: `calc(100dvh - ${fullTop}px)`,
        transform: hidden ? 'translateY(100%)' : restTransform(snap, fullTop),
        transition: TRANSITION,
        willChange: 'transform',
        // 카드를 꾹 누른 채 끌면 iOS가 사진 메뉴·글자 선택을 띄워 끌기를 가져간다(2026-10-24 녹화).
        // Tailwind select-none은 접두어 없는 user-select만 써서 Safari엔 안 먹는다
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
      }}
      className={`fixed inset-x-0 bottom-0 flex select-none flex-col bg-paper ${snap === 'full' && !dragging ? '' : 'rounded-t-sheet shadow-[0_-4px_20px_rgba(27,29,31,0.14)]'} ${snap !== 'full' ? 'touch-none' : ''} ${hidden ? 'pointer-events-none' : ''} ${className}`}
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
