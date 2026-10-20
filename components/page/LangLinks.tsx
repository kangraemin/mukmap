// 같은 페이지의 다른 언어판 링크. 없는 언어는 빼고 그린다
import { LANG_NAME, LANGS } from '@/lib/i18n'

export default function LangLinks({ paths, current, label = '언어' }: { paths: Partial<Record<string, string>>; current: string; label?: string }) {
  const keys = (['ko', ...LANGS] as string[]).filter((k) => paths[k])
  if (keys.length < 2) return null
  return (
    <nav aria-label={label} data-testid="lang-links" className="mx-auto max-w-2xl px-4 pb-[calc(32px+env(safe-area-inset-bottom))] pt-4 sm:px-0">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-meta text-sub">
        {keys.map((k) => (
          <li key={k}>
            {k === current
              ? <span aria-current="page" className="font-bold text-ink">{LANG_NAME[k as keyof typeof LANG_NAME]}</span>
              : <a href={paths[k]} hrefLang={k} className="underline-offset-2 hover:underline">{LANG_NAME[k as keyof typeof LANG_NAME]}</a>}
          </li>
        ))}
      </ul>
    </nav>
  )
}
