import { NextRequest, NextResponse } from 'next/server'

// 토스 미니앱이 읽기 API를 부를 수 있게 연다. 실제 토스 앱(3.x 테스트)은 <app>.private-apps.tossmini.com에서 연다(2026-10-19 원격 로그로 확인).
const TOSS_ORIGIN = /^https:\/\/[a-z0-9-]+\.(private-)?(web|apps)\.tossmini\.com$/

const CONTENT_LANGUAGE: Record<string, string> = { en: 'en', ja: 'ja', 'zh-cn': 'zh-Hans', 'zh-tw': 'zh-Hant' }

export function middleware(request: NextRequest) {
  // 외국어 페이지: html은 루트(한국어) 하나라 크롤러가 읽는 언어를 응답 헤더로 알린다
  const lang = request.nextUrl.pathname.split('/')[1]
  if (CONTENT_LANGUAGE[lang]) {
    const res = NextResponse.next()
    res.headers.set('Content-Language', CONTENT_LANGUAGE[lang])
    return res
  }
  const origin = request.headers.get('origin') || ''
  if (!TOSS_ORIGIN.test(origin)) return NextResponse.next()

  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (request.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers })

  const res = NextResponse.next()
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
  return res
}

export const config = {
  matcher: ['/en/:path*', '/ja/:path*', '/zh-cn/:path*', '/zh-tw/:path*', '/en', '/ja', '/zh-cn', '/zh-tw', '/api/pins', '/api/restaurants/:path*', '/api/channels', '/api/search', '/api/client-log'],
}
