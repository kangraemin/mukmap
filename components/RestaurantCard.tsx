'use client'

import Image from 'next/image'
import { getChannelHue, channelColor, channelTint } from '@/lib/constants'

interface RestaurantCardProps {
  name: string
  category: string
  region: string | null
  thumbnailUrl?: string | null
  rating?: string | null
  channelName?: string
  channelThumbnail?: string | null
  channelId?: string
  channelIndex?: number
  summary?: string | null
  isSelected?: boolean
  onClick?: () => void
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
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z" />
        </svg>
      )}
      {c.label}
    </span>
  )
}

interface ChannelAvatarProps {
  channelId?: string
  channelIndex?: number
  thumbnail?: string | null
  size?: number
}

function ChannelAvatar({ channelId, channelIndex = 0, thumbnail, size = 18 }: ChannelAvatarProps) {
  const hue = getChannelHue(channelId ?? '', channelIndex)
  const bg = channelColor(hue)
  const tint = channelTint(hue)

  if (thumbnail) {
    return (
      <div
        className="flex-shrink-0 overflow-hidden rounded-full"
        style={{ width: size, height: size }}
      >
        <Image src={thumbnail} alt="" width={size} height={size} className="object-cover" />
      </div>
    )
  }

  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
      style={{ width: size, height: size, background: tint, color: bg }}
    >
      CH
    </div>
  )
}

function PlaceholderThumb({ category }: { category: string }) {
  const emoji: Record<string, string> = {
    '한식': '🍚', '일식': '🍣', '중식': '🥢', '양식': '🍝',
    '카페/디저트': '☕', '분식': '🍜', '고기/구이': '🥩',
    '해산물': '🦞', '기타': '🍽️',
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-low text-2xl">
      {emoji[category] ?? '🍽️'}
    </div>
  )
}

export default function RestaurantCard({
  name,
  category,
  region,
  thumbnailUrl,
  rating,
  channelName,
  channelThumbnail,
  channelId,
  channelIndex = 0,
  summary,
  isSelected,
  onClick,
}: RestaurantCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: isSelected ? '#FFFAF1' : '#fff',
        borderColor: isSelected ? 'oklch(0.68 0.18 28)' : '#EDE8DC',
        boxShadow: isSelected ? '0 4px 12px rgba(217,119,87,0.15)' : 'none',
      }}
      className="flex w-full gap-3 rounded-xl border p-3 text-left transition-all duration-100"
    >
      {/* 76×76 square thumbnail */}
      <div className="relative h-[76px] w-[76px] flex-shrink-0 overflow-hidden rounded-lg bg-surface-low">
        {thumbnailUrl
          ? <Image src={thumbnailUrl} alt={name} fill className="object-cover" sizes="76px" />
          : <PlaceholderThumb category={category} />}
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        {/* top: rating chip + category·region */}
        <div className="flex flex-wrap items-center gap-1.5">
          {rating && <RatingChip rating={rating} />}
          <span className="text-[11px] text-ink-muted">
            {category}{region ? ` · ${region}` : ''}
          </span>
        </div>

        {/* name */}
        <p className="truncate text-[14.5px] font-bold leading-snug text-ink-body">{name}</p>

        {/* quoted summary */}
        {summary && (
          <p className="truncate text-xs text-ink-secondary">&ldquo;{summary}&rdquo;</p>
        )}

        {/* channel avatar + name */}
        <div className="mt-auto flex items-center gap-1.5">
          <ChannelAvatar
            channelId={channelId}
            channelIndex={channelIndex}
            thumbnail={channelThumbnail}
            size={18}
          />
          {channelName && (
            <span className="text-[11px] text-ink-muted">{channelName}</span>
          )}
        </div>
      </div>
    </button>
  )
}
