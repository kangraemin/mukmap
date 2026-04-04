import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select(`
        *,
        videos (
          id,
          video_id,
          channel_id,
          title,
          thumbnail_url,
          rating,
          summary,
          is_ad,
          timestamp_seconds,
          published_at,
          channels (
            name,
            thumbnail_url
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error || !restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    const videos = (restaurant.videos || []).map((v: Record<string, unknown>) => {
      const channel = v.channels as { name: string; thumbnail_url: string | null } | null
      return {
        id: v.id,
        video_id: v.video_id,
        channel_id: v.channel_id,
        title: v.title,
        thumbnail_url: v.thumbnail_url,
        rating: v.rating,
        summary: v.summary,
        is_ad: v.is_ad,
        timestamp_seconds: v.timestamp_seconds,
        published_at: v.published_at,
        channel_name: channel?.name || '',
        channel_thumbnail: channel?.thumbnail_url || null,
      }
    })

    const { videos: _rawVideos, ...rest } = restaurant
    return NextResponse.json({ ...rest, videos })
  } catch {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }
}
