// 앱인토스 기능성 메시지(스마트 발송) 서버 API. 서버 간 호출은 콘솔에서 받은 mTLS 인증서로 한다.
// 문서: https://developers-apps-in-toss.toss.im/smart-message/develop.html
import https from 'node:https'

const HOST = 'apps-in-toss-api.toss.im'
const BULK_PATH = '/api-partner/v1/apps-in-toss/messenger/send-bulk-message'
// 한 요청에 2,500명까지
export const BULK_MAX = 2500

export interface BulkItem {
  anonKey: string
  context: Record<string, string>
}

export interface SendResult {
  ok: boolean
  status: number
  body: unknown
}

// 인증서와 키는 PEM 그대로 환경변수에 둔다(코드 저장소에 넣지 않는다)
export function mtlsReady() {
  return !!(process.env.TOSS_MTLS_CERT && process.env.TOSS_MTLS_KEY)
}

function post(path: string, payload: unknown): Promise<SendResult> {
  const data = JSON.stringify(payload)
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: HOST,
        path,
        method: 'POST',
        cert: process.env.TOSS_MTLS_CERT,
        key: process.env.TOSS_MTLS_KEY,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout: 20_000,
      },
      (res) => {
        let text = ''
        res.on('data', (c) => (text += c))
        res.on('end', () => {
          let body: unknown = text
          try { body = JSON.parse(text) } catch { /* 글 그대로 */ }
          // HTTP 200이어도 resultType이 FAIL일 수 있다
          const ok = res.statusCode === 200 && (body as { resultType?: string })?.resultType === 'SUCCESS'
          resolve({ ok, status: res.statusCode ?? 0, body })
        })
      },
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end(data)
  })
}

export async function sendBulk(templateSetCode: string, items: BulkItem[]): Promise<SendResult[]> {
  const out: SendResult[] = []
  for (let i = 0; i < items.length; i += BULK_MAX) {
    out.push(await post(BULK_PATH, { templateSetCode, contextList: items.slice(i, i + BULK_MAX) }))
  }
  return out
}
