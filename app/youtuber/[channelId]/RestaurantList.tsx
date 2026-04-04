'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface RestaurantItem {
  id: number
  name: string
  address: string | null
  category: string
  region: string | null
  video: {
    video_id: string
    title: string | null
    thumbnail_url: string | null
    rating: string | null
    summary: string | null
    timestamp_seconds: number | null
  }
}

const ratingStyle: Record<string, string> = {
  '강력추천': 'bg-success text-white',
  '추천': 'bg-warning text-secondary',
  '보통': 'bg-gray-200 text-gray-600',
  '비추': 'bg-error text-white',
  '언급없음': 'bg-gray-100 text-gray-400',
}

const PAGE_SIZE = 20

export default function YoutuberRestaurantList({
  restaurants,
}: {
  restaurants: RestaurantItem[]
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, restaurants.length))
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [restaurants.length])

  const visible = restaurants.slice(0, visibleCount)

  return (
    <div className="space-y-3">
      {visible.map((r) => (
        <Link
          key={r.id}
          href={`/restaurant/${r.id}`}
          className="flex gap-3 rounded-xl bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
        >
          {r.video.thumbnail_url && (
            <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg">
              <Image
                src={r.video.thumbnail_url}
                alt={r.name}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <h3 className="truncate text-sm font-semibold text-secondary">{r.name}</h3>
            <p className="text-xs text-gray-400">
              {r.category} · {r.region || ''} · {r.address || ''}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              {r.video.rating && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ratingStyle[r.video.rating] || ''}`}>
                  {r.video.rating}
                </span>
              )}
              {r.video.summary && (
                <span className="truncate text-[10px] text-gray-400">{r.video.summary}</span>
              )}
            </div>
          </div>
        </Link>
      ))}

      {restaurants.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">등록된 맛집이 없습니다</p>
      )}

      {visibleCount < restaurants.length && (
        <div ref={sentinelRef} className="py-4 text-center text-xs text-gray-400">
          더 불러오는 중...
        </div>
      )}
    </div>
  )
}
