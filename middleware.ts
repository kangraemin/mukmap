import { NextRequest, NextResponse } from 'next/server'

// 토스 미니앱(<app>.web.tossmini.com, <app>.private-web.tossmini.com)이 읽기 API를 부를 수 있게 연다.
const TOSS_ORIGIN = /^https:\/\/[a-z0-9-]+\.(private-)?web\.tossmini\.com$/

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  if (!TOSS_ORIGIN.test(origin)) return NextResponse.next()

  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  matcher: ['/api/restaurants/:path*', '/api/channels', '/api/search'],
}
