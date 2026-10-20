// 외국어 목록 페이지의 가게 줄. 한국어 원래 이름은 가게 상세에만 둔다
export interface LangItem {
  href: string
  label: string
  name: string
  category: string | null
  area: string
  visitors: string
}

export default function LangList({ items }: { items: LangItem[] }) {
  return (
    <ul data-testid="lang-list" className="mt-2">
      {items.map((it) => (
        <li key={it.href} className="border-b border-line last:border-0">
          <a href={it.href} className="block py-3.5">
            <span className="block text-body font-bold text-ink">
              {it.label}
            </span>
            <span className="mt-0.5 block text-meta text-sub">{[it.category, it.area].filter(Boolean).join(' · ')}</span>
            <span className="mt-0.5 block text-meta text-sub">{it.visitors}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
