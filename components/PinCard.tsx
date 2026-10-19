/* eslint-disable @next/next/no-img-element -- 토스 앱과 같이 쓰는 컴포넌트라 next/image를 쓰지 않는다 */
import React from 'react'
import type { Pin } from '@/lib/pins'
import { VisitorLine } from './ChannelFace'
import type { Face } from './NaverMap'

type Faces = Record<string, Face>

function facesOf(pin: Pin, faces: Faces) {
  return pin.ch.map((id) => ({ id, name: faces[id]?.name || '', thumbnail: faces[id]?.thumbnail || null }))
}

function thumb(vid: string | null) {
  return vid ? `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` : ''
}

function Line({ pin }: { pin: Pin }) {
  if (!pin.line) return null
  return pin.quote
    ? <span className="block truncate text-meta"><span className="caption-band rounded-[6px]">{pin.line}</span></span>
    : <span className="block truncate text-meta text-ink">{pin.line}</span>
}

function meta(pin: Pin) {
  return [pin.category, [pin.region, pin.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
}

/** 핀을 누르면 지도 아래에 뜨는 카드. 누르면 상세로 간다 */
export function PreviewCard({ pin, faces, onOpen, onClose, leaving, adSlot }: { pin: Pin; faces: Faces; onOpen: () => void; onClose: () => void; leaving?: boolean; adSlot?: React.ReactNode }) {
  return (
    <div
      data-testid="preview-card"
      className={`relative mx-auto w-full max-w-[440px] overflow-hidden rounded-sheet bg-paper shadow-[0_12px_36px_rgba(27,29,31,0.22)] ${
        leaving ? 'pointer-events-none animate-sheet-out' : 'animate-sheet-in'
      }`}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left active:opacity-90" aria-label={`${pin.name} 자세히 보기`}>
        <span className="relative block h-[168px] w-full overflow-hidden bg-well">
          {pin.vid && <img src={`https://i.ytimg.com/vi/${pin.vid}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />}
          {pin.quote && pin.line && (
            <span className="absolute inset-x-3 bottom-3 block">
              <span className="caption-band animate-caption-in rounded-[6px] text-lead">{pin.line}</span>
            </span>
          )}
        </span>
        <span className="block px-4 pb-4 pt-3">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-title font-bold text-ink">{pin.name}</span>
            {pin.category && <span className="flex-shrink-0 text-body text-sub">{pin.category}</span>}
          </span>
          <span className="mt-0.5 block truncate text-body text-sub">{[pin.region, pin.city].filter(Boolean).join(' ')}</span>
          {pin.menu && (
            <span className="mt-2 block truncate text-body text-ink">
              <span className="mr-1.5 text-sub">먹은 것</span>{pin.menu}
            </span>
          )}
          <span className="mt-3 flex items-center justify-between">
            <VisitorLine faces={facesOf(pin, faces)} size={26} />
            <span className="flex items-center gap-0.5 text-body font-bold text-ink">
              자세히
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </span>
        </span>
      </button>
      {adSlot}
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(27,29,31,0.55)] text-white">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </span>
      </button>
    </div>
  )
}

/** 목록 한 줄 */
export const PinRow = React.memo(function PinRow({ pin, faces, onOpen, selected }: { pin: Pin; faces: Faces; onOpen: (id: number) => void; selected?: boolean }) {
  return (
    <button
      type="button"
      data-testid="list-item"
      onClick={() => onOpen(pin.id)}
      className={`flex w-full gap-3 border-b border-line py-3.5 text-left ${selected ? 'bg-well' : 'active:bg-well'}`}
    >
      <span className="h-[72px] w-[96px] flex-shrink-0 overflow-hidden rounded-[10px] bg-well">
        {pin.vid && <img src={thumb(pin.vid)} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="truncate text-lead font-bold text-ink">{pin.name}</span>
        <span className="truncate text-meta text-sub">{meta(pin)}</span>
        <Line pin={pin} />
        <span className="mt-0.5"><VisitorLine faces={facesOf(pin, faces)} size={18} /></span>
      </span>
    </button>
  )
})
