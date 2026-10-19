import { report } from './debug';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import HomeExplorer from '@/components/HomeExplorer';
import { preloadMapSdk } from '@/components/NaverMap';
import { loadPins } from '@/lib/pins';
import type { Channel } from '@/lib/types';
import '@/app/globals.css';
import './toss.css';

// 로컬 확인용으로만 VITE_API_BASE를 바꾼다
const API = import.meta.env.VITE_API_BASE || 'https://mukmap.kr';

type ChannelRow = Channel & { restaurant_count: number };

// 화면을 그리기 전에 핀 목록과 지도 SDK를 같이 받기 시작한다
loadPins(API).catch((e) => report('pins-fail', String(e)));
preloadMapSdk();

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

// 토스 뒤로가기: 지도 위 카드·목록·상세가 열려 있으면 한 단계 닫고, 지도뿐이면 앱을 닫는다
import('@apps-in-toss/web-framework').then(({ graniteEvent, closeView }) => {
  graniteEvent.addEventListener('backEvent', {
    onEvent: () => {
      const mk = window.history.state?.mk;
      if (mk && mk.v !== 'map') window.history.back();
      else closeView();
    },
    onError: (e) => report('back-event-fail', String(e)),
  });
}).catch((e) => report('back-event-fail', String(e)));

function App() {
  const [channels, setChannels] = useState<ChannelRow[] | null>(null);

  useEffect(() => {
    fetch(`${API}/api/channels`)
      .then((r) => r.json())
      .then((d) => { report('channels', d.channels?.length); setChannels(d.channels || []); })
      .catch((e) => { report('channels-fail', String(e)); setChannels([]); });
  }, []);

  return <HomeExplorer channels={channels ?? []} apiBase={API} pageLinks={false} hostNav />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
