import { test, expect, type Page } from '@playwright/test'

// 이벤트 로그(lib/analytics.ts): 웹은 GA4 줄(dataLayer), 토스 앱은 토스 SDK로 같은 이름이 나간다.
// 콘솔 전환 지표(video_watch_click)와 GA4 주요 이벤트가 이 이름에 걸려 있어 이름이 바뀌면 지표가 끊긴다

type Ev = { name: string } & Record<string, unknown>
const events = (page: Page) => page.evaluate(() => ((window as unknown as { __mkEvents?: Ev[] }).__mkEvents ?? []) as Ev[])
// gtag는 arguments 객체를 쌓는다: ['event', 이름, 파라미터]
const gaEvents = (page: Page) => page.evaluate(() =>
  ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? [])
    .map((a) => Array.from(a))
    .filter((a) => a[0] === 'event')
    .map((a) => ({ name: a[1] as string, ...(a[2] as object) })))

async function ready(page: Page, path = '/') {
  await page.goto(path)
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
}

test('첫 화면 → 목록 → 상세 → 영상 보기가 같은 이름으로 GA4에 쌓인다', async ({ page, context }) => {
  // 유튜브로 나가는 새 창은 열지 않는다
  await context.route('https://www.youtube.com/**', (r) => r.abort())
  await ready(page, '/?utm_source=threads&utm_medium=social&utm_campaign=mukmap_20261021')

  const open = (await events(page)).find((e) => e.name === 'app_open')
  expect(open).toMatchObject({ entry: 'threads', utm_source: 'threads', utm_medium: 'social', utm_campaign: 'mukmap_20261021' })
  expect(typeof open!.first).toBe('boolean')
  await expect.poll(async () => (await events(page)).some((e) => e.name === 'app_ready' && Number(e.ms) > 0)).toBe(true)
  expect((await events(page)).find((e) => e.name === 'pins_load')).toMatchObject({ ok: true })

  await page.getByTestId('list-pill').click()
  await page.getByTestId('list-item').nth(1).click()
  await expect(page.getByTestId('detail-view')).toBeVisible()
  const click = (await events(page)).find((e) => e.name === 'list_click')
  expect(click).toMatchObject({ rank: 2, sort: 'visitors' })
  // 개발 모드는 효과를 두 번 돌려 같은 화면이 겹칠 수 있다
  const screens = (await events(page)).filter((e) => e.name === 'screen_open').map((e) => e.screen)
  expect(screens.filter((s, i) => s !== screens[i - 1])).toEqual(['map', 'list', 'detail'])
  expect((await events(page)).find((e) => e.name === 'screen_leave' && e.screen === 'list')).toBeTruthy()

  await page.getByTestId('watch-main').click()
  await expect.poll(async () => (await events(page)).find((e) => e.name === 'video_watch_click')).toMatchObject({ id: click!.id, where: 'main' })
  // 완료 안내
  await expect(page.getByRole('status')).toHaveText('유튜브에서 그 장면부터 열어요')

  const ga = await gaEvents(page)
  for (const n of ['app_open', 'list_click', 'screen_open', 'video_watch_click']) expect(ga.map((e) => e.name)).toContain(n)
  expect(ga.find((e) => e.name === 'video_watch_click')).toMatchObject({ where: 'main' })
})

test('검색·유튜버 칩이 결과 수와 함께 남는다', async ({ page }) => {
  await ready(page)
  await page.locator('nav[aria-label="유튜버 고르기"] button[aria-pressed]').nth(1).click()
  await expect.poll(async () => (await events(page)).find((e) => e.name === 'filter_change')).toMatchObject({ type: 'channel' })
  expect(Number((await events(page)).find((e) => e.name === 'filter_change')!.count)).toBeGreaterThan(0)

  const box = page.getByRole('searchbox', { name: '검색' })
  await box.fill('국밥')
  await box.press('Enter')
  await expect.poll(async () => (await events(page)).find((e) => e.name === 'search_result')).toMatchObject({ q: '국밥' })
})

test('가게 목록을 끝내 못 받으면 안내와 다시 불러오기가 뜨고, 누르면 다시 받는다', async ({ page }) => {
  // 전체 테스트를 몰아 돌리면 개발 서버가 느려져 재시도·다시 받기가 늦게 끝난다
  test.setTimeout(150_000)
  let fail = true
  await page.route('**/api/pins', (r) => (fail ? r.fulfill({ status: 500, body: 'x' }) : r.fallback()))
  await page.goto('/')
  const notice = page.getByTestId('pins-retry')
  // 다섯 번 더 받아 본 뒤(약 15초) 안내한다
  await expect(notice).toBeVisible({ timeout: 60_000 })
  await expect(notice).toContainText('가게 목록을 불러오지 못했어요')
  const ev = await events(page)
  expect(ev.filter((e) => e.name === 'load_retry' && e.what === 'pins')).toHaveLength(5)
  expect(ev.find((e) => e.name === 'load_fail')).toMatchObject({ what: 'pins' })

  fail = false
  await notice.getByRole('button', { name: '다시 불러오기' }).click()
  await expect(notice).toHaveCount(0)
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 60_000 })
  expect((await events(page)).find((e) => e.name === 'load_retry_tap')).toMatchObject({ what: 'pins' })
})

test('웹 가게 페이지의 토스 앱으로 열기는 UTM을 달고 누름이 GA4로 간다', async ({ page }) => {
  await page.goto('/restaurant/142')
  const toss = page.getByTestId('open-toss')
  const href = (await toss.getAttribute('href'))!
  const supertoss = new URL(href).searchParams.get('af_dp')!
  const intoss = new URLSearchParams(supertoss.split('?')[1]).get('redirect')!
  const q = new URLSearchParams(intoss.slice(intoss.indexOf('?')))
  expect(q.get('utm_source')).toBe('web')
  expect(q.get('utm_campaign')).toBe('mukmap_open_toss')
  expect(q.get('place')).toBe('142')

  await page.waitForFunction(() => typeof (window as unknown as { gtag?: unknown }).gtag === 'function')
  // 클릭 듣기는 화면이 살아난 뒤 붙는다
  await page.waitForLoadState('networkidle')
  // 토스 링크로 실제로 넘어가면 이 페이지의 기록이 사라진다. 넘어가는 것만 막는다
  await page.evaluate(() => addEventListener('click', (e) => e.preventDefault()))
  await toss.click()
  await expect.poll(async () => (await gaEvents(page)).find((e) => e.name === 'toss_open_click')).toMatchObject({ where: 'restaurant', id: 142 })
})
