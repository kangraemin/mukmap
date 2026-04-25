'use client'

interface EmptyStateProps {
  message?: string
  onReset?: () => void
}

export default function EmptyState({
  message = '조건에 맞는 맛집이 없어요',
  onReset,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-low text-ink-muted">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6"/>
          <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M8 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="text-[14px] font-bold text-ink-body">{message}</p>
      <p className="mt-1 text-xs text-ink-tertiary">필터를 다시 설정해보세요</p>
      {onReset && (
        <button
          onClick={onReset}
          className="mt-3 rounded-lg bg-ink-body px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-80"
        >
          필터 초기화
        </button>
      )}
    </div>
  )
}
