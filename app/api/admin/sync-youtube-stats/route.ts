import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'no api key' }, { status: 500 })

  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, video_id')

  if (error || !videos?.length) return NextResponse.json({ updated: 0 })

  const BATCH = 50
  let updated = 0
  for (let i = 0; i < videos.length; i += BATCH) {
    const batch = videos.slice(i, i + BATCH)
    const ids = batch.map((v: { id: string; video_id: string }) => v.video_id).join(',')
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${apiKey}`
    )
    const data = await res.json() as { items?: { id: string; statistics?: { viewCount?: string } }[] }
    const statsMap: Record<string, number> = {}
    for (const item of data.items ?? []) {
      statsMap[item.id] = Number(item.statistics?.viewCount ?? 0)
    }
    for (const v of batch) {
      if (statsMap[v.video_id] !== undefined) {
        await supabase
          .from('videos')
          .update({ view_count: statsMap[v.video_id] })
          .eq('id', v.id)
        updated++
      }
    }
  }
  return NextResponse.json({ updated })
}
