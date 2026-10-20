// 목록·가게 페이지 위쪽. 사이트 이름과 지금 위치(빵부스러기)를 보여준다.
export interface Crumb {
  name: string
  path: string
}

export default function SiteHeader({ crumbs, mapHref = '/', home = { href: '/', name: '먹맵' }, mapLabel = '지도 보기', navLabel = '현재 위치' }: {
  crumbs: Crumb[]
  mapHref?: string
  /** 외국어 페이지는 그 언어 첫 화면과 이름을 넘긴다 */
  home?: { href: string; name: string }
  mapLabel?: string
  navLabel?: string
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <a href={home.href} className="flex-shrink-0 font-caption text-lead text-ink">{home.name}</a>
        <nav aria-label={navLabel} className="min-w-0 flex-1">
          <ol className="no-scrollbar flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-meta text-sub">
            {crumbs.map((c, i) => (
              <li key={c.path} className="flex items-center gap-1.5">
                <span aria-hidden="true">/</span>
                {i === crumbs.length - 1
                  ? <span aria-current="page" className="text-ink">{c.name}</span>
                  : <a href={c.path} className="underline-offset-2 hover:underline">{c.name}</a>}
              </li>
            ))}
          </ol>
        </nav>
        <a href={mapHref} className="inline-flex min-h-[44px] flex-shrink-0 items-center text-meta font-bold text-ink">{mapLabel}</a>
      </div>
    </header>
  )
}
