// 서버(lib/alerts)와 토스 앱(toss/src/AlertButton)이 같이 쓰는 값. 여기엔 서버 전용 코드를 넣지 않는다

// 콘솔 스마트 발송 '기능성' 탭의 발송 코드. 동의창(Notification.requestAgreement)도 같은 코드를 쓴다
export const ALERT_TEMPLATE = 'mukmap-kr-new-place'
// 익명 키 해시 모양만 받는다(아무 글이나 쌓이지 않게)
export const ANON_KEY = /^[A-Za-z0-9+/=_-]{16,256}$/

// '찜한 곳 근처 새 맛집 알림'. 유튜버 알림과 종류가 달라 발송 코드도 따로 둔다
export const NEAR_TEMPLATE = 'mukmap-kr-near-place'
// 찜한 가게에서 이 거리(km) 안에 새로 생긴 가게만 알린다. 역 페이지와 같은 1km
export const NEAR_KM = 1
// 한 사람에게 근처 알림은 며칠에 한 번까지만 보낸다
export const NEAR_EVERY_DAYS = 3
// 서버에 맡기는 찜 개수 상한
export const NEAR_MAX_IDS = 200
// 동의창을 거절하면 이만큼 지난 뒤에야 다시 묻는다
export const NEAR_ASK_AGAIN_DAYS = 30
