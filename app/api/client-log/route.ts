import { NextRequest, NextResponse } from 'next/server'

// 토스 미니앱 웹뷰는 개발자 도구를 열 수 없어서 오류·진행 단계를 여기로 보내 Vercel 로그에 남긴다.
export async function POST(request: NextRequest) {
  const body = (await request.text()).slice(0, 4000)
  console.log('[client-log]', body)
  return new NextResponse(null, { status: 204 })
}
