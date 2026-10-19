// 토스 웹뷰 안에서 생기는 오류와 진행 단계를 서버 로그로 보낸다(웹뷰는 개발자 도구를 못 연다)
const API = import.meta.env.VITE_API_BASE || 'https://mukmap.kr';
const sid = Math.random().toString(36).slice(2, 8);
const t0 = performance.now();

export function report(ev: string, data?: unknown) {
  const body = JSON.stringify({
    sid, ev, ms: Math.round(performance.now() - t0), data,
    ...(ev === 'boot' ? { ua: navigator.userAgent, href: location.href, vw: innerWidth, vh: innerHeight } : {}),
  });
  try {
    if (!navigator.sendBeacon?.(`${API}/api/client-log`, body)) throw 0;
  } catch {
    fetch(`${API}/api/client-log`, { method: 'POST', body, keepalive: true }).catch(() => {});
  }
}

report('boot');
addEventListener('error', (e) => report('error', `${e.message} @${e.filename}:${e.lineno}`));
addEventListener('unhandledrejection', (e) => report('rejection', String(e.reason?.stack || e.reason)));
const origError = console.error;
console.error = (...a: unknown[]) => { report('console.error', a.map(String).join(' ').slice(0, 500)); origError(...a); };

// 지도 SDK와 화면 상태를 몇 번 찍어 둔다
for (const s of [3, 8, 15]) {
  setTimeout(() => {
    const w = window as unknown as { naver?: { maps?: unknown } };
    const map = document.querySelector('[class*="map"], #map') as HTMLElement | null;
    report(`snap${s}`, {
      naver: !!w.naver?.maps,
      imgs: document.querySelectorAll('img').length,
      map: map ? `${map.offsetWidth}x${map.offsetHeight}` : null,
      vh: innerHeight, text: document.body.innerText.slice(0, 120),
    });
  }, s * 1000);
}

// 네이버 지도 키 인증이 실패하면 SDK가 이 전역 함수를 부른다
(window as unknown as { navermap_authFailure: () => void }).navermap_authFailure = () => report('naver-auth-fail', location.origin);
