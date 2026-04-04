'use client'

import Image from 'next/image'

interface RestaurantCardProps {
  name: string
  category: string
  region: string | null
  thumbnailUrl?: string | null
  rating?: string | null
  channelName?: string
  onClick?: () => void
}

const ratingColor: Record<string, string> = {
  '강력추천': 'bg-primary text-white',
  '추천': 'bg-success text-white',
  '보통': 'bg-gray-200 text-gray-600',
  '비추': 'bg-error text-white',
  '언급없음': 'bg-gray-100 text-gray-400',
}

export default function RestaurantCard({
  name,
  category,
  region,
  thumbnailUrl,
  rating,
  channelName,
  onClick,
}: RestaurantCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full gap-3 rounded-xl bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      {thumbnailUrl && (
        <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg">
          <Image src={thumbnailUrl} alt={name} fill className="object-cover" sizes="96px" />
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <h3 className="truncate text-sm font-semibold text-secondary">{name}</h3>
        <p className="text-xs text-gray-400">
          {category} · {region || ''}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          {rating && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ratingColor[rating] || 'bg-gray-100 text-gray-400'}`}>
              {rating}
            </span>
          )}
          {channelName && (
            <span className="text-[10px] text-gray-400">{channelName}</span>
          )}
        </div>
      </div>
    </button>
  )
}
