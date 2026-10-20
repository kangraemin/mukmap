// 웹에서 토스 미니앱을 같은 조건으로 여는 주소.
// 토스 공유 링크(minion.toss.im)가 풀리는 onelink 모양을 그대로 만든다. 토스가 있으면 미니앱이, 없으면 스토어가 열린다.
// 감싸는 순서는 tests/e2e/share-roundtrip.spec.ts 의 실제 링크 풀기 테스트가 지킨다
const ONELINK = 'https://toss.onelink.me/3563614660'

export function tossHref(q: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') sp.set(k, String(v))
  const qs = sp.toString()
  const intoss = `intoss://mukmap-kr${qs ? `?${qs}` : ''}`
  const supertoss = `supertoss://total-services?redirect=${encodeURIComponent(intoss)}`
  const p = new URLSearchParams({ pid: 'appsintoss', af_dp: supertoss, deep_link_value: supertoss, af_force_deeplink: 'true' })
  return `${ONELINK}?${p.toString()}`
}
