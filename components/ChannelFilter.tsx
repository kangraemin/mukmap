'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { ChannelWithCount } from '@/lib/types'
import { getChannelHue, channelColor, channelTint, channelDeep } from '@/lib/constants'

interface ChannelFilterProps {
  selectedChannels: string[]
  onChannelToggle: (channelId: string) => void
  onMaxExceeded?: () => void
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none">
      <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
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
    <div className="space-y-1">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-section">유튜버</span>
        <span className="text-[10.5px] text-ink-muted">최대 5명</span>
      </div>

      {channels.length === 0 ? (
        <div className="space-y-1.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5">
              <div className="h-6 w-6 animate-pulse rounded-full bg-surface-high" />
              <div className="flex-1 space-y-1">
                <div className="h-2.5 w-20 animate-pulse rounded bg-surface-high" />
                <div className="h-2 w-12 animate-pulse rounded bg-surface-high" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {channels.map((ch, idx) => {
            const hue = getChannelHue(ch.id, idx)
            const isSelected = selectedChannels.includes(ch.id)
            return (
              <button
                key={ch.id}
                onClick={() => handleToggle(ch.id)}
                style={{
                  background: isSelected ? channelTint(hue) : 'transparent',
                  borderColor: isSelected ? channelColor(hue) : 'transparent',
                }}
                className="flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors duration-100 hover:bg-surface-low"
              >
                {/* Avatar: 실제 썸네일 or 이니셜 */}
                <div
                  style={{ background: channelColor(hue) }}
                  className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-white"
                >
                  {ch.thumbnail_url ? (
                    <Image src={ch.thumbnail_url} alt={ch.name} fill className="object-cover" sizes="24px" />
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700 }}>{ch.name[0]}</span>
                  )}
                </div>

                {/* 이름 + 맛집 수 */}
                <div className="flex-1 overflow-hidden">
                  <p
                    style={{ color: isSelected ? channelDeep(hue) : '#221E15' }}
                    className="truncate text-[13px] font-semibold leading-tight"
                  >
                    {ch.name}
                  </p>
                  <p className="text-[10.5px] text-ink-muted">맛집 {ch.restaurant_count}곳</p>
                </div>

                {/* 체크박스 */}
                <div
                  style={{
                    background: isSelected ? channelColor(hue) : 'transparent',
                    borderColor: isSelected ? channelColor(hue) : '#D5CDB8',
                  }}
                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-[1.5px] text-white"
                >
                  {isSelected && <CheckIcon />}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
