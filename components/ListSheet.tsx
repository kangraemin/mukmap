'use client'
// 지도 위에 반쯤 올라오는 목록. 머리줄을 위로 끌면 화면을 다 채우고, 아래로 끌면 다시 반쯤 내려온다
// 단계 높이는 inline으로 두고 끄는 동안만 px로 덮는다. iOS는 화면 아래 끝에서 끌면 pointercancel이 오니 그때도 가까운 단계로 붙인다
import { useRef, useState, type ReactNode } from 'react'

export type SheetSnap = 'half' | 'full'

/** 반쯤 올라왔을 때 시트 높이. 지도는 그 위 칸에 핀을 맞춘다 */
export const HALF_RATIO = 0.46

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

const MOVE = 6
const SNAP_PX = 48

export default function ListSheet({ snap, onSnap, hidden, fullTop = 0, header, children, testId, className = '' }: ListSheetProps) {
  const ref = useRef<HTMLElement>(null)
  const drag = useRef<{ y: number; h: number; last: number; moved: boolean } | null>(null)
  const swallowClick = useRef(false)
  const [dragH, setDragH] = useState<number | null>(null)

  const finish = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    swallowClick.current = true
    setTimeout(() => { swallowClick.current = false }, 0)
    const dy = d.last - d.y
    setDragH(null)
    if (dy < -SNAP_PX) onSnap('full')
    else if (dy > SNAP_PX) onSnap('half')
  }

  const height = dragH != null ? `${dragH}px` : snap === 'full' ? `calc(100dvh - ${fullTop}px)` : `${HALF_RATIO * 100}dvh`

  // 반쯤일 땐 시트 어디를 끌어도 올라오고, 다 펼쳤을 땐 머리줄만 끈다(목록은 스크롤)
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
    setDragH(Math.min(window.innerHeight - fullTop, Math.max(120, d.h - dy)))
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
      className={`fixed inset-x-0 bottom-0 flex flex-col bg-paper ${snap === 'full' && dragH == null ? '' : 'rounded-t-sheet shadow-[0_-4px_20px_rgba(27,29,31,0.14)]'} ${snap === 'half' ? 'touch-none' : ''} ${hidden ? 'pointer-events-none' : ''} ${className}`}
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
        {snap === 'half' || dragH != null ? (
          <div className="flex justify-center pt-2"><span className="h-1 w-10 rounded-full bg-line" /></div>
        ) : null}
        {header}
      </div>
      {/* 반쯤일 땐 목록이 스크롤을 가져가지 않게 children 쪽에서 overflow를 막는다 */}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}
