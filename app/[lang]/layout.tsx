import { notFound } from 'next/navigation'
import { HREFLANG, LANGS, isLang } from '@/lib/i18n'

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }))
}

// html은 루트 레이아웃(한국어) 하나라 lang 값만 그 언어로 바꾼다. 응답 헤더 Content-Language는 middleware가 붙인다
export default function LangLayout({ children, params }: { children: React.ReactNode; params: { lang: string } }) {
  if (!isLang(params.lang)) notFound()
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(HREFLANG[params.lang])}` }} />
      {children}
    </>
  )
}
