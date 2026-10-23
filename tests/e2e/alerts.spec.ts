import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures'
import { nearNew } from '@/lib/alerts-near'

// '유튜버 새 맛집 알림'과 역 페이지 공유 미리보기.
// 신청 API는 실제 DB에 쓰므로 테스트 전용 키로 넣고 끝나면 지운다.
const TOSS = 'http://localhost:5174/'
const ORIGIN = 'https://mukmap-kr.private-apps.tossmini.com'
const cronSecret = () => readFileSync('.env.local', 'utf8').match(/^CRON_SECRET=(.+)$/m)?.[1]?.trim()

test('역 페이지에 공유 미리보기 그림이 있고 그 그림이 열린다', async ({ request }) => {
  const html = await (await request.get('/station/홍대입구')).text()
  const src = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
  expect(src).toBeTruthy()
  const img = await request.get(new URL(src!).pathname + new URL(src!).search)
  expect(img.status()).toBe(200)
  expect(img.headers()['content-type']).toContain('image/png')
})

test('알림 신청 API: 잘못된 키는 막고, 켜고 끄면 목록에 반영되고, 토스 CORS를 허용한다', async ({ request }) => {
  const channels = (await (await request.get('/api/channels')).json()).channels as { id: string }[]
  const channelId = channels[0].id
  const anonKey = `e2e-${test.info().project.name.replace(/\W/g, '')}-${Date.now()}`
  const post = (data: object) => request.post('/api/alerts', { data, headers: { Origin: ORIGIN } })

  expect((await post({ anonKey: 'x' })).status()).toBe(400)
  expect((await post({ anonKey, channelId: 'nope', on: true })).status()).toBe(404)

  const on = await post({ anonKey, channelId, on: true })
  expect(on.status()).toBe(200)
  expect(on.headers()['access-control-allow-origin']).toBe(ORIGIN)
  // 두 번 켜도 하나만 남는다
  await post({ anonKey, channelId, on: true })
  expect((await (await post({ anonKey })).json()).channels).toEqual([channelId])

  // 예약 실행: 비밀값이 없으면 막고, dry로는 이 유튜버를 구독자 1명 이상으로 센다(보내지도 기록하지도 않음)
  expect((await request.get('/api/cron/alerts?dry=1')).status()).toBe(401)
  const dry = await request.get('/api/cron/alerts?dry=1', { headers: { authorization: `Bearer ${cronSecret()}` } })
  expect(dry.status()).toBe(200)
  const plan = (await dry.json()).plans.find((p: { channelId: string }) => p.channelId === channelId)
  expect(plan.subscribers).toBeGreaterThanOrEqual(1)
  expect(typeof plan.places).toBe('number')

  expect((await post({ anonKey, channelId, on: false })).status()).toBe(200)
  expect((await (await post({ anonKey })).json()).channels).toEqual([])
})

test('토스: 유튜버를 고르면 알림 버튼이 뜨고, 동의하면 켜지고 다시 누르면 꺼진다. 거절하면 신청하지 않는다', async ({ page }) => {
  let agreement = 'newAgreement'
  await page.exposeFunction('__agreement', () => agreement)
  await page.addInitScript(() => {
    ;(window as unknown as { __mkAlertsStub: unknown }).__mkAlertsStub = {
      agree: () => (window as unknown as { __agreement: () => Promise<'newAgreement'> }).__agreement(),
      anonKey: async () => 'stub-anon-key-0123456789',
    }
  })
  const calls: { anonKey: string; channelId?: string; on?: boolean }[] = []
  await page.route('https://mukmap.kr/api/**', async (route) => {
    const req = route.request()
    if (req.url().endsWith('/api/alerts')) {
      const body = req.postDataJSON()
      calls.push(body)
      return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: body.channelId ? { channelId: body.channelId, on: body.on } : { channels: [] } })
    }
    try {
      const res = await route.fetch()
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } })
    } catch {
      // 테스트가 먼저 끝나 페이지가 닫힌 경우
    }
  })
  await page.goto(TOSS)
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByTestId('alert-toggle')).toHaveCount(0)

  const chips = page.getByRole('navigation', { name: '유튜버 고르기' }).first()
  // '전체'·'강추만' 칩 다음의 첫 유튜버 칩(얼굴 사진이 있는 칩)
  const first = chips.getByRole('button').filter({ has: page.locator('img') }).first()
  await first.click()
  const toggle = page.getByTestId('alert-toggle')
  await expect(toggle).toHaveText('새 맛집 알림')

  agreement = 'agreementRejected'
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(calls.filter((c) => c.on !== undefined)).toEqual([])

  agreement = 'newAgreement'
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(toggle).toHaveText('알림 켜짐')
  await expect(page.getByTestId('alert-toast')).toContainText('새 맛집이 올라오면 알려 드릴게요')
  const onCall = calls.find((c) => c.on === true)!
  expect(onCall.anonKey).toBe('stub-anon-key-0123456789')
  expect(onCall.channelId).toBeTruthy()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(calls.find((c) => c.on === false)?.channelId).toBe(onCall.channelId)
})

