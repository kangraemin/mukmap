/* eslint-disable @next/next/no-img-element -- 토스 앱과 같이 쓰는 컴포넌트라 next/image를 쓰지 않는다 */
import { ShareIcon } from './ShareIcon'
import { HeartIcon } from './HeartIcon'
import React from 'react'
import type { Pin } from '@/lib/pins'
import { VisitorLine } from './ChannelFace'
import { RecBadge } from './RecBadge'
import type { Face } from './NaverMap'
import { KO_UI, type UiText } from '@/lib/ui-text'

type Faces = Record<string, Face>

function facesOf(pin: Pin, faces: Faces) {
  return pin.ch.map((id) => ({ id, name: faces[id]?.name || '', thumbnail: faces[id]?.thumbnail || null }))
}

function thumb(vid: string | null) {
  return vid ? `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` : ''
}

function Line({ pin, className = '' }: { pin: Pin; className?: string }) {
  // 자막 인용은 보여주지 않는다. 메뉴·요약만
  const text = pin.quote ? pin.menu : pin.line
  if (!text) return null
  return <span className={`block truncate text-meta text-ink ${className}`}>{text}</span>
}

function meta(pin: Pin, t: UiText) {
  return [pin.category && t.category(pin.category), t.area(pin.region, pin.city)].filter(Boolean).join(' · ')
}

/** 최고 메뉴·가격·웨이팅 같은 짧은 정보. 넘치면 잘라 내지 않고 옆으로 밀어 본다(실기기에서 '웨이팅 한.'처럼 잘렸다) */
function Chips({ items, bleed = '' }: { items: [string, string | null | undefined][]; bleed?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  // 칩을 미는 손가락이 뒤의 지도로 새면 칩 대신 지도가 움직인다(토스 앱 실기기)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const stop = (e: Event) => e.stopPropagation()
    const types = ['touchstart', 'touchmove', 'pointerdown', 'pointermove'] as const
    for (const t of types) el.addEventListener(t, stop, { passive: true })
    return () => { for (const t of types) el.removeEventListener(t, stop) }
  }, [])
  const shown = items.filter((x): x is [string, string] => Boolean(x[1]))
  if (!shown.length) return null
  return (
    <span ref={ref} data-testid="pin-chips" className={`no-scrollbar mt-2.5 flex touch-pan-x gap-1.5 overflow-x-auto overscroll-x-contain ${bleed}`}>
      {shown.map(([k, v]) => (
        <span key={k} className="flex h-7 flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-well px-2.5 text-meta">
          <span className="text-sub">{k}</span>
          <span className="font-semibold text-ink">{v}</span>
        </span>
      ))}
    </span>
  )
}

/** 누르면 여는 카드 바탕. 아이폰 WebKit은 <button> 안의 가로 스크롤(칩 줄)을 밀어 주지 않아 div로 만든다 */
function Pressable({ onPress, label, className, testId, children }: { onPress: () => void; label?: string; className: string; testId?: string; children: React.ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid={testId}
      onClick={onPress}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress() }
      }}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </div>
  )
}

function chipsOf(pin: Pin, t: UiText): [string, string | null | undefined][] {
  return [[t.best, pin.best], [t.price, pin.price], [t.wait, pin.wait]]
}

function PlayBadge() {
  return (
    <span className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(27,29,31,0.6)] text-white">
      <svg viewBox="0 0 16 16" width="9" height="9" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor" /></svg>
    </span>
  )
}

