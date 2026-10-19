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
          view_count,
          menu,
          price,
          quote,
          why,
          detail,
          channels (
            name,
            thumbnail_url,
            slug
          )
        )
      `)
      .eq('id', id)
      .eq('is_visible', true)
      .single()

    if (error || !restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    const videos = (restaurant.videos || []).map((v: Record<string, unknown>) => {
      const channel = v.channels as { name: string; thumbnail_url: string | null; slug: string | null } | null
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
        view_count: v.view_count as number | null,
        menu: v.menu,
        price: v.price,
        quote: v.quote,
        why: v.why,
        detail: v.detail || null,
        channel_name: channel?.name || '',
        channel_thumbnail: channel?.thumbnail_url || null,
        channel_slug: channel?.slug || null,
      }
    })

    videos.sort((a: { published_at: string | null }, b: { published_at: string | null }) =>
      (b.published_at || '').localeCompare(a.published_at || ''))
    const { videos: _rawVideos, ...rest } = restaurant
    return NextResponse.json(
      { ...rest, videos },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    )
  } catch {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }
}
