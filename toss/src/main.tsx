import { report } from './debug';
import { Component, StrictMode, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics, Review } from '@apps-in-toss/web-framework';
import HomeExplorer from '@/components/HomeExplorer';
import { LIKES_KEY, localLikeStore, type LikeStore } from '@/lib/likes';
import RetryNotice from '@/components/RetryNotice';
import { addSink, listenTrackedClicks, track } from '@/lib/analytics';
import AdBanner from './AdBanner';
import AlertButton from './AlertButton';
import { NearAlertButton, NearAlertToast, nearLikeChange } from './NearAlert';
import { preloadMapSdk } from '@/components/NaverMap';
import { loadPins } from '@/lib/pins';
import type { Channel } from '@/lib/types';
import type { ShareMessage } from '@/lib/share';
import '@/app/globals.css';
import './toss.css';

// 로컬 확인용으로만 VITE_API_BASE를 바꾼다
const API = import.meta.env.VITE_API_BASE || 'https://mukmap.kr';

type ChannelRow = Channel & { restaurant_count: number };

// 리뷰 요청: 핵심 행동(영상 장면 보러 가기) 뒤 앱으로 돌아왔을 때, 기기당 한 번만 (앱인토스 노출 가이드: 행동을 마친 뒤에 묻는다)
const REVIEW_KEY = 'mukmap:review-asked';
let reviewPending = false;
async function askReview() {
  reviewPending = false;
  try {
    if (localStorage.getItem(REVIEW_KEY)) return;
  } catch {
    return;
  }
  let supported = false;
  try {
    supported = Review.request.isSupported();
  } catch {}
  if (!supported) return track('review_request', { supported: false }, 'popup');
  try {
    localStorage.setItem(REVIEW_KEY, String(Date.now()));
    await Review.request();
    track('review_request', { supported: true, ok: true }, 'popup');
  } catch (e) {
    track('review_request', { supported: true, ok: false, msg: String(e).slice(0, 100) }, 'popup');
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && reviewPending) askReview();
});

// 이벤트는 웹(GA4)과 같은 이름으로 토스 SDK에도 보낸다. 콘솔 전환 지표는 video_watch_click(docs/analytics.md)
addSink((name, params, type) => {
  Analytics.log({ log_name: name, log_type: type, params }).catch(() => {});
  if (name === 'video_watch_click') reviewPending = true;
  // 유튜브에서 돌아왔다는 신호(visibilitychange)가 안 오는 기기도 있어, 지도·목록으로 돌아오면 그때 묻는다
  if (name === 'screen_open' && reviewPending && params.screen !== 'detail') askReview();
});
listenTrackedClicks();
addEventListener('error', (e) => track('app_error', { where: 'window', msg: String(e.message).slice(0, 100) }, 'error'));
addEventListener('unhandledrejection', (e) => track('app_error', { where: 'promise', msg: String(e.reason).slice(0, 100) }, 'error'));

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
async function shareLink({ query, text, image }: ShareMessage): Promise<boolean> {
  document.documentElement.dataset.mkShare = query;
  document.documentElement.dataset.mkShareText = text;
  const q = new URLSearchParams(query);
  const id = Number(q.get('pin') || q.get('place')) || undefined;
  const kind = id ? 'place' : 'list';
  track('share_attempt', { kind, id }, 'click');
  try {
    const { getTossShareLink, share } = await import('@apps-in-toss/web-framework');
    // 미리보기 그림을 넣어야 카톡 등에서 링크가 카드로 보인다
    const link = await getTossShareLink(`intoss://mukmap-kr?${query}`, image);
    report('share', { query, link });
    await share({ message: `${text}\n${link}` });
    track('share_success', { kind, id });
    return true;
  } catch (e) {
    report('share-fail', String(e));
    track('share_fail', { kind, id, msg: String(e).slice(0, 100) });
    return false;
  }
}

// 찜은 토스 앱 저장소에 둔다(앱을 껐다 켜도 남는다). 저장소가 안 되면 웹뷰 localStorage로
const tossLikeStore: LikeStore = {
  get: async () => {
    try {
      const { Storage } = await import('@apps-in-toss/web-framework');
      return await Storage.getItem(LIKES_KEY);
    } catch (e) {
      report('likes-get-fail', String(e));
      return localLikeStore.get();
    }
  },
  set: async (v) => {
    try {
      const { Storage } = await import('@apps-in-toss/web-framework');
      await Storage.setItem(LIKES_KEY, v);
    } catch (e) {
      report('likes-set-fail', String(e));
      await localLikeStore.set(v);
    }
  },
};

// 화면을 그리다 터지면 흰 화면 대신 안내와 다시 열기
class Boundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  componentDidCatch(e: Error) {
    report('boundary', String(e.stack || e));
    track('app_error', { where: 'render', msg: String(e.message).slice(0, 100) }, 'error');
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <main role="alert" className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <p className="text-title font-bold text-ink">화면을 그리지 못했어요</p>
        <p className="mt-2 text-body text-sub">다시 열면 대부분 괜찮아져요.</p>
        <button type="button" onClick={() => location.reload()} className="mt-6 inline-flex min-h-[48px] items-center rounded-card bg-ink px-5 text-body font-bold text-paper">
          다시 열기
        </button>
      </main>
    );
  }
}

const onLikeChange = nearLikeChange(API);

function App() {
  const [channels, setChannels] = useState<ChannelRow[] | null>(null);
  // 유튜버 목록을 끝내 못 받으면 안내와 다시 받기 버튼. tryKey를 올리면 다시 받는다
  const [failed, setFailed] = useState(false);
  const [tryKey, setTryKey] = useState(0);

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
          if (!live) return;
          if (n < 6) {
            track('load_retry', { what: 'channels', n: n + 1 });
            setTimeout(() => load(n + 1), 500 * 2 ** n);
          } else {
            track('load_fail', { what: 'channels' });
            setFailed(true);
          }
        });
    };
    load(0);
    return () => { live = false; };
  }, [tryKey]);

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
        likeStore={tossLikeStore}
        channelAction={(ch) => <AlertButton key={ch.id} api={API} channel={ch} />}
        likedAction={(ids) => <NearAlertButton api={API} ids={ids} />}
        onLikeChange={onLikeChange}
      />
      <NearAlertToast />
      {failed && (
        <RetryNotice
          testId="channels-retry"
          title="유튜버 목록을 불러오지 못했어요"
          onRetry={() => {
            track('load_retry_tap', { what: 'channels' });
            setFailed(false);
            setTryKey((k) => k + 1);
          }}
        />
      )}
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
      <Boundary>
        <App />
      </Boundary>
    </StrictMode>,
  );
});
