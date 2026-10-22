import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { ANON_KEY, NEAR_MAX_IDS } from '@/lib/alerts-shared'

export const dynamic = 'force-dynamic'

// 토스 앱 '찜한 곳 근처 새 맛집 알림'. 동의창에서 동의한 뒤에만 부른다.
// { anonKey } → 켜져 있는지, { anonKey, on: true, ids } → 켜고 찜 목록을 통째로 바꾼다, { anonKey, on: false } → 끄고 지운다
export async function POST(request: NextRequest) {
  let body: { anonKey?: unknown; on?: unknown; ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  const { anonKey, on, ids } = body
  if (typeof anonKey !== 'string' || !ANON_KEY.test(anonKey)) return NextResponse.json({ error: 'bad anonKey' }, { status: 400 })
  const db = createServiceClient()

  if (on === undefined) {
    const { data, error } = await db.from('alert_near_state').select('anon_key').eq('anon_key', anonKey).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ on: !!data })
  }
  if (typeof on !== 'boolean') return NextResponse.json({ error: 'bad on' }, { status: 400 })

  if (!on) {
    const r1 = await db.from('alert_near').delete().eq('anon_key', anonKey)
    const r2 = await db.from('alert_near_state').delete().eq('anon_key', anonKey)
    const error = r1.error || r2.error
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ on: false, count: 0 })
  }

  if (!Array.isArray(ids) || ids.length > NEAR_MAX_IDS || !ids.every((x) => Number.isInteger(x) && x > 0)) {
    return NextResponse.json({ error: 'bad ids' }, { status: 400 })
  }
  // 없는 가게 id는 버린다
  const want = Array.from(new Set(ids as number[]))
  const { data: found, error: e0 } = want.length
    ? await db.from('restaurants').select('id').in('id', want)
    : { data: [] as { id: number }[], error: null }
  if (e0) return NextResponse.json({ error: e0.message }, { status: 500 })
  const keep = (found ?? []).map((r) => r.id as number)

  // 처음 켤 때만 확인 시각을 지금으로 둔다. 다시 맞출 때는 그대로 둬서 그 사이 새 가게를 놓치지 않는다
  const { error: e1 } = await db.from('alert_near_state').upsert({ anon_key: anonKey }, { ignoreDuplicates: true })
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  const del = db.from('alert_near').delete().eq('anon_key', anonKey)
  const { error: e2 } = keep.length ? await del.not('restaurant_id', 'in', `(${keep.join(',')})`) : await del
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  if (keep.length) {
    const { error: e3 } = await db.from('alert_near').upsert(keep.map((id) => ({ anon_key: anonKey, restaurant_id: id })), { ignoreDuplicates: true })
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })
  }
  return NextResponse.json({ on: true, count: keep.length })
}
