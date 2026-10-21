# 이벤트 로그

웹(mukmap.kr)과 토스 미니앱이 **같은 이름·같은 파라미터**로 보낸다.

- 정의: `lib/analytics.ts` (`track`, `EventName`)
- 웹: GA4 `G-KGKJWJ5NKV` (gtag). mukmap.kr에서만 켜진다(localhost·미리보기 주소는 안 보냄).
- 토스: `Analytics.log({ log_name, log_type, params })` (`toss/src/main.tsx`의 sink). GA는 토스 앱에 넣지 않는다(외부 스크립트가 늘어남).
- 테스트: `tests/e2e/analytics.spec.ts`, `tests/e2e/toss-webview.spec.ts`. 이름을 바꾸면 테스트와 콘솔 전환 지표·GA 주요 이벤트가 같이 끊긴다.
- 개인정보(이름·전화·위치)는 넣지 않는다. 빈 값은 보내지 않는다.

## 전환 지표

- **`video_watch_click`** — 가게 상세에서 영상 장면을 보러 유튜브로 나감. 먹맵의 핵심 행동.
- 앱인토스 콘솔 전환 지표와 GA4 주요 이벤트(key event)를 이 이름으로 건다.
- 보조: `share_success`(공유), `directions_click`(길찾기).

## 이벤트 표

| 이름 | 언제 | 파라미터 | 예 |
|---|---|---|---|
| `app_open` | 지도 화면을 처음 그림(페이지당 1번) | `first`, `days_since_first`, `entry`, `utm_source`, `utm_medium`, `utm_campaign` | `{first:false, days_since_first:3, entry:"threads", utm_source:"threads"}` |
| `app_ready` | 소개 화면이 걷히고 지도를 쓸 수 있게 됨 | `ms`(열고 나서 걸린 시간), `cached`(가게 목록 캐시 있었음) | `{ms:2140, cached:true}` |
| `screen_open` | 화면이 바뀜 | `screen`(map·preview·list·detail), `id` | `{screen:"detail", id:142}` |
| `screen_leave` | 그 화면을 떠남 | `screen`, `id`, `ms`(머문 시간) | `{screen:"list", ms:8300}` |
| `pins_load` | 가게 목록 받기 끝 | `ok`, `ms`, `tries`, `cached` | `{ok:true, ms:1400, tries:1, cached:false}` |
| `load_retry` | 첫 데이터 요청 실패 후 다시 받기 | `what`(pins·channels), `n` | `{what:"pins", n:2}` |
| `load_fail` | 끝내 못 받아 다시 불러오기 안내를 띄움 | `what` | `{what:"channels"}` |
| `load_retry_tap` | 안내의 다시 불러오기를 누름 | `what` | `{what:"pins"}` |
| `search_result` | 검색어로 거른 결과 | `q`(40자까지), `count` | `{q:"국밥", count:31}` |
| `search_select` | 검색 결과에서 고름 | `kind`(channel·region·restaurant·station), `id` | `{kind:"station", id:"강남역"}` |
| `filter_change` | 유튜버·지역 칩 | `type`, `value`, `count`(거른 뒤 가게 수) | `{type:"channel", value:"UC…", count:120}` |
| `list_click` | 목록에서 가게를 누름 | `id`, `rank`(1부터), `sort` | `{id:142, rank:2, sort:"near"}` |
| **`video_watch_click`** | 영상 장면 보러 유튜브로 | `id`, `where`(main·list), `rank`(list일 때) | `{id:142, where:"main"}` |
| `directions_click` | 네이버 지도 길찾기 | `id` | `{id:142}` |
| `share_attempt` | 공유 버튼 (토스·웹) | `kind`(place·list), `id`, `via`(웹: web 공유창·copy 링크 복사) | `{kind:"place", id:142}` |
| `share_success` | 공유 창이 끝까지 열림·링크 복사됨 (토스·웹) | `kind`, `id`, `via` | |
| `share_fail` | 공유 실패·닫음 (토스·웹) | `kind`, `id`, `via`, `msg` | |
| `like_toggle` | 찜 하트 | `id`, `on`(찜함·풂), `count`(찜한 가게 수) | `{id:142, on:true, count:3}` |
| `ad_request` | 배너 요청 (토스) | `kind`(strip·feed) | |
| `ad_shown` | 배너가 보임 (토스) | `kind` | |
| `ad_click` | 배너 누름 (토스) | `kind` | |
| `ad_fail` | 배너 없음·실패 (토스) | `kind`, `reason`(init·nofill·render·attach) | |
| `review_request` | 토스 리뷰 요청 (영상 보고 돌아왔을 때, 기기당 1번) | `supported`, `ok`, `msg` | `{supported:true, ok:true}` |
| `alert_on` | '새 맛집 알림' 켬 (토스, 동의창 통과 뒤) | `channel`, `agreed`(newAgreement·alreadyAgreed) | `{channel:"UC…", agreed:"newAgreement"}` |
| `alert_off` | 알림 끔 (토스) | `channel` | |
| `alert_rejected` | 토스 동의창에서 거절 | `channel` | |
| `alert_fail` | 알림 켜기·끄기 실패 (토스) | `channel`, `msg` | |
| `toss_open_click` | 웹의 '토스 앱으로 열기' | `where`(restaurant·list), `id` | `{where:"restaurant", id:142}` |
| `app_error` | 화면 오류 | `where`(page·window·promise·render), `msg`(100자까지) | |

토스 `log_type`: 화면 = `screen`, 누름 = `click`, 노출 = `impression`, 리뷰 = `popup`, 오류 = `error`, 나머지 = `event`.

## 들어온 곳 (`entry`)

순서대로 처음 맞는 값:

1. `utm_source` 값 그대로
2. `share` — 공유 링크(`pin`·`place`)
3. `web_list` — 웹 목록의 지도 보기(`from`)
4. `link` — 검색어·유튜버·지역이 붙은 링크(`q`·`yt`·`region`)
5. `direct`

## UTM 규칙

- `utm_source`: `instagram` · `threads` · `x` · `geeknews` · `clien` (웹에서 토스 앱으로 넘길 땐 `web`)
- `utm_medium`: `social`(SNS) · `community`(커뮤니티) · `referral`(웹 → 토스)
- `utm_campaign`: `mukmap_<YYYYMMDD>` (웹 → 토스는 `mukmap_open_toss`)
- 예: `https://mukmap.kr/?utm_source=threads&utm_medium=social&utm_campaign=mukmap_20261021`

## GA4 설정

- 속성: 먹맵 전용(다른 서비스와 섞지 않음).
- 주요 이벤트: `video_watch_click`.
- 맞춤 측정기준(이벤트 범위): `entry`, `screen`, `kind`, `where`, `rank`, `sort`, `what`, `reason`, `type`, `value`, `count`, `first`, `days_since_first`, `cached`, `ms`.
- 데이터 보존: 14개월.
- 내부 트래픽: 내 기기에서 `localStorage.setItem('mk_internal','1')` → `traffic_type=internal`로 나가고 GA 필터가 뺀다.
- 확인: 주소에 `?ga_debug=1`을 붙이면 DebugView에 뜬다.
