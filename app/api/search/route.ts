import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { REGIONS } from '@/lib/constants'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: '검색어는 2글자 이상이어야 합니다' },
      { status: 400 }
    )
  }

  // Sanitize: remove special chars
  const sanitized = q.replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ]/g, '')
  if (sanitized.length < 2) {
    return NextResponse.json({ restaurants: [], channels: [], regions: [] })
  }

  try {
    const [restaurantRes, channelRes] = await Promise.all([
      supabase
        .from('restaurants')
        .select('id, name, address, category')
        .or(`name.ilike.%${sanitized}%,address.ilike.%${sanitized}%`)
        .limit(5),
      supabase
        .from('channels')
        .select('id, name, thumbnail_url')
        .ilike('name', `%${sanitized}%`)
        .limit(3),
    ])

    const restaurants = restaurantRes.data || []
    const channels = channelRes.data || []
    const regions = REGIONS.filter((r) => r.includes(sanitized))

    return NextResponse.json({ restaurants, channels, regions })
  } catch {
    return NextResponse.json({ restaurants: [], channels: [], regions: [] })
  }
}
