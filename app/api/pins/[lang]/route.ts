import { NextResponse } from 'next/server'
import { buildPins, PINS_CACHE } from '@/lib/pins-build'
import { LANGS, isLang } from '@/lib/i18n'

// 외국어 지도(/en 등) 핀. 한국어판과 같은 모양에 이름·분류·메뉴·평만 그 언어로 바꿨다
export const revalidate = 86400
export const dynamicParams = false
export const generateStaticParams = () => LANGS.map((lang) => ({ lang }))

export async function GET(_: Request, { params }: { params: { lang: string } }) {
  if (!isLang(params.lang)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const payload = await buildPins(params.lang)
  if (!payload) return NextResponse.json({ error: 'pins unavailable' }, { status: 500 })
  return NextResponse.json(payload, { headers: PINS_CACHE })
}
