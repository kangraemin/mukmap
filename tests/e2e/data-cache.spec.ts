import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

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
  for (const f of restaurantEntries(since)) expect(fs.statSync(f).size, f).toBeLessThan(LIMIT)
})
