'use client'
// 지도 위에 반쯤 올라오는 목록. 머리줄을 위로 끌면 화면을 다 채우고, 아래로 끌면 반쯤 → 머리줄만 남게 내려간다. 다 펼쳤을 땐 목록 맨 위에서 끌어내려도 내려간다
// 단계 높이는 inline으로 두고 끄는 동안만 px로 덮는다. iOS는 화면 아래 끝에서 끌면 pointercancel이 오니 그때도 가까운 단계로 붙인다
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

type Drag = { y: number; h: number; last: number; moved: boolean }

const MOVE = 6
const SNAP_PX = 48

export default function ListSheet({ snap, onSnap, hidden, fullTop = 0, header, children, testId, className = '' }: ListSheetProps) {
  const ref = useRef<HTMLElement>(null)
  const drag = useRef<Drag | null>(null)
  const swallowClick = useRef(false)
  const [dragH, setDragH] = useState<number | null>(null)

  const settle = (d: Drag | null) => {
    if (!d?.moved) return
    swallowClick.current = true
    setTimeout(() => { swallowClick.current = false }, 0)
    const dy = d.last - d.y
    setDragH(null)
    if (Math.abs(dy) < SNAP_PX) return
    // 손을 뗀 높이에 가장 가까운 단계로 붙인다. 같은 단계면 끈 쪽으로 한 칸 옮긴다
    const vh = window.innerHeight
    const heights: Record<SheetSnap, number> = { peek: PEEK_PX, half: vh * HALF_RATIO, full: vh - fullTop }
    const order: SheetSnap[] = ['peek', 'half', 'full']
    const h = d.h - dy
    let next = order.reduce((a, b) => (Math.abs(heights[b] - h) < Math.abs(heights[a] - h) ? b : a))
    if (next === snap) next = order[Math.max(0, Math.min(2, order.indexOf(snap) + (dy < 0 ? 1 : -1)))]
    if (next !== snap) onSnap(next)
  }
  const finish = () => {
    const d = drag.current
    drag.current = null
    settle(d)
  }
  const settleRef = useRef(settle)
  settleRef.current = settle
  // 머리줄 높이가 늦게 재져 fullTop이 바뀌어도 끌던 손을 놓치지 않게 ref로 읽는다
  const fullTopRef = useRef(fullTop)
  fullTopRef.current = fullTop

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
      t = { y, last: y, h: el.getBoundingClientRect().height, moved: false, top: !sc || sc.scrollTop <= 0 }
    }
    const move = (e: TouchEvent) => {
      if (!t?.top) return
      const y = e.touches[0].clientY
      const dy = y - t.y
      if (!t.moved) {
        if (dy < -MOVE) { t.top = false; return }
        if (dy < MOVE) return
        t.moved = true
      }
      e.preventDefault()
      t.last = y
      setDragH(Math.min(window.innerHeight - fullTopRef.current, Math.max(PEEK_PX, t.h - dy)))
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

  const height = dragH != null ? `${dragH}px`
    : snap === 'full' ? `calc(100dvh - ${fullTop}px)`
    : snap === 'peek' ? `calc(${PEEK_PX}px + env(safe-area-inset-bottom))`
    : `${HALF_RATIO * 100}dvh`

  // 반쯤·내려 둔 상태에선 시트 어디를 끌어도 되고, 다 펼쳤을 땐 머리줄만 끈다(목록은 스크롤)
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (snap === 'full' && !(e.target as Element).closest('[data-grip]')) return
    drag.current = { y: e.clientY, h: ref.current!.getBoundingClientRect().height, last: e.clientY, moved: false }
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
    }
    setDragH(Math.min(window.innerHeight - fullTop, Math.max(PEEK_PX, d.h - dy)))
  }

  return (
    <section
      ref={ref}
      data-testid={testId}
      data-snap={hidden ? 'hidden' : snap}
      aria-hidden={hidden || undefined}
      style={{
        height,
        transform: hidden ? 'translateY(100%)' : undefined,
        transition: dragH != null ? 'none' : 'height 0.28s cubic-bezier(0.2, 0.9, 0.25, 1), transform 0.22s cubic-bezier(0.2, 0.9, 0.25, 1)',
      }}
      className={`fixed inset-x-0 bottom-0 flex flex-col bg-paper ${snap === 'full' && dragH == null ? '' : 'rounded-t-sheet shadow-[0_-4px_20px_rgba(27,29,31,0.14)]'} ${snap !== 'full' ? 'touch-none' : ''} ${hidden ? 'pointer-events-none' : ''} ${className}`}
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
        {snap !== 'full' || dragH != null ? (
          <div className="flex justify-center pt-2"><span className="h-1 w-10 rounded-full bg-line" /></div>
        ) : null}
        {header}
      </div>
      {/* 반쯤일 땐 목록이 스크롤을 가져가지 않게 children 쪽에서 overflow를 막는다 */}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}
