import { OG_SIZE, ogImage } from '@/lib/og'
import { decodeParam, restaurantsOf } from '@/lib/data'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = '지역 유튜버 맛집'

export default async function Image({ params }: { params: { region: string } }) {
  const region = decodeParam(params.region)
  const n = (await restaurantsOf({ region })).length
  return ogImage({ line: `${region} 유튜버 맛집 ${n}곳`, sub: '먹방 유튜버가 다녀간 식당 지도' })
}
