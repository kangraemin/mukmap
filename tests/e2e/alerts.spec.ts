import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

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
  // 네이버 지도 키에는 localhost:5174가 등록돼 있지 않아 인증이 401이다. 등록된 3000 주소로 바꿔 묻는다
  await page.route(/\/\/oapi\.map\.naver\.com\/v3\/auth/, (route) => {
    const u = new URL(route.request().url())
    u.searchParams.set('url', 'http://localhost:3000/')
    return route.continue({ url: u.toString(), headers: { ...route.request().headers(), referer: 'http://localhost:3000/' } })
  })
  await page.goto(TOSS)
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByTestId('alert-toggle')).toHaveCount(0)

  const chips = page.getByRole('navigation', { name: '유튜버 고르기' }).first()
  const first = chips.getByRole('button').nth(1)
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
