/** 찜 하트. 찜하면 채운다. 토스 앱과 같이 쓴다 */
export function HeartIcon({ on, size = 20 }: { on: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <path
        d="M10 16.5s-6.5-3.9-6.5-8.6A3.4 3.4 0 0 1 10 6a3.4 3.4 0 0 1 6.5 1.9c0 4.7-6.5 8.6-6.5 8.6z"
        fill={on ? '#F04452' : 'none'}
        stroke={on ? '#F04452' : 'currentColor'}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}
