import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const sw_lat = params.get('sw_lat')
  const sw_lng = params.get('sw_lng')
  const ne_lat = params.get('ne_lat')
  const ne_lng = params.get('ne_lng')

  if (!sw_lat || !sw_lng || !ne_lat || !ne_lng) {
    return NextResponse.json(
      { error: 'sw_lat, sw_lng, ne_lat, ne_lng are required' },
      { status: 400 }
    )
  }

  const channel_ids = params.get('channel_ids')?.split(',').filter(Boolean)
  const region = params.get('region')
  const category = params.get('category')?.split(',').filter(Boolean)
  const limit = Math.min(Number(params.get('limit') || 200), 200)
  const include_hidden = params.get('include_hidden') === 'true'

  try {
    let query = supabase
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
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .gte('lat', Number(sw_lat))
      .lte('lat', Number(ne_lat))
      .gte('lng', Number(sw_lng))
      .lte('lng', Number(ne_lng))
      .limit(limit)

    if (!include_hidden) {
      query = query.eq('is_visible', true)
    }

    if (region) {
      query = query.eq('region', region)
    }
    if (category && category.length > 0) {
      query = query.in('category', category)
    }

    const { data: restaurants, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ restaurants: [], total: 0 })
    }

    // Filter by channel_ids if provided
    let filtered = restaurants || []
    if (channel_ids && channel_ids.length > 0) {
      filtered = filtered.filter((r) =>
        r.videos?.some((v: { channel_id: string }) => channel_ids.includes(v.channel_id))
      )
    }

    // Transform videos to include channel_name and channel_thumbnail
    const result = filtered.map((r) => {
      const videos = (r.videos || []).map((v: Record<string, unknown>) => {
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
      const { videos: _rawVideos, ...rest } = r
      return { ...rest, videos }
    })

    return NextResponse.json({ restaurants: result, total: result.length })
  } catch {
    return NextResponse.json({ restaurants: [], total: 0 })
  }
}
