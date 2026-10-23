// 먹맵 블로그 글(content/blog/<slug>.md). 서버에서만 읽는다. 형식은 content/blog/README.md
import fs from 'fs'
import path from 'path'
import { cache } from 'react'

const DIR = path.join(process.cwd(), 'content', 'blog')
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface Post {
  slug: string
  title: string
  description: string
  date: string
  updated: string
  tags: string[]
  body: string
}

/** 맨 위 --- 사이 `키: 값` 줄. tags는 쉼표로 나눈다 */
export function parsePost(slug: string, src: string): Post {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) throw new Error(`${slug}: 맨 위에 --- 머리말이 없다`)
  const meta: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  for (const k of ['title', 'description', 'date']) if (!meta[k]) throw new Error(`${slug}: 머리말에 ${k}가 없다`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${slug}: date는 YYYY-MM-DD`)
  return {
    slug,
    title: meta.title,
    description: meta.description,
    date: meta.date,
    updated: meta.updated || meta.date,
    tags: (meta.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    body: m[2].trim(),
  }
}

/** 최신 글부터. README.md와 _로 시작하는 초안은 뺀다 */
export const getPosts = cache((): Post[] => {
  if (!fs.existsSync(DIR)) return []
  return fs.readdirSync(DIR)
    .filter((f) => f.endsWith('.md') && SLUG_RE.test(f.slice(0, -3)))
    .map((f) => parsePost(f.slice(0, -3), fs.readFileSync(path.join(DIR, f), 'utf8')))
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
})

/** 2026-10-23 → 2026년 10월 23일 */
export function dayLabel(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return `${y}년 ${m}월 ${day}일`
}

export function getPost(slug: string) {
  return getPosts().find((p) => p.slug === slug) || null
}

export type Block =
  | { t: 'h2'; text: string }
  | { t: 'h3'; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'place'; id: number }

/** 글 본문을 블록으로 나눈다. ##·###·- 목록·빈 줄 문단, 한 줄짜리 [[가게:id]]는 카드 */
export function blocksOf(body: string): Block[] {
  const out: Block[] = []
  let para: string[] = []
  let list: string[] = []
  const flush = () => {
    if (para.length) out.push({ t: 'p', text: para.join(' ') })
    if (list.length) out.push({ t: 'ul', items: list })
    para = []
    list = []
  }
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    const place = line.match(/^\[\[가게:(\d+)\]\]$/)
    if (!line) flush()
    else if (place) { flush(); out.push({ t: 'place', id: Number(place[1]) }) }
    else if (line.startsWith('### ')) { flush(); out.push({ t: 'h3', text: line.slice(4) }) }
    else if (line.startsWith('## ')) { flush(); out.push({ t: 'h2', text: line.slice(3) }) }
    else if (line.startsWith('- ')) { if (para.length) flush(); list.push(line.slice(2)) }
    else { if (list.length) flush(); para.push(line) }
  }
  flush()
  return out
}

export type Inline = { t: 'text' | 'b'; text: string } | { t: 'a'; text: string; href: string } | { t: 'yt'; slug: string } | { t: 'num'; key: string }

/** 문장 안의 **굵게**, [글](주소), [[유튜버:이름]], [[숫자:키]] */
export function inlineOf(text: string): Inline[] {
  const out: Inline[] = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\[\[유튜버:([^\]]+)\]\]|\[\[숫자:([^\]]+)\]\]/g
  let last = 0
  for (let m; (m = re.exec(text));) {
    if (m.index > last) out.push({ t: 'text', text: text.slice(last, m.index) })
    if (m[1]) out.push({ t: 'b', text: m[1] })
    else if (m[2]) out.push({ t: 'a', text: m[2], href: m[3] })
    else if (m[4]) out.push({ t: 'yt', slug: m[4].trim() })
    else out.push({ t: 'num', key: m[5].trim() })
    last = re.lastIndex
  }
  if (last < text.length) out.push({ t: 'text', text: text.slice(last) })
  return out
}

/** 본문에 쓴 가게 id와 유튜버 이름(발행 전 검사용) */
export function refsOf(body: string) {
  return {
    places: Array.from(body.matchAll(/\[\[가게:(\d+)\]\]/g), (m) => Number(m[1])),
    youtubers: Array.from(body.matchAll(/\[\[유튜버:([^\]]+)\]\]/g), (m) => m[1].trim()),
    nums: Array.from(body.matchAll(/\[\[숫자:([^\]]+)\]\]/g), (m) => m[1].trim()),
  }
}
