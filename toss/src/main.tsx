import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import HomeExplorer from '@/components/HomeExplorer';
import type { Channel } from '@/lib/types';
import '@/app/globals.css';
import './toss.css';

// 로컬 확인용으로만 VITE_API_BASE를 바꾼다
const API = import.meta.env.VITE_API_BASE || 'https://mukmap.kr';

type ChannelRow = Channel & { restaurant_count: number };

// 토스 웹뷰에서는 새 창 링크가 열리지 않는다. 바깥 주소(유튜브, 네이버 지도)는 SDK openURL로 넘긴다
document.addEventListener('click', async (e) => {
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || a.origin === location.origin || !/^https?:/.test(a.href)) return;
  e.preventDefault();
  try {
    const { openURL } = await import('@apps-in-toss/web-framework');
    await openURL(a.href);
  } catch {
    location.href = a.href;
  }
}, true);

function App() {
  const [channels, setChannels] = useState<ChannelRow[] | null>(null);

  useEffect(() => {
    fetch(`${API}/api/channels`)
      .then((r) => r.json())
      .then((d) => setChannels(d.channels || []))
      .catch(() => setChannels([]));
  }, []);

  if (!channels) return <div className="h-[100dvh] bg-paper" />;
  return <HomeExplorer channels={channels} apiBase={API} pageLinks={false} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
