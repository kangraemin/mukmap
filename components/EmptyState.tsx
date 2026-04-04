'use client'

interface EmptyStateProps {
  message?: string
}

export default function EmptyState({ message = '이 지역에는 아직 수집된 맛집이 없어요' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 text-4xl">🍽️</div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}
