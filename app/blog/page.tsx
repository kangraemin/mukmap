import type { Metadata } from 'next'
import SiteHeader from '@/components/page/SiteHeader'
import { dayLabel, getPosts } from '@/lib/blog'
import { breadcrumbJsonLd, jsonLdScript, pageMetadata } from '@/lib/seo'

// 먹맵 데이터로 쓴 글 목록. 글은 content/blog/*.md
export const revalidate = 3600

const PATH = '/blog'

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: '먹맵 블로그 — 유튜버 맛집 데이터로 본 이야기 | 먹맵',
    description: '먹방 유튜버들이 다녀간 식당 데이터를 모아 보니 보이는 것들. 여러 유튜버가 따로 찾아간 집, 지역별 많이 간 곳, 메뉴와 가격 이야기를 씁니다.',
    path: PATH,
    index: getPosts().length > 0,
  })
}

export default function BlogIndex() {
  const posts = getPosts()
  return (
    <>
      <SiteHeader crumbs={[{ name: '블로그', path: PATH }]} />
      <main className="mx-auto max-w-3xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-6">
        <h1 className="text-display font-bold text-ink">먹맵 블로그</h1>
        <p className="mt-2 text-body text-sub">유튜버들이 다녀간 식당 데이터를 모아 보니 보이는 것들을 씁니다.</p>
        <ul className="mt-6">
          {posts.map((p) => (
            <li key={p.slug}>
              <a href={`/blog/${p.slug}`} className="block border-b border-line py-4">
                <span className="block text-title font-bold text-ink">{p.title}</span>
                <span className="mt-1 block text-body text-sub">{p.description}</span>
                <span className="mt-1 block text-meta text-sub">{dayLabel(p.date)}</span>
              </a>
            </li>
          ))}
        </ul>
        {!posts.length && <p className="mt-6 text-body text-sub">아직 글이 없습니다. 그동안 <a href="/this-week" className="text-ink underline">이번 주 새로 뜬 맛집</a>을 보세요.</p>}
      </main>
      {jsonLdScript(breadcrumbJsonLd([{ name: '먹맵', path: '/' }, { name: '블로그', path: PATH }]))}
    </>
  )
}
