import { OG_SIZE, ogImage } from '@/lib/og'
import { decodeParam, getChannelBySlugOrId, restaurantsOf } from '@/lib/data'
import { RECENT_DAYS, recentOf } from '@/lib/related'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = '유튜버 최근 맛집'

export default async function Image({ params }: { params: { slug: string } }) {
  const ch = await getChannelBySlugOrId(decodeParam(params.slug))
  const n = ch ? recentOf(await restaurantsOf({ channelId: ch.id }), ch.id).length : 0
  return ogImage({ line: `${ch?.name || '유튜버'} 최근 맛집 ${n}곳`, sub: `최근 ${RECENT_DAYS}일 새 영상에 나온 식당` })
}
