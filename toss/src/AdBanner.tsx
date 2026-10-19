import { useEffect, useRef, useState } from 'react';
import { attachBanner } from './ads';

/** 가게 상세 맨 아래 광고 한 칸. 광고가 없거나 토스 밖이면 자리째 사라진다 */
export default function AdBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(false);
  useEffect(() => attachBanner(ref.current!, () => setEmpty(true)), []);
  if (empty) return null;
  return <div ref={ref} data-testid="ad-banner" className="mx-4 mb-8 mt-10 min-h-[96px] sm:mx-0" />;
}
