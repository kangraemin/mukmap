// 서버(lib/alerts)와 토스 앱(toss/src/AlertButton)이 같이 쓰는 값. 여기엔 서버 전용 코드를 넣지 않는다

// 콘솔 스마트 발송 '기능성' 탭의 발송 코드. 동의창(Notification.requestAgreement)도 같은 코드를 쓴다
export const ALERT_TEMPLATE = 'mukmap-kr-new-place'
// 익명 키 해시 모양만 받는다(아무 글이나 쌓이지 않게)
export const ANON_KEY = /^[A-Za-z0-9+/=_-]{16,256}$/
