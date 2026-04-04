import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: channels, error } = await supabase
      .from('channels')
      .select(`
        *,
        videos (
          id,
          restaurant_id,
          restaurants!inner (
            is_visible
          )
        )
      `)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ channels: [] })
    }

    const result = (channels || [])
      .map((ch) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const visibleVideos = (ch.videos || []).filter((v: any) => v.restaurants?.is_visible === true)
        const restaurantIds = new Set(
          visibleVideos
            .map((v: { restaurant_id: number | null }) => v.restaurant_id)
            .filter(Boolean)
        )
        const { videos: _videos, ...rest } = ch
        return { ...rest, restaurant_count: restaurantIds.size }
      })
      .filter((ch) => ch.restaurant_count > 0)
      .sort((a, b) => b.restaurant_count - a.restaurant_count)

    return NextResponse.json({ channels: result })
  } catch {
    return NextResponse.json({ channels: [] })
  }
}
