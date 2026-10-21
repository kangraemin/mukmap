import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { runAlerts } from '@/lib/alerts'
import { mtlsReady } from '@/lib/toss-message'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Vercel 예약 실행(vercel.json crons)이 하루 한 번 부른다. Vercel은 CRON_SECRET을 Bearer로 붙여 보낸다.
// ?dry=1 이면 보낼 대상만 세고 보내지도 기록하지도 않는다
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = request.nextUrl.searchParams.get('dry') === '1'
  if (!dry && !mtlsReady()) return NextResponse.json({ error: 'mTLS 인증서 없음(TOSS_MTLS_CERT/KEY)' }, { status: 503 })
  const result = await runAlerts(createServiceClient(), { dry })
  console.log('[alerts]', JSON.stringify({ dry, sent: result.sent, failed: result.failed, plans: result.plans }))
  return NextResponse.json({ dry, ...result })
}
