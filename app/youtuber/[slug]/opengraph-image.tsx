import { OG_SIZE, ogImage } from '@/lib/og'
import { decodeParam, getChannelBySlugOrId, restaurantsOf } from '@/lib/data'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = '유튜버 맛집'

export default async function Image({ params }: { params: { slug: string } }) {
  const ch = await getChannelBySlugOrId(decodeParam(params.slug))
  const n = ch ? (await restaurantsOf({ channelId: ch.id })).length : 0
  return ogImage({ line: `${ch?.name || '유튜버'} 맛집 ${n}곳`, sub: '영상에서 직접 찾아간 식당 지도' })
}
