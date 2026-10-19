export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <p className="text-title">
        <span className="caption-band">여기엔 아무것도 없어요</span>
      </p>
      <p className="mt-4 text-body text-sub">주소가 바뀌었거나 문을 닫은 가게일 수 있어요.</p>
      <a href="/" className="mt-6 inline-flex min-h-[48px] items-center rounded-card bg-ink px-5 text-body font-bold text-paper">
        지도에서 다시 찾기
      </a>
    </main>
  )
}