/** 핀을 누르면 지도 아래에 뜨는 카드. 누르면 상세로 간다 */
export function PreviewCard({ pin, faces, onOpen, onClose, onShare, liked = false, onLike, leaving, adSlot, t = KO_UI }: { pin: Pin; faces: Faces; onOpen: () => void; onClose: () => void; onShare?: () => void; liked?: boolean; onLike?: () => void; leaving?: boolean; adSlot?: React.ReactNode; t?: UiText }) {
  // 오른쪽 위엔 닫기만 둔다. 찜·공유까지 위에 두면 글 칸이 60px 남짓만 남아 이름이 잘렸다
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }
  return (
    <div
      data-testid="preview-card"
      className={`relative mx-auto w-full max-w-[440px] overflow-hidden rounded-sheet bg-paper shadow-[0_12px_36px_rgba(27,29,31,0.22)] ${
        leaving ? 'pointer-events-none animate-sheet-out' : 'animate-sheet-in'
      }`}
    >
      <Pressable onPress={onOpen} className="block w-full px-4 pb-3.5 pt-4 text-left active:opacity-90" label={t.openDetail(pin.name)}>
        <span className="flex items-center gap-3 pr-8">
          <span className="relative h-[72px] w-[128px] flex-shrink-0 overflow-hidden rounded-[10px] bg-well">
            {pin.vid && <img src={thumb(pin.vid)} alt="" draggable={false} className="h-full w-full object-cover" />}
            {pin.vid && <PlayBadge />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-lead font-bold text-ink">{pin.name}</span>
            <span className="truncate text-meta text-sub">{meta(pin, t)}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <VisitorLine faces={facesOf(pin, faces)} size={18} others={t.others} />
              <RecBadge rec={pin.rec} label={pin.rec ? t.rec[pin.rec] : undefined} />
            </span>
          </span>
        </span>
        {pin.verdict ? (
          <span data-testid="card-verdict" className="mt-3 line-clamp-2 block text-body font-semibold leading-[1.45] text-ink">
            “{pin.verdict}”
          </span>
        ) : (
          pin.menu && (
            <span className="mt-3 block truncate text-body text-ink">
              <span className="mr-1.5 text-sub">{t.ate}</span>{pin.menu}
            </span>
          )
        )}
        {pin.verdict && <Chips items={chipsOf(pin, t)} bleed="-mx-4 px-4" />}
        <span className="mt-3 flex items-center justify-between text-meta">
          <span className="text-sub">{pin.nv ? t.videos(pin.nv) : ''}</span>
          <span className="flex items-center">
            {onLike && (
              <button
                type="button"
                onClick={stop(onLike)}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={t.like}
                aria-pressed={liked}
                data-testid="like"
                className="-my-2 flex h-11 w-11 items-center justify-center text-ink"
              >
                <HeartIcon on={liked} />
              </button>
            )}
            {onShare && (
              <button
                type="button"
                onClick={stop(onShare)}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={t.share}
                data-testid="share-place"
                className="-my-2 mr-1 flex h-11 w-11 items-center justify-center text-ink"
              >
                <ShareIcon />
              </button>
            )}
            <span className="flex items-center gap-0.5 text-body font-bold text-ink">
              {t.more}
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </span>
        </span>
      </Pressable>
      {adSlot}
      <button
        type="button"
        onClick={onClose}
        aria-label={t.close}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center text-sub"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
    </div>
  )
}

/** 목록 한 줄. 사진을 줄여 글 칸을 넓히고 이름은 두 줄까지 다 보인다. 최고 메뉴·가격 칩 줄은 목록에선 뺀다(상세·미리보기 카드에 있다).
 * 전에는 영어 이름이 'Gayang Kal...'로 잘리고 칩 하나가 사진 밑에 따로 떠서, 한국어도 빽빽하고 읽기 힘들었다(10/25) */
export const PinRow = React.memo(function PinRow({ pin, faces, onOpen, selected, t = KO_UI }: { pin: Pin; faces: Faces; onOpen: (id: number) => void; selected?: boolean; t?: UiText }) {
  return (
    <Pressable
      testId="list-item"
      onPress={() => onOpen(pin.id)}
      className={`flex w-full items-start gap-3 border-b border-line py-4 text-left ${selected ? 'bg-well' : 'active:bg-well'}`}
    >
      <span className="relative h-[80px] w-[106px] flex-shrink-0 overflow-hidden rounded-[10px] bg-well">
        {pin.vid && <img src={thumb(pin.vid)} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span data-testid="row-name" className="line-clamp-2 text-lead font-bold leading-[1.3] text-ink">{pin.name}</span>
        <span className="mt-1 flex min-w-0 items-center gap-1.5">
          <RecBadge rec={pin.rec} label={pin.rec ? t.rec[pin.rec] : undefined} />
          <span className="truncate text-meta text-sub">{meta(pin, t)}</span>
        </span>
        {pin.verdict ? (
          <span data-testid="row-verdict" className="mt-2 line-clamp-2 text-[14px] leading-[1.45] text-ink">{pin.verdict}</span>
        ) : (
          <Line pin={pin} className="mt-2" />
        )}
        <span className="mt-2 flex min-w-0 items-center gap-1">
          <VisitorLine faces={facesOf(pin, faces)} size={16} others={t.others} />
          {pin.nv ? <span className="flex-shrink-0 text-meta text-sub">· {t.videos(pin.nv)}</span> : null}
        </span>
      </span>
    </Pressable>
  )
})
