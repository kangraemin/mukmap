// 알림 버튼들이 같이 쓰는 토스 기능: 동의창(Notification.requestAgreement)과 익명 키(User.getAnonymousKey).
// 동의는 알림 종류(발송 코드)마다 따로 받는다
import { report } from './debug';

export type Agreement = 'newAgreement' | 'alreadyAgreed' | 'agreementRejected';
export interface Bridge {
  agree: (templateCode: string) => Promise<Agreement>;
  anonKey: () => Promise<string | null>;
}

// 로컬 테스트(토스 밖)에서는 window.__mkAlertsStub 으로 토스 기능을 대신한다
declare global {
  interface Window { __mkAlertsStub?: Bridge }
}

const tossBridge: Bridge = {
  agree: async (templateCode) => {
    const { Notification } = await import('@apps-in-toss/web-framework');
    if (!Notification.requestAgreement.isSupported()) throw new Error('UNSUPPORTED_APP_VERSION');
    return new Promise<Agreement>((resolve, reject) => {
      const cleanup = Notification.requestAgreement({
        options: { templateCode },
        onEvent: ({ type }) => { cleanup(); resolve(type); },
        onError: (e) => { cleanup(); reject(e); },
      });
    });
  },
  anonKey: async () => {
    const { User } = await import('@apps-in-toss/web-framework');
    const r = await User.getAnonymousKey();
    return r && typeof r === 'object' ? r.hash : null;
  },
};
export const bridge = () => (import.meta.env.DEV && window.__mkAlertsStub) || tossBridge;

let keyP: Promise<string | null> | null = null;
export const anonKey = () => (keyP ??= bridge().anonKey().catch((e) => { report('anon-key-fail', String(e)); keyP = null; return null; }));
