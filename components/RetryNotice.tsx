/** 첫 데이터를 끝내 못 받았을 때 지도 위에 띄우는 안내. 무엇이 안 됐는지와 다시 받는 버튼 */
export default function RetryNotice({ title, onRetry, testId, hint = '인터넷 연결을 확인하고 다시 불러와 보세요.', retry = '다시 불러오기' }: { title: string; onRetry: () => void; testId?: string; hint?: string; retry?: string }) {
  return (
    <div
      role="alert"
      data-testid={testId}
      className="pointer-events-auto fixed inset-x-4 top-[calc(120px+env(safe-area-inset-top))] z-[45] mx-auto max-w-[420px] rounded-card bg-paper px-4 py-4 shadow-[0_4px_16px_rgba(27,29,31,0.16)]"
    >
      <p className="text-body font-bold text-ink">{title}</p>
      <p className="mt-1 text-meta text-sub">{hint}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex min-h-[44px] items-center rounded-card bg-ink px-4 text-body font-bold text-paper"
      >
        {retry}
      </button>
    </div>
  )
}
