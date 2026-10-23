import { OG_SIZE, ogImage } from '@/lib/og'
import { getAll } from '@/lib/data'
import { newThisWeek } from '@/lib/related'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = '이번 주 새로 뜬 맛집'

export default async function Image() {
  const n = newThisWeek((await getAll()).restaurants, Date.now(), 60).length
  return ogImage({ line: `이번 주 새로 뜬 맛집 ${n}곳`, sub: '최근 7일 유튜버 새 영상에 나온 식당' })
}
