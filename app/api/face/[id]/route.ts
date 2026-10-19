import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { faceSrc } from '@/lib/pins'

// 유튜버 프로필 사진을 우리 주소로 내려준다. 지도 핀마다 yt3.ggpht.com을 직접 부르면
// 요청이 몰릴 때 429(그림 대신 HTML)가 와서 브라우저가 막는다(ERR_BLOCKED_BY_ORB)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { data } = await supabase.from('channels').select('thumbnail_url').eq('id', params.id).maybeSingle()
  if (!data?.thumbnail_url) return new NextResponse(null, { status: 404 })

  const r = await fetch(faceSrc(data.thumbnail_url), { next: { revalidate: 604800 } })
  const type = r.headers.get('content-type') || ''
  if (!r.ok || !type.startsWith('image/')) return new NextResponse(null, { status: 502, headers: { 'Cache-Control': 'no-store' } })

  return new NextResponse(await r.arrayBuffer(), {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
    },
  })
}
