'use client'

import Image from 'next/image'

interface RestaurantCardProps {
  name: string
  category: string
  region: string | null
  thumbnailUrl?: string | null
  rating?: string | null
  channelName?: string
  isSelected?: boolean
  onClick?: () => void
}

const ratingColor: Record<string, string> = {
  '강력추천': 'bg-primary text-on-primary',
  '추천': 'bg-primary-container text-white',
  '보통': 'bg-surface-high text-on-surface',
  '비추': 'bg-error text-white',
  '언급없음': 'bg-surface-low text-on-surface-variant',
}

export default function RestaurantCard({
  name,
  category,
  region,
  thumbnailUrl,
  rating,
  channelName,
  isSelected,
  onClick,
}: RestaurantCardProps) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full gap-3 rounded-lg bg-surface-lowest p-3 text-left shadow-[0_2px_24px_rgba(78,33,30,0.06)] transition-all hover:shadow-[0_4px_24px_rgba(78,33,30,0.12)] hover:scale-[1.01] ${
        isSelected ? 'ring-2 ring-primary bg-surface' : ''
      }`}
    >
      {thumbnailUrl && (
        <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg">
          <Image src={thumbnailUrl} alt={name} fill className="object-cover" sizes="96px" />
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <h3 className="truncate text-sm font-semibold text-on-surface">{name}</h3>
        <p className="text-xs text-on-surface-variant">
          {category} · {region || ''}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          {rating && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ratingColor[rating] || 'bg-surface-low text-on-surface-variant'}`}>
              {rating}
            </span>
          )}
          {channelName && (
            <span className="text-[10px] text-on-surface-variant">{channelName}</span>
          )}
        </div>
      </div>
    </button>
  )
}
