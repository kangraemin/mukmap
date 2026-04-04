'use client'

import { REGIONS, CATEGORIES } from '@/lib/constants'

interface RegionCategoryFilterProps {
  region: string
  categories: string[]
  onRegionChange: (region: string) => void
  onCategoryToggle: (category: string) => void
  onReset: () => void
}

export default function RegionCategoryFilter({
  region,
  categories,
  onRegionChange,
  onCategoryToggle,
  onReset,
}: RegionCategoryFilterProps) {
  const activeCount = (region ? 1 : 0) + categories.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          필터
          {activeCount > 0 && (
            <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
              {activeCount}
            </span>
          )}
        </h3>
        {activeCount > 0 && (
          <button onClick={onReset} className="text-xs text-primary hover:underline">
            초기화
          </button>
        )}
      </div>

      {/* Region dropdown */}
      <select
        value={region}
        onChange={(e) => onRegionChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-secondary"
      >
        <option value="">전체 지역</option>
        {REGIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const isActive = categories.includes(cat)
          return (
            <button
              key={cat}
              onClick={() => onCategoryToggle(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-100'
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
