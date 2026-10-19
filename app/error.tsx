'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-title font-bold text-ink">페이지를 불러오지 못했어요</h1>
      <p className="mt-2 text-body text-sub">네트워크 상태를 확인한 뒤 다시 시도해 보세요.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-[48px] items-center rounded-card bg-ink px-5 text-body font-bold text-paper"
      >
        다시 불러오기
      </button>
    </main>
  )
}
