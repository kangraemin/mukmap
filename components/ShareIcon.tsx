/** 공유 아이콘(위로 나가는 화살표 + 상자). 토스 앱과 같이 쓴다 */
export function ShareIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 12.5V3M6.5 6.5 10 3l3.5 3.5" />
      <path d="M4.5 10v5.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V10" />
    </svg>
  )
}
