'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { ChannelWithCount } from '@/lib/types'

interface ChannelFilterProps {
  selectedChannels: string[]
  onChannelToggle: (channelId: string) => void
  onMaxExceeded?: () => void
}

export default function ChannelFilter({
  selectedChannels,
  onChannelToggle,
  onMaxExceeded,
}: ChannelFilterProps) {
  const [channels, setChannels] = useState<ChannelWithCount[]>([])

  useEffect(() => {
    fetch('/api/channels')
      .then((r) => r.json())
      .then((data) => setChannels(data.channels || []))
      .catch(() => {})
  }, [])

  const handleToggle = (channelId: string) => {
    if (!selectedChannels.includes(channelId) && selectedChannels.length >= 5) {
      onMaxExceeded?.()
      return
    }
    onChannelToggle(channelId)
  }

  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">유튜버</h3>
      {channels.map((ch) => {
        const isSelected = selectedChannels.includes(ch.id)
        return (
          <button
            key={ch.id}
            onClick={() => handleToggle(ch.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
              isSelected
                ? 'border-l-[3px] border-primary bg-surface'
                : 'hover:bg-surface-low'
            }`}
          >
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-container">
              {ch.thumbnail_url ? (
                <Image src={ch.thumbnail_url} alt={ch.name} fill className="object-cover" sizes="40px" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-white font-semibold">
                  {ch.name[0]}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-on-surface">{ch.name}</p>
            </div>
            <span className="flex-shrink-0 rounded-full bg-primary-container px-2 py-0.5 text-xs text-white">
              {ch.restaurant_count}
            </span>
          </button>
        )
      })}
      {channels.length === 0 && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
              <div className="h-10 w-10 animate-pulse rounded-full bg-surface-high" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-20 animate-pulse rounded bg-surface-high" />
                <div className="h-2 w-12 animate-pulse rounded bg-surface-high" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
