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
  return NextResponse.json({ restaurants: data || [] })
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
