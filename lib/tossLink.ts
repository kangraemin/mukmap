// 웹에서 토스 미니앱을 같은 조건으로 여는 주소.
// 토스 공유 링크(minion.toss.im)가 풀리는 onelink 모양을 그대로 만든다. 토스가 있으면 미니앱이, 없으면 스토어가 열린다.
// 감싸는 순서는 tests/e2e/share-roundtrip.spec.ts 의 실제 링크 풀기 테스트가 지킨다
const ONELINK = 'https://toss.onelink.me/3563614660'

// 앱이 첫 화면에서 utm_*을 읽어 웹에서 넘어온 사람을 센다(lib/analytics.ts entryOf)
const UTM = { utm_source: 'web', utm_medium: 'referral', utm_campaign: 'mukmap_open_toss' }

export function tossHref(q: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...q, ...UTM })) if (v !== undefined && v !== '') sp.set(k, String(v))
  const qs = sp.toString()
  const intoss = `intoss://mukmap-kr${qs ? `?${qs}` : ''}`
  const supertoss = `supertoss://total-services?redirect=${encodeURIComponent(intoss)}`
  const p = new URLSearchParams({ pid: 'appsintoss', af_dp: supertoss, deep_link_value: supertoss, af_force_deeplink: 'true' })
  return `${ONELINK}?${p.toString()}`
}

// '토스 앱으로 열기' 버튼 모양. 토스 파랑 바탕에 흰 글씨라 밝은·어두운 화면 모두에서 또렷하다(테두리만 있던 버튼은 어두운 화면에서 안 보였다)
export const TOSS_BUTTON = 'inline-flex items-center rounded-full bg-[#1B64DA] font-bold text-white active:bg-[#1957C2]'
