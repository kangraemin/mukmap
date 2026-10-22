// '찜한 곳 근처 새 맛집 알림': 찜한 가게에서 1km 안에 새 가게가 올라오면 알린다. 한 사람에게 며칠에 한 번까지만.
// 사람 위치는 쓰지 않는다. 찜한 가게의 위치만 쓴다
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendBulk, type BulkItem } from '@/lib/toss-message'
import { NEAR_EVERY_DAYS, NEAR_KM, NEAR_TEMPLATE } from '@/lib/alerts-shared'
import { km } from '@/lib/stations'
import { all } from '@/lib/alerts'

interface Place { id: number; name: string; lat: number; lng: number; created_at: string }

export interface NearPlan {
  people: number
  waiting: number
  skipped: number
  toSend: number
}

/** 찜한 곳마다 그 근처(1km)에 since 뒤로 새로 생긴 가게. 찜한 가게 자신은 빼고, 가장 많이 걸린 찜 가게 이름을 같이 준다 */
export function nearNew(liked: Place[], fresh: Place[], since: string) {
  const mine = new Set(liked.map((p) => p.id))
  const hits = new Map<number, string>()
  const byLiked = new Map<string, number>()
  for (const f of fresh) {
    if (f.created_at <= since || mine.has(f.id) || hits.has(f.id)) continue
    const near = liked.find((l) => km(l.lat, l.lng, f.lat, f.lng) <= NEAR_KM)
    if (!near) continue
    hits.set(f.id, near.name)
    byLiked.set(near.name, (byLiked.get(near.name) ?? 0) + 1)
  }
  const top = Array.from(byLiked).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  return { count: hits.size, place: top }
}

export async function runNearAlerts(db: SupabaseClient, { dry, skip = new Set<string>(), now = new Date().toISOString() }: { dry: boolean; skip?: Set<string>; now?: string }) {
  const states = await all<{ anon_key: string; checked_at: string; sent_at: string | null }>((a, b) =>
    db.from('alert_near_state').select('anon_key, checked_at, sent_at').order('anon_key').range(a, b))
  const plan: NearPlan = { people: states.length, waiting: 0, skipped: 0, toSend: 0 }
  const empty = { now, plan, sent: 0, failed: [] as unknown[] }
  if (!states.length) return empty

  // 마지막으로 보낸 지 며칠이 안 지났거나 오늘 유튜버 알림을 받은 사람은 다음으로 미룬다(확인 시각도 그대로 둬서 쌓인다)
  const gap = NEAR_EVERY_DAYS * 86400_000 - 3600_000
  const due = states.filter((s) => {
    if (s.sent_at && Date.parse(now) - Date.parse(s.sent_at) < gap) { plan.waiting++; return false }
    if (skip.has(s.anon_key)) { plan.skipped++; return false }
    return true
  })
  if (!due.length) return empty

  const likes = await all<{ anon_key: string; restaurant_id: number }>((a, b) =>
    db.from('alert_near').select('anon_key, restaurant_id').in('anon_key', due.map((s) => s.anon_key)).order('anon_key').range(a, b))
  const ids = Array.from(new Set(likes.map((l) => l.restaurant_id)))
  const places = new Map<number, Place>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('restaurants').select('id, name, lat, lng, created_at').in('id', ids.slice(i, i + 200))
      .not('lat', 'is', null).not('lng', 'is', null)
    if (error) throw new Error(error.message)
    for (const p of (data ?? []) as Place[]) places.set(p.id, p)
  }
  const since = due.map((s) => s.checked_at).sort()[0]
  const fresh = await all<Place>((a, b) =>
    db.from('restaurants').select('id, name, lat, lng, created_at').eq('is_visible', true).gt('created_at', since)
      .not('lat', 'is', null).not('lng', 'is', null).order('id').range(a, b))

  const items: BulkItem[] = []
  const quiet: string[] = []
  for (const s of due) {
    const liked = likes.filter((l) => l.anon_key === s.anon_key).map((l) => places.get(l.restaurant_id)).filter((p): p is Place => !!p)
    const { count, place } = nearNew(liked, fresh, s.checked_at)
    if (count > 0 && place) items.push({ anonKey: s.anon_key, context: { place, count: String(count) } })
    else quiet.push(s.anon_key)
  }
  plan.toSend = items.length
  if (dry) return { ...empty, plan }

  let sent = 0
  const failed: unknown[] = []
  if (items.length) {
    const res = await sendBulk(NEAR_TEMPLATE, items)
    const bad = res.filter((r) => !r.ok)
    if (bad.length) {
      // 못 보낸 사람은 확인 시각을 그대로 둬서 다음 날 다시 보낸다
      failed.push({ results: bad.map((r) => ({ status: r.status, body: r.body })) })
    } else {
      sent = items.length
      const { error } = await db.from('alert_near_state').upsert(items.map((it) => ({ anon_key: it.anonKey, checked_at: now, sent_at: now })))
      if (error) throw new Error(error.message)
    }
  }
  if (quiet.length) {
    const { error } = await db.from('alert_near_state').update({ checked_at: now }).in('anon_key', quiet)
    if (error) throw new Error(error.message)
  }
  return { now, plan, sent, failed }
}
