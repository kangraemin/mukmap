import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { ANON_KEY } from '@/lib/alerts-shared'

export const dynamic = 'force-dynamic'

// 토스 앱 '새 맛집 알림'. 동의창에서 동의한 뒤에만 부른다.
// { anonKey } → 켜 둔 유튜버 목록, { anonKey, channelId, on } → 켜기·끄기
export async function POST(request: NextRequest) {
  let body: { anonKey?: unknown; channelId?: unknown; on?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  const { anonKey, channelId, on } = body
  if (typeof anonKey !== 'string' || !ANON_KEY.test(anonKey)) return NextResponse.json({ error: 'bad anonKey' }, { status: 400 })
  const db = createServiceClient()

  if (channelId === undefined) {
    const { data, error } = await db.from('alert_subs').select('channel_id').eq('anon_key', anonKey)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ channels: (data ?? []).map((r) => r.channel_id) })
  }
  if (typeof channelId !== 'string' || typeof on !== 'boolean') return NextResponse.json({ error: 'bad channelId/on' }, { status: 400 })

  if (on) {
    const { data: ch } = await db.from('channels').select('id').eq('id', channelId).maybeSingle()
    if (!ch) return NextResponse.json({ error: 'unknown channel' }, { status: 404 })
    const { error } = await db.from('alert_subs').upsert({ anon_key: anonKey, channel_id: channelId }, { ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await db.from('alert_subs').delete().eq('anon_key', anonKey).eq('channel_id', channelId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ channelId, on })
}
