'use client'

import { useState } from 'react'
import { REGIONS, CATEGORIES } from '@/lib/constants'

interface RegionCategoryFilterProps {
  region: string
  categories: string[]
  onRegionChange: (region: string) => void
  onCategoryToggle: (category: string) => void
  onReset: () => void
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
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

export default function RegionCategoryFilter({
  region,
  categories,
  onRegionChange,
  onCategoryToggle,
  onReset,
}: RegionCategoryFilterProps) {
  const [open, setOpen] = useState(false)
  const activeCount = (region ? 1 : 0) + categories.length

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-section">
          필터
          {activeCount > 0 && (
            <span
              style={{ background: 'oklch(0.68 0.18 28)' }}
              className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white"
            >
              {activeCount}
            </span>
          )}
        </span>
        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="text-[11px] text-ink-muted hover:text-ink-body transition-colors"
          >
            초기화
          </button>
        )}
      </div>

      {/* 커스텀 지역 드롭다운 */}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-white px-2.5 py-[7px] text-left text-[12.5px] font-semibold text-ink-body transition-colors hover:bg-surface-low"
        >
          <span className="flex items-center gap-1.5 text-ink-tertiary">
            <PinIcon />
            <span className={region ? 'text-ink-body' : ''}>{region || '전체 지역'}</span>
          </span>
          <span
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            className="text-ink-muted"
          >
            <ChevronDown />
          </span>
        </button>

        {open && (
          <>
            <div
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-20"
            />
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-white p-1 shadow-lg">
              <button
                onClick={() => { onRegionChange(''); setOpen(false) }}
                className={`w-full rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                  !region ? 'bg-primary-light font-semibold text-primary-deep' : 'font-medium text-ink-body hover:bg-surface-low'
                }`}
              >
                전체 지역
              </button>
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => { onRegionChange(r); setOpen(false) }}
                  className={`w-full rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                    region === r ? 'bg-primary-light font-semibold text-primary-deep' : 'font-medium text-ink-body hover:bg-surface-low'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 카테고리 칩: 다크 active */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const isActive = categories.includes(cat)
          return (
            <button
              key={cat}
              onClick={() => onCategoryToggle(cat)}
              className={`rounded-full border px-2.5 py-[5px] text-xs font-semibold transition-all duration-100 ${
                isActive
                  ? 'border-ink-body bg-ink-body text-white'
                  : 'border-border bg-white text-ink-section hover:bg-surface-low'
              }`}
            >
              {cat}
            </button>
          )
        })}
      </div>
    </div>
  )
}
