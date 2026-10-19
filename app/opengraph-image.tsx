import { OG_SIZE, ogImage } from '@/lib/og'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = '먹맵 유튜버 맛집 지도'

export default function Image() {
  return ogImage({ line: '유튜버가 실제로 가서 먹은 집', sub: '쯔양·히밥·성시경·츄릅켠 맛집 지도' })
}
