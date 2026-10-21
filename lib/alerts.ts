// '유튜버 새 맛집 알림': 알림을 켠 사람에게, 그 유튜버가 다녀간 가게가 새로 올라오면 하루 한 번 알린다.
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendBulk, type BulkItem } from '@/lib/toss-message'
import { ALERT_TEMPLATE } from '@/lib/alerts-shared'

export interface ChannelPlan {
  channelId: string
  name: string
  since: string
  places: number
  subscribers: number
}

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) return rows
  }
}

// since 뒤에 처음 생긴 '이 유튜버의 보이는 가게' 수. 예전에 이미 다녀간 가게에 영상이 하나 더 붙은 건 세지 않는다
async function newPlaces(db: SupabaseClient, channelId: string, since: string) {
  const fresh = await all<{ restaurant_id: number }>((a, b) =>
    db.from('videos').select('restaurant_id, restaurants!inner(is_visible)')
      .eq('channel_id', channelId).gt('created_at', since).eq('restaurants.is_visible', true).range(a, b))
  const ids = Array.from(new Set(fresh.map((v) => v.restaurant_id)))
  if (!ids.length) return 0
  const old = new Set<number>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('videos').select('restaurant_id')
      .eq('channel_id', channelId).lte('created_at', since).in('restaurant_id', ids.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const v of data ?? []) old.add(v.restaurant_id)
  }
  return ids.filter((id) => !old.has(id)).length
}

export async function runAlerts(db: SupabaseClient, { dry }: { dry: boolean }) {
  const now = new Date().toISOString()
  const subs = await all<{ anon_key: string; channel_id: string; created_at: string }>((a, b) =>
    db.from('alert_subs').select('anon_key, channel_id, created_at').order('created_at').range(a, b))
  const byChannel = new Map<string, typeof subs>()
  for (const s of subs) byChannel.set(s.channel_id, [...(byChannel.get(s.channel_id) ?? []), s])
  if (!byChannel.size) return { now, plans: [] as ChannelPlan[], sent: 0, failed: [] as unknown[] }

  const ids = Array.from(byChannel.keys())
  const [{ data: states, error: e1 }, { data: chs, error: e2 }] = await Promise.all([
    db.from('alert_state').select('channel_id, checked_at').in('channel_id', ids),
    db.from('channels').select('id, name').in('id', ids),
  ])
  if (e1 || e2) throw new Error((e1 || e2)!.message)
  const checked = new Map((states ?? []).map((s) => [s.channel_id, s.checked_at as string]))
  const names = new Map((chs ?? []).map((c) => [c.id, c.name as string]))

  const plans: ChannelPlan[] = []
  let sent = 0
  const failed: unknown[] = []
  for (const [channelId, list] of Array.from(byChannel)) {
    // 처음 확인하는 유튜버는 가장 먼저 알림을 켠 때부터 센다
    const since = checked.get(channelId) ?? list[0].created_at
    const places = await newPlaces(db, channelId, since)
    const name = names.get(channelId) ?? ''
    plans.push({ channelId, name, since, places, subscribers: list.length })
    if (dry) continue
    if (places > 0 && name) {
      const items: BulkItem[] = list.map((s) => ({ anonKey: s.anon_key, context: { channel: name, count: String(places) } }))
      const res = await sendBulk(ALERT_TEMPLATE, items)
      const bad = res.filter((r) => !r.ok)
      if (bad.length) {
        // 못 보낸 유튜버는 확인 시각을 그대로 둬서 다음 날 다시 보낸다
        failed.push({ channelId, results: bad.map((r) => ({ status: r.status, body: r.body })) })
        continue
      }
      sent += items.length
    }
    const { error } = await db.from('alert_state').upsert({ channel_id: channelId, checked_at: now })
    if (error) throw new Error(error.message)
  }
  return { now, plans, sent, failed }
}
