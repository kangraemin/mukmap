import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

function checkAuth(request: NextRequest): boolean {
  const password = request.headers.get('x-admin-password')
  return password === process.env.ADMIN_PASSWORD
}

// 관리자 목록: 숨김 포함, 검수 대기만(review=1) 또는 전체. 공개 API의 200개 상한을 피해 1000개까지 준다
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const review = request.nextUrl.searchParams.get('review') === '1'
  const supabase = createServiceClient()
  let query = supabase
    .from('restaurants')
    .select('*, videos (id, video_id, channel_id, title, thumbnail_url, rating, summary, is_ad, timestamp_seconds, published_at, menu, price, quote, why, channels (name, thumbnail_url, slug))')
    .order('id', { ascending: false })
    .limit(1000)
  if (review) query = query.eq('needs_review', true)
  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!review || !data?.length) return NextResponse.json({ restaurants: data || [] })

  // 검수용: 영상에서 실제로 말한 가게 이름·지역 힌트를 붙인다(추출 결과 중 지금 이름과 가장 닮은 항목)
  const vids = Array.from(new Set(data.flatMap((r) => (r.videos || []).map((v: { video_id: string }) => v.video_id))))
  const extracted = new Map<string, Said[]>()
  for (let i = 0; i < vids.length; i += 100) {
    const { data: q } = await supabase
      .from('processing_queue')
      .select('video_id, extraction_result')
      .in('video_id', vids.slice(i, i + 100))
    for (const row of q || []) {
      const er = row.extraction_result
      extracted.set(row.video_id, Array.isArray(er) ? er : er?.restaurants || [])
    }
  }
  const restaurants = data.map((r) => {
    let said: Said | null = null
    let best = -1
    for (const v of r.videos || []) {
      for (const e of extracted.get(v.video_id) || []) {
        const s = nameSim(e.name || '', r.name)
        if (s > best) { best = s; said = { name: e.name, address_hint: e.address_hint, video_id: v.video_id, timestamp_seconds: e.timestamp_seconds } }
      }
    }
    return { ...r, said }
  })
  return NextResponse.json({ restaurants })
}

type Said = { name: string; address_hint?: string; video_id?: string; timestamp_seconds?: number | null }

function nameSim(a: string, b: string): number {
  const x = a.replace(/\s/g, ''), y = b.replace(/\s/g, '')
  if (!x || !y) return 0
  if (x.includes(y) || y.includes(x)) return 1
  const grams = (s: string) => new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)))
  const X = grams(x), Y = grams(y)
  let n = 0
  X.forEach((g) => { if (Y.has(g)) n++ })
  return n / Math.max(1, Math.min(X.size, Y.size))
}

export async function PATCH(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const allowedFields = ['name', 'address', 'lat', 'lng', 'category', 'region', 'naver_place_id', 'needs_review', 'is_visible']
  const filtered: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in updates) {
      filtered[key] = updates[key]
    }
  }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('restaurants')
      .update(filtered)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await request.json()
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()

    // Delete related videos first
    await supabase.from('videos').delete().eq('restaurant_id', id)

    const { error } = await supabase.from('restaurants').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
