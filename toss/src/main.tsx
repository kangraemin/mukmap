import { report } from './debug';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import HomeExplorer from '@/components/HomeExplorer';
import AdBanner from './AdBanner';
import { preloadMapSdk } from '@/components/NaverMap';
import { loadPins } from '@/lib/pins';
import type { Channel } from '@/lib/types';
import type { ShareMessage } from '@/lib/share';
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
// (토스 출시 기준: 첫 화면 뒤로가기는 바로 종료, 종료를 막는 확인 창 금지)
import('@apps-in-toss/web-framework').then(({ graniteEvent, closeView }) => {
  graniteEvent.addEventListener('backEvent', {
    onEvent: () => {
      const v = window.history.state?.mk?.v ?? document.documentElement.dataset.mkNav ?? 'map';
      report('back', { v, state: !!window.history.state?.mk, len: window.history.length });
      if (v !== 'map') window.history.back();
      else closeView();
    },
    onError: (e) => report('back-event-fail', String(e)),
  });
  report('back-registered');
}).catch((e) => report('back-event-fail', String(e)));

// 공유: 받은 사람이 누르면 토스 앱에서 같은 가게·같은 조건으로 열린다(HomeExplorer가 ?pin·?place·?yt·?q를 읽는다)
async function shareLink({ query, text, image }: ShareMessage) {
  document.documentElement.dataset.mkShare = query;
  document.documentElement.dataset.mkShareText = text;
  try {
    const { getTossShareLink, share } = await import('@apps-in-toss/web-framework');
    // 미리보기 그림을 넣어야 카톡 등에서 링크가 카드로 보인다
    const link = await getTossShareLink(`intoss://mukmap-kr?${query}`, image);
    report('share', { query, link });
    await share({ message: `${text}\n${link}` });
  } catch (e) {
    report('share-fail', String(e));
  }
}

function App() {
  const [channels, setChannels] = useState<ChannelRow[] | null>(null);

  // 토스 앱을 막 띄운 순간에는 요청이 바로 실패하곤 한다(실기기 'Load failed', 2026-10-20). 실패하거나 비어 오면 다시 받는다
  useEffect(() => {
    let live = true;
    const load = (n: number) => {
      fetch(`${API}/api/channels`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d) => {
          if (!d.channels?.length) throw new Error('empty');
          report('channels', d.channels.length);
          if (live) setChannels(d.channels);
        })
        .catch((e) => {
          report('channels-fail', { n, e: String(e) });
          if (live && n < 6) setTimeout(() => load(n + 1), 500 * 2 ** n);
          else if (live) setChannels([]);
        });
    };
    load(0);
    return () => { live = false; };
  }, []);

  return (
    <>
      <HomeExplorer
        channels={channels ?? []}
        apiBase={API}
        pageLinks={false}
        hostNav
        detailAd={(id) => <AdBanner key={id} kind="strip" className="mt-6" />}
        listAd={(slot) => <AdBanner key={`list-${slot}`} kind="feed" className="my-3" />}
        previewAd={(id) => <AdBanner key={`pv-${id}`} kind="strip" variant="expanded" className="border-t border-line" />}
        onShare={shareLink}
      />
    </>
  );
}

// 웹 목록 페이지의 '토스 앱으로 열기'는 intoss://mukmap-kr?region=..&yt=.. 로 들어온다.
// 웹뷰 주소에 쿼리가 안 붙어 올 수 있어 진입 스킴에서 읽어 주소에 옮긴 뒤 화면을 그린다(HomeExplorer가 주소 쿼리를 읽는다)
async function applyEntryQuery() {
  try {
    const { getSchemeUri, Share } = await import('@apps-in-toss/web-framework');
    const scheme = getSchemeUri();
    report('entry', scheme);
    const q = new URL(scheme.replace(/^intoss(-private)?:\/\//, 'https://x/')).search;
    if (q && !location.search) history.replaceState(history.state, '', `${location.pathname}${q}${location.hash}`);
    // 웹이 쓸 기본 공유 링크 형식을 로그로 받는다(공개 문서에 형식이 없다)
    Share.createLink({ path: 'intoss://mukmap-kr' }).then((l) => report('share-link', l)).catch((e) => report('share-link-fail', String(e)));
  } catch (e) {
    report('entry-fail', String(e));
  }
}

Promise.race([applyEntryQuery(), new Promise((r) => setTimeout(r, 800))]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
