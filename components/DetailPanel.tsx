'use client'

import Image from 'next/image'
import type { RestaurantWithVideos } from '@/lib/types'

interface DetailPanelProps {
  restaurant: RestaurantWithVideos
  onClose: () => void
  mobile?: boolean
}

const RATING_WEIGHT: Record<string, number> = {
  '강력추천': 5, '추천': 4, '보통': 3, '비추': 2, '언급없음': 1,
}

function RatingChip({ rating }: { rating: string }) {
  const config: Record<string, { bg: string; fg: string; flame: boolean; label: string }> = {
    '강력추천': { bg: 'oklch(0.68 0.18 28)', fg: '#fff', flame: true, label: '강추' },
    '추천':    { bg: 'oklch(0.94 0.04 60)',  fg: 'oklch(0.42 0.12 35)', flame: false, label: '추천' },
    '보통':    { bg: '#F1EDE3', fg: '#6B5F4A', flame: false, label: '보통' },
    '비추':    { bg: '#EDE8DC', fg: '#9A8E78', flame: false, label: '비추' },
    '언급없음': { bg: '#EDE8DC', fg: '#9A8E78', flame: false, label: '언급없음' },
  }
  const c = config[rating] ?? { bg: '#EDE8DC', fg: '#9A8E78', flame: false, label: rating }
  return (
    <span
      style={{ background: c.bg, color: c.fg }}
      className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold"
    >
      {c.flame && (
        <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
          <path d="M8 1c1 2 3 3 3 6a3 3 0 11-6 0c0-1 .5-1.5 1-2 0 1.5.5 2 1.5 2 0-2-1-3 .5-6z"/>
        </svg>
      )}
      {c.label}
    </span>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
      <path d="M8 14s5-4.6 5-8.4A5 5 0 0 0 3 5.6C3 9.4 8 14 8 14z" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="6" r="1.6" fill="currentColor"/>
    </svg>
  )
}

function NavigateIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
      <path d="M2 8l12-5-5 12-2-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="white">
      <path d="M4 3l9 5-9 5z"/>
    </svg>
  )
}

export default function DetailPanel({ restaurant, onClose, mobile }: DetailPanelProps) {
  const visits = [...restaurant.videos].sort(
    (a, b) => (RATING_WEIGHT[b.rating ?? ''] ?? 0) - (RATING_WEIGHT[a.rating ?? ''] ?? 0)
  )
  const top = visits[0]

  const totalViews = visits.reduce((s, v) => s + (v.view_count ?? 0), 0)
  const viewsLabel = totalViews >= 10000
    ? `${Math.round(totalViews / 10000)}만+`
    : totalViews > 0 ? totalViews.toLocaleString() : '-'

  const naverUrl = restaurant.naver_place_id
    ? `https://map.naver.com/v5/entry/place/${restaurant.naver_place_id}`
    : `https://map.naver.com/v5/search/${encodeURIComponent(restaurant.name)}`

  return (
    <div className="flex h-full flex-col overflow-hidden bg-cream-warm">
      {/* Hero */}
      <div className="relative h-[240px] flex-shrink-0 bg-surface-low">
        {top?.thumbnail_url ? (
          <Image
            src={top.thumbnail_url}
            alt={restaurant.name}
            fill
            className="object-cover"
            sizes="380px"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'oklch(0.88 0.04 28)' }}
          >
            <span className="text-5xl">🍽️</span>
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute left-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-body shadow-md transition-opacity hover:opacity-80"
        >
          {mobile ? <BackArrowIcon /> : <CloseIcon />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 pb-10">
        {/* Title */}
        <p className="mb-1 text-xs text-ink-muted">
          {restaurant.category}{restaurant.region ? ` · ${restaurant.region}` : ''}
        </p>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink">
          {restaurant.name}
        </h1>
        {restaurant.address && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink-secondary">
            <PinIcon /> {restaurant.address}
          </p>
        )}

        {/* Rating summary */}
        <div className="mt-4 flex gap-3 rounded-xl border border-border bg-white p-3.5">
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">유튜버 종합</p>
            <div className="mt-1.5 flex items-center gap-2">
              {top?.rating && <RatingChip rating={top.rating} />}
              <span className="text-[13px] font-semibold text-ink-section">{visits.length}명 방문</span>
            </div>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">총 조회수</p>
            <p className="mt-1.5 text-lg font-extrabold text-ink-body">{viewsLabel}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-3.5">
          <a
            href={naverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] py-[11px] text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: 'oklch(0.68 0.18 28)' }}
          >
            <NavigateIcon /> 길찾기
          </a>
        </div>

        {/* Visits list */}
        <div className="mt-6">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold text-ink-body">유튜버 방문 기록</h2>
            <span className="text-xs text-ink-muted">{visits.length}건</span>
          </div>
          <div className="flex flex-col gap-2">
            {visits.map((v, i) => (
              <a
                key={i}
                href={`https://www.youtube.com/watch?v=${v.video_id}${v.timestamp_seconds ? `&t=${v.timestamp_seconds}s` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-2.5 rounded-[10px] border border-border bg-white p-3 transition-colors hover:bg-surface-low"
              >
                {/* Video thumb */}
                <div className="relative h-14 w-[76px] flex-shrink-0 overflow-hidden rounded-md bg-surface-low">
                  {v.thumbnail_url ? (
                    <Image src={v.thumbnail_url} alt={v.channel_name} fill className="object-cover" sizes="76px" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface-high">
                      <PlayIcon />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center gap-1.5">
                    {/* Channel avatar */}
                    {v.channel_thumbnail ? (
                      <div className="relative h-5 w-5 flex-shrink-0 overflow-hidden rounded-full">
                        <Image src={v.channel_thumbnail} alt={v.channel_name} fill className="object-cover" sizes="20px" />
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-surface-high text-[9px] font-bold text-ink-tertiary">
                        {v.channel_name[0]}
                      </div>
                    )}
                    <span className="text-[12.5px] font-semibold text-ink-body">{v.channel_name}</span>
                    {v.rating && <RatingChip rating={v.rating} />}
                  </div>
                  {v.summary && (
                    <p className="truncate text-[13px] text-ink-section">&ldquo;{v.summary}&rdquo;</p>
                  )}
                  {v.published_at && (
                    <p className="mt-1 text-[11px] text-ink-muted">
                      {new Date(v.published_at).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
