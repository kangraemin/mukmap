import { TossAds } from '@apps-in-toss/web-framework';
import { track } from '@/lib/analytics';

/** 배너 모양은 광고 그룹 종류로 정해진다. 실제 ID로 테스트하면 정책 위반이라 출시 빌드에서만 쓴다 */
const LIVE = import.meta.env.VITE_ADS === 'live';
const BANNER = {
  // 콘솔 '띠배너'(문구 강조): 높이 96px 띠
  strip: LIVE ? 'ait.v2.live.10db92e52e504e1a' : 'ait-ad-test-banner-id',
  // 콘솔 '상세배너'(이미지 강조): 큰 이미지 광고
  feed: LIVE ? 'ait.v2.live.597f0f3bb2014637' : 'ait-ad-test-native-image-id',
};
export type AdKind = keyof typeof BANNER;

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
export function attachBanner(target: HTMLElement, onEmpty: () => void, kind: AdKind, variant: 'card' | 'expanded' = 'card') {
  let detach: (() => void) | undefined;
  let gone = false;
  const fail = (reason: string) => {
    track('ad_fail', { kind, reason });
    onEmpty();
  };
  init().then((ok) => {
    if (gone) return;
    if (!ok) return fail('init');
    track('ad_request', { kind });
    try {
      detach = TossAds.attachBanner(BANNER[kind], target, {
        variant,
        callbacks: {
          onNoFill: () => fail('nofill'),
          onAdFailedToRender: () => fail('render'),
          onAdImpression: () => track('ad_shown', { kind }, 'impression'),
          onAdClicked: () => track('ad_click', { kind }, 'click'),
        },
      }).destroy;
    } catch {
      fail('attach');
    }
  });
  return () => {
    gone = true;
    detach?.();
  };
}