test('근처 알림 API: 켜면 찜 목록을 통째로 맞추고, 끄면 지운다. 예약 실행(dry)이 이 사람을 센다', async ({ request }) => {
  const anonKey = `e2e-near-${test.info().project.name.replace(/\W/g, '')}-${Date.now()}`
  const post = (data: object) => request.post('/api/alerts/near', { data, headers: { Origin: ORIGIN } })

  expect((await post({ anonKey: 'x' })).status()).toBe(400)
  expect((await post({ anonKey, on: true, ids: ['a'] })).status()).toBe(400)
  expect((await (await post({ anonKey })).json()).on).toBe(false)

  const on = await post({ anonKey, on: true, ids: [142, 142, 999999999] })
  expect(on.status()).toBe(200)
  expect(on.headers()['access-control-allow-origin']).toBe(ORIGIN)
  // 겹친 id는 하나로, 없는 가게는 버린다
  expect((await on.json()).count).toBe(1)
  expect((await (await post({ anonKey })).json()).on).toBe(true)
  expect((await (await post({ anonKey, on: true, ids: [] })).json()).count).toBe(0)

  const dry = await request.get('/api/cron/alerts?dry=1', { headers: { authorization: `Bearer ${cronSecret()}` } })
  expect(dry.status()).toBe(200)
  expect((await dry.json()).near.plan.people).toBeGreaterThanOrEqual(1)

  expect((await post({ anonKey, on: false })).status()).toBe(200)
  expect((await (await post({ anonKey })).json()).on).toBe(false)
})

test('토스: 처음 찜할 때만 근처 알림 동의를 묻고, 동의하면 찜 목록을 맞춘다. 찜한 곳 목록 버튼으로 끈다', async ({ page }) => {
  let asked = 0
  let agreement = 'agreementRejected'
  await page.exposeFunction('__agreement', (code: string) => { if (code === 'mukmap-kr-near-place') asked++; return agreement })
  await page.addInitScript(() => {
    ;(window as unknown as { __mkAlertsStub: unknown }).__mkAlertsStub = {
      agree: (code: string) => (window as unknown as { __agreement: (c: string) => Promise<string> }).__agreement(code),
      anonKey: async () => 'stub-anon-key-0123456789',
    }
  })
  const calls: { anonKey: string; on?: boolean; ids?: number[] }[] = []
  let serverOn = false
  await page.route('https://mukmap.kr/api/**', async (route) => {
    const req = route.request()
    if (req.url().endsWith('/api/alerts/near')) {
      const body = req.postDataJSON()
      calls.push(body)
      if (body.on !== undefined) serverOn = body.on
      return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { on: serverOn, count: body.ids?.length ?? 0 } })
    }
    try {
      const res = await route.fetch()
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } })
    } catch {
      // 테스트가 먼저 끝나 페이지가 닫힌 경우
    }
  })

  // 거절하면 그 뒤 찜에는 다시 묻지 않는다
  await page.goto(`${TOSS}?pin=142`)
  const like = page.getByTestId('preview-card').getByTestId('like')
  await like.click({ timeout: 30_000 })
  await expect.poll(() => asked).toBe(1)
  await like.click()
  await like.click()
  await page.waitForTimeout(500)
  expect(asked).toBe(1)
  expect(calls.filter((c) => c.on !== undefined)).toEqual([])

  // 30일이 지난 것처럼 기록을 지우고 다시 열면, 동의하는 순간 찜 목록을 보낸다
  await page.evaluate(() => localStorage.removeItem('mukmap:near-asked:v1'))
  agreement = 'newAgreement'
  await page.reload()
  const like2 = page.getByTestId('preview-card').getByTestId('like')
  await expect(like2).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 })
  await like2.click() // 풀기: 묻지 않는다
  await like2.click() // 다시 찜: 묻는다
  await expect.poll(() => asked).toBe(2)
  await expect(page.getByTestId('near-toast')).toContainText('찜한 곳 근처에 새 맛집이 올라오면 알려 드릴게요')
  await expect.poll(() => calls.find((c) => c.on === true)?.ids).toEqual([142])

  // 켜진 뒤엔 찜을 풀면 서버 목록만 맞춘다(묻지 않는다)
  await like2.click()
  await expect.poll(() => calls.filter((c) => c.on === true).at(-1)?.ids).toEqual([])
  expect(asked).toBe(2)
  await like2.click()
  await expect.poll(() => calls.filter((c) => c.on === true).at(-1)?.ids).toEqual([142])

  await page.getByTestId('preview-card').getByRole('button', { name: '닫기' }).click()
  await page.getByTestId('list-pill').click()
  await page.getByTestId('list-view').getByTestId('liked-chip').click()
  const toggle = page.getByTestId('near-toggle')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(calls.at(-1)).toEqual({ anonKey: 'stub-anon-key-0123456789', on: false })
})

test('근처 판정: 찜한 곳 1km 안에서 확인 시각 뒤에 생긴 가게만 센다(찜한 가게 자신은 뺀다)', () => {
  const at = (id: number, name: string, lat: number, lng: number, created_at = '2026-10-22T00:00:00Z') => ({ id, name, lat, lng, created_at })
  const liked = [at(1, '홍대 찜', 37.5572, 126.9245, '2026-01-01T00:00:00Z'), at(2, '강남 찜', 37.4979, 127.0276, '2026-01-01T00:00:00Z')]
  const fresh = [
    at(1, '홍대 찜', 37.5572, 126.9245),          // 찜한 가게 자신
    at(10, '홍대 500m', 37.5617, 126.9245),       // 약 0.5km
    at(11, '홍대 800m', 37.5572, 126.9335),       // 약 0.8km
    at(12, '홍대 2km', 37.5752, 126.9245),        // 약 2km
    at(13, '강남 300m', 37.5006, 127.0276),
    at(14, '홍대 옛 가게', 37.5580, 126.9245, '2026-10-01T00:00:00Z'), // 확인 시각 전
  ]
  expect(nearNew(liked, fresh, '2026-10-10T00:00:00Z')).toEqual({ count: 3, place: '홍대 찜' })
  expect(nearNew(liked, [], '2026-10-10T00:00:00Z')).toEqual({ count: 0, place: '' })
})
