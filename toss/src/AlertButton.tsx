// 유튜버를 고른 목록 머리줄의 '새 맛집 알림' 버튼.
// 토스 동의창(Notification.requestAgreement)에서 동의하면 익명 키(User.getAnonymousKey)로 그 유튜버를 구독한다.
// 보내는 건 서버(/api/cron/alerts)가 하루 한 번, 그 유튜버가 다녀간 가게가 새로 올라왔을 때만이다.
import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import { ALERT_TEMPLATE } from '@/lib/alerts-shared';
import { iGa } from '@/lib/josa';
import { report } from './debug';
import { anonKey, bridge } from './alertBridge';

// 켜 둔 유튜버 목록은 앱을 연 뒤 한 번만 받아 모든 버튼이 같이 쓴다
let subsP: Promise<Set<string>> | null = null;
function loadSubs(api: string) {
  return (subsP ??= anonKey().then(async (k) => {
    if (!k) return new Set<string>();
    const r = await fetch(`${api}/api/alerts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anonKey: k }) });
    if (!r.ok) throw new Error(String(r.status));
    return new Set<string>((await r.json()).channels);
  }).catch((e) => { report('alerts-load-fail', String(e)); subsP = null; return new Set<string>(); }));
}

export function BellIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path d="M10 3a4.5 4.5 0 0 0-4.5 4.5v2.8L4 13h12l-1.5-2.7V7.5A4.5 4.5 0 0 0 10 3Zm-1.8 12a1.8 1.8 0 0 0 3.6 0" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function AlertButton({ api, channel }: { api: string; channel: { id: string; name: string } }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let live = true;
    loadSubs(api).then((s) => live && setOn(s.has(channel.id)));
    return () => { live = false; };
  }, [api, channel.id]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const save = async (next: boolean) => {
    const k = await anonKey();
    if (!k) throw new Error('no anonKey');
    const r = await fetch(`${api}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonKey: k, channelId: channel.id, on: next }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const subs = await loadSubs(api);
    if (next) subs.add(channel.id);
    else subs.delete(channel.id);
    setOn(next);
  };

  const press = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        await save(false);
        track('alert_off', { channel: channel.id }, 'click');
        setToast(`${channel.name} 새 맛집 알림을 껐어요`);
        return;
      }
      const agreed = await bridge().agree(ALERT_TEMPLATE);
      if (agreed === 'agreementRejected') {
        track('alert_rejected', { channel: channel.id }, 'click');
        return;
      }
      await save(true);
      track('alert_on', { channel: channel.id, agreed }, 'click');
      setToast(`${iGa(channel.name)} 다녀간 새 맛집이 올라오면 알려 드릴게요`);
    } catch (e) {
      report('alert-fail', String(e));
      track('alert_fail', { channel: channel.id, msg: String(e).slice(0, 100) }, 'error');
      setToast(String(e).includes('UNSUPPORTED') ? '토스 앱을 업데이트하면 알림을 받을 수 있어요' : '알림을 바꾸지 못했어요. 잠시 뒤 다시 눌러 주세요');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="alert-toggle"
        aria-pressed={on}
        onClick={press}
        disabled={busy}
        className="flex min-h-[44px] items-center gap-1 px-2 text-meta font-bold text-ink disabled:opacity-50"
      >
        <BellIcon on={on} />
        {on ? '알림 켜짐' : '새 맛집 알림'}
      </button>
      {toast && (
        <div role="status" data-testid="alert-toast" className="fixed inset-x-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-50 rounded-card bg-ink px-4 py-3 text-center text-body text-paper">
          {toast}
        </div>
      )}
    </>
  );
}
