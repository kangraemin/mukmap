// 이벤트 이름·파라미터를 한 곳에 모은다. 웹은 GA4(gtag), 토스 앱은 토스 SDK(Analytics.log)로 같은 이름을 보낸다.
// 이벤트 표: docs/analytics.md. 개인정보(이름·전화·위치)는 넣지 않는다
export type EventName =
  | 'app_open'          // 지도 화면을 처음 그림. first, days_since_first, entry, utm_*
  | 'app_ready'         // 소개 화면이 걷히고 지도를 쓸 수 있게 됨. ms, cached
  | 'screen_open'       // 지도·카드·목록·상세로 바뀜. screen, id
  | 'screen_leave'      // 그 화면을 떠남. screen, ms(머문 시간)
  | 'pins_load'         // 가게 목록 받기 끝. ok, ms, tries, cached
  | 'load_retry'        // 첫 요청 실패 후 다시 받기. what, n
  | 'load_fail'         // 끝내 못 받음(재시도 안내를 띄움). what
  | 'load_retry_tap'    // 안내의 다시 불러오기를 누름. what
  | 'search_result'     // 검색어로 거른 결과. q, count
  | 'search_select'     // 검색 결과에서 고름. kind, id
  | 'filter_change'     // 유튜버·지역 칩. type, value, count
  | 'list_click'        // 목록에서 가게를 누름. id, rank, sort
  | 'video_watch_click' // 핵심 행동: 영상 장면 보러 유튜브로. id, where, rank
  | 'directions_click'  // 네이버 지도 길찾기로. id
  | 'share_attempt'     // 공유 버튼. kind, id
  | 'share_success'     // 공유 창이 끝까지 열림. kind, id
  | 'share_fail'        // 공유 실패. kind, msg
  | 'like_toggle'       // 찜 하트. id, on, count
  | 'ad_request'        // 배너 요청. kind
  | 'ad_shown'          // 배너가 보임. kind
  | 'ad_click'          // 배너 누름. kind
  | 'ad_fail'           // 배너 없음·실패. kind, reason
  | 'review_request'    // 토스 리뷰 요청. supported, ok
  | 'alert_on'          // 토스 '새 맛집 알림' 켬. channel, agreed
  | 'alert_off'         // 알림 끔. channel
  | 'alert_rejected'    // 토스 동의창에서 거절. channel
  | 'alert_fail'        // 켜기·끄기 실패. channel, msg
  | 'near_on'           // 토스 '찜한 곳 근처 새 맛집 알림' 켬. from(like|button), agreed, count
  | 'near_off'          // 근처 알림 끔
  | 'near_rejected'     // 근처 알림 동의창 거절. from
  | 'near_fail'         // 근처 알림 켜기·끄기 실패. from, msg
  | 'toss_open_click'   // 웹의 '토스 앱으로 열기'. where
  | 'app_error'         // 화면 오류. where, msg

// 토스 SDK의 log_type. 화면은 screen, 누름은 click, 노출은 impression
export type LogType = 'event' | 'screen' | 'click' | 'impression' | 'popup' | 'error'
export type Params = Record<string, string | number | boolean | null | undefined>
type Sink = (name: EventName, params: Params, type: LogType) => void

const sinks: Sink[] = []

/** 토스 앱은 SDK로 보내는 곳을 더한다(toss/src/main.tsx) */
export function addSink(s: Sink) {
  sinks.push(s)
}

type Win = Window & { gtag?: (...a: unknown[]) => void; __mkEvents?: unknown[] }

export function track(name: EventName, params: Params = {}, type: LogType = 'event') {
  const clean: Params = {}
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') clean[k] = v
  if (typeof window === 'undefined') return
  const w = window as Win
  // 테스트가 보낸 이벤트를 읽는다
  ;(w.__mkEvents ??= []).push({ name, ...clean })
  // 웹은 layout이 gtag를 먼저 깔아 둔다. 토스 앱엔 없다
  try { w.gtag?.('event', name, clean) } catch {}
  for (const s of sinks) {
    try { s(name, clean, type) } catch {}
  }
}

/** data-track="이름" data-track-where="main" 처럼 단 요소를 누르면 보낸다. 서버에서 그린 페이지에서도 쓰려고 위임으로 듣는다 */
export function listenTrackedClicks() {
  if (typeof document === 'undefined') return () => {}
  const on = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest?.('[data-track]') as HTMLElement | null
    if (!el) return
    const params: Params = {}
    for (const [k, v] of Object.entries(el.dataset)) {
      if (k === 'track' || !k.startsWith('track') || v === undefined) continue
      const key = k.slice(5).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, '')
      params[key] = /^\d+$/.test(v) ? Number(v) : v
    }
    track(el.dataset.track as EventName, params, 'click')
  }
  document.addEventListener('click', on, true)
  return () => document.removeEventListener('click', on, true)
}

const FIRST_KEY = 'mukmap:first'

/** 처음 연 날을 기기에 남겨 첫 실행인지, 며칠 만에 다시 왔는지 센다 */
export function visitInfo(now = Date.now()): { first: boolean; days_since_first: number } {
  try {
    const t = Number(localStorage.getItem(FIRST_KEY))
    if (!t) {
      localStorage.setItem(FIRST_KEY, String(now))
      return { first: true, days_since_first: 0 }
    }
    return { first: false, days_since_first: Math.floor((now - t) / 86_400_000) }
  } catch {
    return { first: true, days_since_first: 0 }
  }
}

/** 어디서 들어왔는지: 공유 링크·웹·검색어 링크·바로 */
export function entryOf(search: string): Params {
  const q = new URLSearchParams(search)
  const utm = { utm_source: q.get('utm_source'), utm_medium: q.get('utm_medium'), utm_campaign: q.get('utm_campaign') }
  const entry = utm.utm_source ? utm.utm_source
    : q.get('pin') || q.get('place') ? 'share'
    : q.get('from') ? 'web_list'
    : q.get('yt') || q.get('region') || q.get('q') ? 'link'
    : 'direct'
  return { entry, ...utm }
}
