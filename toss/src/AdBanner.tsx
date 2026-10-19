import { useEffect, useRef, useState } from 'react';
import { attachBanner, type AdKind } from './ads';

/** 광고 한 칸. 띠(strip)는 공식 권장대로 높이 96px로 고정한다. 광고가 없거나 토스 밖이면 자리째 사라진다 */
export default function AdBanner({ className = 'mt-8', kind = 'strip', variant = 'card' }: { className?: string; kind?: AdKind; variant?: 'card' | 'expanded' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(false);
  useEffect(() => attachBanner(ref.current!, () => setEmpty(true), kind, variant), [kind, variant]);
  if (empty) return null;
  const size = kind === 'strip' ? 'h-[96px] overflow-hidden' : 'min-h-[96px]';
  return <div ref={ref} data-testid="ad-banner" data-kind={kind} className={`w-full ${size} ${className}`} />;
}
