import type { Metadata } from 'next'
import { Fragment } from 'react'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/page/SiteHeader'
import { getAll } from '@/lib/data'
import { areaOf, leadVideo, thumbOf, visitorsOf } from '@/lib/format'
import { type Inline, blocksOf, dayLabel, getPost, getPosts, inlineOf } from '@/lib/blog'
import { SITE_NAME, abs, breadcrumbJsonLd, jsonLdScript, pageMetadata, pathOf } from '@/lib/seo'
import type { Channel, RestaurantWithVideos } from '@/lib/types'

// 글은 파일이지만 가게 카드·숫자는 지금 DB 값이라 매시간 다시 그린다
export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug)
  if (!post) return {}
  const base = pageMetadata({ title: `${post.title} | 먹맵`, description: post.description, path: `/blog/${post.slug}` })
  return {
    ...base,
    openGraph: { ...base.openGraph, type: 'article', publishedTime: post.date, modifiedTime: post.updated, tags: post.tags },
  }
}

/** [[숫자:키]] 값. 가게·유튜버·지역:서울·유튜버가게:쯔양 */
function numberOf(key: string, channels: Channel[], restaurants: RestaurantWithVideos[]) {
  const [k, arg] = key.split(':')
  if (k === '가게') return restaurants.length
  if (k === '유튜버') return channels.length
  if (k === '지역' && arg) return restaurants.filter((r) => r.region === arg).length
  if (k === '유튜버가게' && arg) {
    const c = channels.find((x) => x.slug === arg || x.name === arg)
    return c ? restaurants.filter((r) => r.videos.some((v) => v.channel_id === c.id)).length : null
  }
  return null
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug)
  if (!post) notFound()
  const { channels, restaurants } = await getAll()
  const byId = new Map(restaurants.map((r) => [r.id, r]))
  const path = `/blog/${post.slug}`

  const inline = (text: string) => inlineOf(text).map((x: Inline, i) => {
    if (x.t === 'b') return <strong key={i} className="font-bold text-ink">{x.text}</strong>
    if (x.t === 'a') return <a key={i} href={x.href} className="text-ink underline">{x.text}</a>
    if (x.t === 'yt') {
      const c = channels.find((ch) => ch.slug === x.slug || ch.name === x.slug)
      return c ? <a key={i} href={pathOf('youtuber', c.slug || c.id)} className="text-ink underline">{c.name}</a> : <Fragment key={i}>{x.slug}</Fragment>
    }
    if (x.t === 'num') {
      const n = numberOf(x.key, channels, restaurants)
      return <Fragment key={i}>{n == null ? '' : n.toLocaleString('ko-KR')}</Fragment>
    }
    return <Fragment key={i}>{x.text}</Fragment>
  })

  return (
    <>
      <SiteHeader crumbs={[{ name: '블로그', path: '/blog' }, { name: post.title, path }]} />
      <main className="mx-auto max-w-3xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-6">
        <article className="break-keep">
          <h1 className="text-display font-bold text-ink">{post.title}</h1>
          <p className="mt-2 text-meta text-sub">
            {dayLabel(post.date)}{post.updated !== post.date && ` 작성, ${dayLabel(post.updated)} 고침`} · 숫자는 지금 먹맵 데이터 기준
          </p>
          <div className="mt-6">
            {blocksOf(post.body).map((b, i) => {
              if (b.t === 'h2') return <h2 key={i} className="mt-8 text-title font-bold text-ink">{inline(b.text)}</h2>
              if (b.t === 'h3') return <h3 key={i} className="mt-6 text-lead font-bold text-ink">{inline(b.text)}</h3>
              if (b.t === 'p') return <p key={i} className="mt-3 text-lead text-ink">{inline(b.text)}</p>
              if (b.t === 'ul') return (
                <ul key={i} className="mt-3 list-disc pl-5 text-lead text-ink">
                  {b.items.map((it, j) => <li key={j} className="mt-1">{inline(it)}</li>)}
                </ul>
              )
              const r = byId.get(b.id)
              if (!r) return null
              const lead = leadVideo(r)
              return (
                <a
                  key={i}
                  href={`/restaurant/${r.id}`}
                  data-track="blog_place_click"
                  data-track-id={r.id}
                  className="mt-4 flex gap-3 rounded-card border border-line p-3"
                >
                  {lead && <img src={thumbOf(lead)} alt={`${r.name} 영상 장면`} width={112} height={63} loading="lazy" className="h-[63px] w-[112px] flex-shrink-0 rounded-[8px] object-cover" />}
                  <span className="min-w-0">
                    <span className="block truncate text-body font-bold text-ink">{r.name}</span>
                    <span className="block truncate text-meta text-sub">{[areaOf(r), r.category].filter(Boolean).join(', ')}</span>
                    <span className="block truncate text-meta text-sub">{visitorsOf(r).map((v) => v.name).join('·')} 다녀감</span>
                    {lead?.menu && <span className="block truncate text-meta text-sub">먹은 것: {lead.menu}</span>}
                  </span>
                </a>
              )
            })}
          </div>
        </article>
        <p className="mt-10 border-t border-line pt-4 text-body text-sub">
          <a href="/blog" className="text-ink underline">블로그 다른 글</a>{' · '}
          <a href="/" className="text-ink underline">유튜버 맛집 지도 열기</a>
        </p>
      </main>
      {jsonLdScript([
        {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.updated,
          inLanguage: 'ko-KR',
          mainEntityOfPage: abs(path),
          url: abs(path),
          keywords: post.tags.join(', '),
          author: { '@type': 'Organization', name: SITE_NAME, url: abs('/') },
          publisher: { '@id': `${abs('/')}#org` },
        },
        breadcrumbJsonLd([{ name: '먹맵', path: '/' }, { name: '블로그', path: '/blog' }, { name: post.title, path }]),
      ])}
    </>
  )
}
