import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { runAlerts } from '@/lib/alerts'
import { runNearAlerts } from '@/lib/alerts-near'
import { mtlsReady } from '@/lib/toss-message'

export const dynamic = 'force-dynamic'
// GET 처리기 안의 Supabase 조회(fetch)를 Next가 캐시해 새로 켠 사람이 안 보였다. 매번 새로 읽는다
export const fetchCache = 'force-no-store'
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
  const db = createServiceClient()
  const { notified, ...result } = await runAlerts(db, { dry })
  // 근처 알림은 유튜버 알림 다음에. 오늘 유튜버 알림을 받은 사람은 건너뛴다(하루 한 통)
  const near = await runNearAlerts(db, { dry, skip: notified, now: result.now })
  console.log('[alerts]', JSON.stringify({ dry, sent: result.sent, failed: result.failed, plans: result.plans, near }))
  return NextResponse.json({ dry, ...result, near })
}
