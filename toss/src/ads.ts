import { TossAds } from '@apps-in-toss/web-framework';

/** 콘솔 광고 그룹 '상세배너'. 실제 ID로 테스트하면 정책 위반이라 출시 빌드에서만 쓴다 */
const LIVE_BANNER = 'ait.v2.live.597f0f3bb2014637';
const BANNER = import.meta.env.VITE_ADS === 'live' ? LIVE_BANNER : 'ait-ad-test-banner-id';

let ready: Promise<boolean> | undefined;

/** SDK 초기화는 앱 전체에서 한 번. 토스 밖이거나 구버전(5.241.0 미만)이면 false */
function init() {
  ready ??= new Promise((resolve) => {
    try {
      if (!TossAds.initialize.isSupported() || !TossAds.attachBanner.isSupported()) return resolve(false);
      TossAds.initialize({ callbacks: { onInitialized: () => resolve(true), onInitializationFailed: () => resolve(false) } });
    } catch {
      resolve(false);
    }
  });
  return ready;
}

/** target에 배너를 붙인다. 광고가 없으면 onEmpty로 자리를 접는다. 반환값으로 떼어 낸다 */
export function attachBanner(target: HTMLElement, onEmpty: () => void, variant: 'card' | 'expanded' = 'card') {
  let detach: (() => void) | undefined;
  let gone = false;
  init().then((ok) => {
    if (gone) return;
    if (!ok) return onEmpty();
    try {
      detach = TossAds.attachBanner(BANNER, target, {
        variant,
        callbacks: { onNoFill: onEmpty, onAdFailedToRender: onEmpty },
      }).destroy;
    } catch {
      onEmpty();
    }
  });
  return () => {
    gone = true;
    detach?.();
  };
}
