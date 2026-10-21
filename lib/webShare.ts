// 웹(mukmap.kr) 공유. 휴대폰 공유창이 있으면 그걸 열고, 없으면 글과 링크를 복사한다.
// 가게는 서버가 그린 가게 페이지(/restaurant/12)로, 거른 지도는 같은 조건의 지도 주소로 보낸다
import type { ShareMessage } from './share'
import { track } from './analytics'

export function webShareUrl(query: string, origin = window.location.origin) {
  const q = new URLSearchParams(query)
  const id = Number(q.get('pin') || q.get('place'))
  return id > 0 ? `${origin}/restaurant/${id}` : `${origin}/?${query}`
}

/** 공유창을 열었으면 false(창이 알아서 알린다), 복사했으면 안내 글, 실패하면 false */
export async function webShare({ query, text }: ShareMessage): Promise<boolean | string> {
  const url = webShareUrl(query)
  const id = Number(new URLSearchParams(query).get('pin') || new URLSearchParams(query).get('place')) || undefined
  const kind = id ? 'place' : 'list'
  track('share_attempt', { kind, id, via: 'web' }, 'click')
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, url })
      track('share_success', { kind, id, via: 'web' })
    } catch (e) {
      // 사용자가 닫았거나 막혔다
      track('share_fail', { kind, id, via: 'web', msg: String(e).slice(0, 100) })
    }
    return false
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    track('share_success', { kind, id, via: 'copy' })
    return '링크를 복사했어요'
  } catch (e) {
    track('share_fail', { kind, id, via: 'copy', msg: String(e).slice(0, 100) })
    return false
  }
}
