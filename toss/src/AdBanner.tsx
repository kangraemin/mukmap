import { useEffect, useRef, useState } from 'react';
import { attachBanner } from './ads';

/** 광고 한 칸. 광고가 없거나 토스 밖이면 자리째 사라진다 */
export default function AdBanner({ className = 'mt-8', variant = 'card' }: { className?: string; variant?: 'card' | 'expanded' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(false);
  useEffect(() => attachBanner(ref.current!, () => setEmpty(true), variant), [variant]);
  if (empty) return null;
  return <div ref={ref} data-testid="ad-banner" className={`min-h-[96px] ${className}`} />;
}
