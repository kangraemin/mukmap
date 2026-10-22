// '찜한 곳 근처 새 맛집 알림'. 처음 찜할 때 한 번만 동의를 묻고, 동의하면 찜 목록을 서버에 맞춰 둔다.
// 거절하면 NEAR_ASK_AGAIN_DAYS 동안 다시 묻지 않는다. 찜한 곳만 볼 때 목록 머리줄 버튼으로 켜고 끌 수 있다.
// 보내는 건 서버(/api/cron/alerts)가 한다. 한 사람에게 며칠에 한 번까지만이다
import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import { NEAR_ASK_AGAIN_DAYS, NEAR_MAX_IDS, NEAR_TEMPLATE } from '@/lib/alerts-shared';
import { report } from './debug';
import { anonKey, bridge } from './alertBridge';
import { BellIcon } from './AlertButton';

const ASKED_KEY = 'mukmap:near-asked:v1';

async function kvGet(k: string) {
  try {
    const { Storage } = await import('@apps-in-toss/web-framework');
    return await Storage.getItem(k);
  } catch {
    try { return localStorage.getItem(k); } catch { return null; }
  }
}
async function kvSet(k: string, v: string) {
  try {
    const { Storage } = await import('@apps-in-toss/web-framework');
    await Storage.setItem(k, v);
  } catch {
    try { localStorage.setItem(k, v); } catch { /* 못 남겨도 다음에 한 번 더 물을 뿐 */ }
  }
}

// 켜져 있는지는 앱을 연 뒤 서버에 한 번만 묻고, 버튼과 찜 동기화가 같이 쓴다
let onP: Promise<boolean> | null = null;
const listeners = new Set<(on: boolean) => void>();
function setOnState(on: boolean) {
  onP = Promise.resolve(on);
  listeners.forEach((f) => f(on));
}
function loadOn(api: string) {
  return (onP ??= anonKey().then(async (k) => {
    if (!k) return false;
    const r = await fetch(`${api}/api/alerts/near`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anonKey: k }) });
    if (!r.ok) throw new Error(String(r.status));
    return !!(await r.json()).on;
  }).catch((e) => { report('near-load-fail', String(e)); onP = null; return false; }));
}

async function save(api: string, on: boolean, ids: number[]) {
  const k = await anonKey();
  if (!k) throw new Error('no anonKey');
  const r = await fetch(`${api}/api/alerts/near`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(on ? { anonKey: k, on, ids: ids.slice(-NEAR_MAX_IDS) } : { anonKey: k, on }),
  });
  if (!r.ok) throw new Error(String(r.status));
  setOnState(on);
}

// 안내 글은 화면 한 곳(NearAlertToast)에 띄운다
const toastFns = new Set<(t: string) => void>();
const say = (t: string) => toastFns.forEach((f) => f(t));

async function ask(api: string, ids: number[], from: 'like' | 'button') {
  const agreed = await bridge().agree(NEAR_TEMPLATE);
  if (agreed === 'agreementRejected') {
    await kvSet(ASKED_KEY, String(Date.now()));
    track('near_rejected', { from }, 'click');
    return false;
  }
  await save(api, true, ids);
  track('near_on', { from, agreed, count: ids.length }, 'click');
  say('찜한 곳 근처에 새 맛집이 올라오면 알려 드릴게요');
  return true;
}

// 찜이 바뀔 때마다 부른다. 켜져 있으면 서버 찜 목록을 맞추고(잠깐 모았다가 한 번에), 꺼져 있으면 처음 찜할 때만 동의를 묻는다
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let asking = false;
export function nearLikeChange(api: string) {
  return async (ids: number[], liked: boolean) => {
    try {
      if (await loadOn(api)) {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
          save(api, true, ids).catch((e) => report('near-sync-fail', String(e)));
        }, 800);
        return;
      }
      if (!liked || asking) return;
      const last = Number(await kvGet(ASKED_KEY)) || 0;
      if (Date.now() - last < NEAR_ASK_AGAIN_DAYS * 86400_000) return;
      asking = true;
      await ask(api, ids, 'like');
    } catch (e) {
      report('near-fail', String(e));
      track('near_fail', { from: 'like', msg: String(e).slice(0, 100) }, 'error');
    } finally {
      asking = false;
    }
  };
}

export function NearAlertButton({ api, ids }: { api: string; ids: number[] }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    loadOn(api).then((v) => live && setOn(v));
    const f = (v: boolean) => live && setOn(v);
    listeners.add(f);
    return () => { live = false; listeners.delete(f); };
  }, [api]);

  const press = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        await save(api, false, []);
        track('near_off', {}, 'click');
        say('근처 새 맛집 알림을 껐어요');
        return;
      }
      await ask(api, ids, 'button');
    } catch (e) {
      report('near-fail', String(e));
      track('near_fail', { from: 'button', msg: String(e).slice(0, 100) }, 'error');
      say(String(e).includes('UNSUPPORTED') ? '토스 앱을 업데이트하면 알림을 받을 수 있어요' : '알림을 바꾸지 못했어요. 잠시 뒤 다시 눌러 주세요');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      data-testid="near-toggle"
      aria-pressed={on}
      onClick={press}
      disabled={busy}
      className="flex min-h-[44px] items-center gap-1 px-2 text-meta font-bold text-ink disabled:opacity-50"
    >
      <BellIcon on={on} />
      {on ? '근처 알림 켜짐' : '근처 새 맛집 알림'}
    </button>
  );
}

export function NearAlertToast() {
  const [toast, setToast] = useState('');
  useEffect(() => {
    toastFns.add(setToast);
    return () => { toastFns.delete(setToast); };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div role="status" data-testid="near-toast" className="fixed inset-x-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-50 rounded-card bg-ink px-4 py-3 text-center text-body text-paper">
      {toast}
    </div>
  );
}
