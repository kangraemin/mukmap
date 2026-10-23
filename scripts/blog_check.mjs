// 블로그 글을 올리기 전에 검사한다: 머리말·slug·가게 id·유튜버 이름·숫자 키. 사용: node scripts/blog_check.mjs content/blog/<slug>.md
import fs from 'fs'
import path from 'path'

const BASE = process.env.MUKMAP_BASE_URL || 'https://mukmap.kr'
const file = process.argv[2]
const errors = []
const fail = (m) => errors.push(m)

if (!file || !fs.existsSync(file)) {
  console.error(`파일이 없다: ${file}`)
  process.exit(1)
}
if (path.resolve(path.dirname(file)) !== path.resolve('content/blog')) fail('글은 content/blog/ 바로 아래에 둔다')
const slug = path.basename(file, '.md')
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(`slug "${slug}": 영어 소문자·숫자·하이픈만`)

const src = fs.readFileSync(file, 'utf8')
const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
if (!m) fail('맨 위에 --- 머리말이 없다')
const meta = {}
for (const line of (m?.[1] || '').split('\n')) {
  const kv = line.match(/^(\w+):\s*(.*)$/)
  if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
}
for (const k of ['title', 'description', 'date']) if (!meta[k]) fail(`머리말에 ${k}가 없다`)
for (const k of ['date', 'updated']) if (meta[k] && !/^\d{4}-\d{2}-\d{2}$/.test(meta[k])) fail(`${k}는 YYYY-MM-DD`)
if (meta.title && (meta.title.length < 8 || meta.title.length > 60)) fail(`title ${meta.title.length}자: 8~60자`)
if (meta.description && (meta.description.length < 40 || meta.description.length > 170)) fail(`description ${meta.description.length}자: 40~170자`)

const body = m?.[2] || ''
const places = [...body.matchAll(/\[\[가게:(\d+)\]\]/g)].map((x) => Number(x[1]))
const youtubers = [...body.matchAll(/\[\[유튜버:([^\]]+)\]\]/g)].map((x) => x[1].trim())
const nums = [...body.matchAll(/\[\[숫자:([^\]]+)\]\]/g)].map((x) => x[1].trim())
for (const line of body.split('\n')) if (/\[\[가게:\d+\]\]/.test(line) && !/^\s*\[\[가게:\d+\]\]\s*$/.test(line)) fail(`[[가게:id]]는 한 줄에 단독으로: ${line.trim()}`)
for (const x of body.matchAll(/\[\[([^:\]]+):/g)) if (!['가게', '유튜버', '숫자'].includes(x[1])) fail(`모르는 짧은 코드: [[${x[1]}:...]]`)

const [pins, chs] = await Promise.all([
  fetch(`${BASE}/api/pins`).then((r) => r.json()),
  fetch(`${BASE}/api/channels`).then((r) => r.json()),
])
const ids = new Set(pins.pins.map((p) => p.id))
const channels = chs.channels
const regions = new Set(pins.pins.map((p) => p.region))
for (const id of places) if (!ids.has(id)) fail(`없는 가게 id: ${id}`)
const hasCh = (n) => channels.some((c) => c.slug === n || c.name === n)
for (const n of youtubers) if (!hasCh(n)) fail(`없는 유튜버: ${n}`)
for (const k of nums) {
  const [a, b] = k.split(':')
  const ok = (a === '가게' || a === '유튜버') && !b ? true : a === '지역' ? regions.has(b) : a === '유튜버가게' ? hasCh(b) : false
  if (!ok) fail(`모르는 숫자 키: [[숫자:${k}]]`)
}

if (errors.length) {
  console.error(`검사 실패 ${file}\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log(`OK ${slug}: 가게 카드 ${places.length}개, 유튜버 링크 ${youtubers.length}개, 숫자 ${nums.length}개`)
