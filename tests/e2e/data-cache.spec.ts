import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { coalesce } from '../../lib/coalesce'

// 가게 전체 목록이 Next 데이터 캐시(항목당 2MB)에 실제로 들어간다.
// 안 들어가면 페이지를 열 때마다 전체를 다시 읽고 가공해 서버 CPU를 태운다
const DIR = path.join(process.cwd(), '.next/cache/fetch-cache')
const LIMIT = 2 * 1024 * 1024

// unstable_cache 항목은 headers가 비어 있고, 가게 목록 덩어리는 rows로 시작한다
function restaurantEntries(since: number) {
  if (!fs.existsSync(DIR)) return []
  return fs.readdirSync(DIR)
    .map((f) => path.join(DIR, f))
    .filter((f) => fs.statSync(f).isFile() && fs.statSync(f).mtimeMs >= since)
    .filter((f) => {
      const head = fs.readFileSync(f, 'utf8').slice(0, 400)
      return head.startsWith('{"kind":"FETCH","data":{"headers":{}') && head.includes('{\\"rows\\":[{')
    })
}

test('가게 전체 목록이 2MB 아래 덩어리로 캐시에 저장된다', async ({ request }) => {
  test.setTimeout(90_000)
  const since = Date.now()
  // 이미 캐시돼 있으면 새로 쓰지 않으므로, 데이터 갱신 요청으로 다시 만들게 한다
  const secret = fs.readFileSync('.env.local', 'utf8').match(/^REVALIDATE_SECRET=["']?([^"'\n]+)/m)![1]
  expect((await request.post('/api/revalidate', { headers: { 'x-revalidate-secret': secret } })).status()).toBe(200)

  // sitemap은 가게 전체 목록을 쓴다
  expect((await request.get('/sitemap.xml')).status()).toBe(200)

  // 캐시 파일은 응답을 보낸 뒤에 써진다
  await expect.poll(() => restaurantEntries(since).length, { timeout: 30_000 }).toBeGreaterThan(0)
  for (const f of restaurantEntries(since)) {
    expect(fs.statSync(f).size, f).toBeLessThan(LIMIT)
    // 1시간 만료면 만료 때마다 전체를 다시 읽어 DB 부하 1위가 됐다(10/24). 갱신은 /api/revalidate가 맡는다
    expect(JSON.parse(fs.readFileSync(f, 'utf8')).revalidate, f).toBeGreaterThanOrEqual(86400)
  }
  // 채널·외국어 가게 이름처럼 같은 태그로 묶인 캐시도 하루 만료다(외국어 이름 질의가 DB 부하 5위였다)
  const tagged = fs.readdirSync(DIR).map((f) => path.join(DIR, f))
    .filter((f) => fs.statSync(f).isFile() && fs.statSync(f).mtimeMs >= since)
    .map((f) => ({ f, e: JSON.parse(fs.readFileSync(f, 'utf8')) }))
    .filter(({ e }) => (e.tags || []).includes('mukmap-data'))
  expect(tagged.length).toBeGreaterThan(restaurantEntries(since).length)
  for (const { f, e } of tagged) expect(e.revalidate, f).toBeGreaterThanOrEqual(86400)
})

test('지도 핀 API는 서버 캐시를 하루 들고 있는다(새 데이터는 /api/revalidate가 비운다)', () => {
  // CDN(s-maxage 1시간)이 만료돼도 DB 대신 서버 캐시를 읽게 한다. 1시간이면 DB 부하 4위였다(10/24)
  const src = fs.readFileSync('app/api/pins/route.ts', 'utf8')
  expect(Number(src.match(/export const revalidate = (\d+)/)?.[1])).toBeGreaterThanOrEqual(86400)
})

test('읽는 중에 겹친 전체 목록 요청은 DB를 한 번만 부르고, 다 읽은 뒤·실패 뒤엔 새로 부른다', async () => {
  let n = 0
  let fail = false
  const get = coalesce(async () => {
    n++
    await new Promise((r) => setTimeout(r, 100))
    if (fail) throw new Error('db')
    return n
  })
  expect(await Promise.all([get(), get(), get()])).toEqual([1, 1, 1])
  // 캐시를 비운 뒤 옛 결과를 들고 있으면 안 된다
  expect(await get()).toBe(2)
  fail = true
  await expect(Promise.all([get(), get()])).rejects.toThrow('db')
  fail = false
  expect(await get()).toBe(4)
})
