import { OG_SIZE, ogImage } from '@/lib/og'
import { isLang, type Lang } from '@/lib/i18n'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'MukMap'

// 외국어 페이지 공유 미리보기. 한국어판(app/opengraph-image)과 같은 자막 띠에 그 언어 글자만 넣는다
const TEXT: Record<Lang, { line: string; sub: string; brand: string; cjk?: string }> = {
  en: { line: 'Where Korean YouTubers ate', sub: "Food map of Korea's top food YouTubers", brand: 'MukMap' },
  ja: { line: '韓国YouTuberが食べた店', sub: '韓国グルメYouTuberのお店マップ', brand: 'モクマップ', cjk: 'Noto+Sans+JP' },
  'zh-cn': { line: '韩国YouTuber吃过的店', sub: '韩国美食YouTuber探店地图', brand: 'MukMap', cjk: 'Noto+Sans+SC' },
  'zh-tw': { line: '韓國YouTuber吃過的店', sub: '韓國美食YouTuber探店地圖', brand: 'MukMap', cjk: 'Noto+Sans+TC' },
}

export default function Image({ params }: { params: { lang: string } }) {
  return ogImage(TEXT[isLang(params.lang) ? params.lang : 'en'])
}
