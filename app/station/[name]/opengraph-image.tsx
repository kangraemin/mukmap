import { OG_SIZE, ogImage } from '@/lib/og'
import { decodeParam, getAll } from '@/lib/data'
import { nearStation, stationBySlug } from '@/lib/stations'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = '역 근처 유튜버 맛집'

export default async function Image({ params }: { params: { name: string } }) {
  const station = stationBySlug(decodeParam(params.name))
  const n = station ? nearStation(station, (await getAll()).restaurants).length : 0
  return ogImage({ line: `${station?.name ?? ''}역 맛집 ${n}곳`, sub: '먹방 유튜버가 다녀간 식당 지도' })
}
