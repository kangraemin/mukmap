import { expect, test, type Page } from '@playwright/test'

// 토스 미니앱 번들을 토스 웹뷰 크기로 띄워, 화면이 옆으로 밀리거나 확대되지 않는지 본다.
// 실제 사고: 검색창 글자가 15px라 iOS가 입력할 때 화면을 확대한 채로 두어 왼쪽이 잘리고 카드가 오른쪽으로 넘쳤다.
const TOSS = 'http://localhost:5174/'

async function open(page: Page, before?: () => Promise<unknown>) {
  // 운영 API는 토스 오리진만 허용하므로 로컬 번들에서는 응답에 CORS 헤더를 붙여 넘긴다
  await page.route('https://mukmap.kr/api/**', async (route) => {
    try {
      const res = await route.fetch()
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } })
    } catch {
      // 테스트가 먼저 끝나 페이지가 닫힌 경우
    }
  })
  // 나중에 건 route가 먼저 받는다
  await before?.()
  await page.goto(TOSS)
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 15_000 })
}

async function noSideShift(page: Page) {
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    bw: document.body.scrollWidth,
    w: window.innerWidth,
    x: window.scrollX,
    scale: window.visualViewport?.scale ?? 1,
  }))
  expect(m.sw).toBeLessThanOrEqual(m.w)
  expect(m.bw).toBeLessThanOrEqual(m.w)
  expect(m.x).toBe(0)
  expect(m.scale).toBe(1)
}

test('토스: 입력할 때 iOS가 확대하지 않는다', async ({ page }) => {
  await open(page)
  const vp = await page.locator('meta[name="viewport"]').getAttribute('content')
  expect(vp).toContain('maximum-scale=1')
  const input = page.getByRole('searchbox', { name: '검색' })
  const size = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(size).toBeGreaterThanOrEqual(16)
})

test('토스: 역 검색은 앱 안 역 목록으로 바로 뜨고, 없는 역만 운영 API에 묻는다. 선택하면 검색을 닫는다', async ({ page }) => {
  await open(page)
  let called = false
  await page.route('https://mukmap.kr/api/station?*', async (route) => {
    called = true
    await route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: [{ name: '없던역 9호선', lat: 37.4979526, lng: 127.0276242 }],
    })
  })
  await page.getByRole('searchbox', { name: '검색' }).fill('강남역')
  await expect(page.getByTestId('search-station')).toHaveText(/강남역/, { timeout: 1_000 })
  expect(called).toBe(false)
  await page.getByRole('searchbox', { name: '검색' }).fill('없던역')
  await expect(page.getByTestId('search-station')).toHaveText(/없던역 9호선/)
  expect(called).toBe(true)
  await page.getByTestId('search-station').click()
  await expect(page.getByTestId('search-results')).toBeHidden()
  await expect(page.getByTestId('preview-card')).toHaveCount(0)
})

test('토스: 첫 화면·검색·목록·상세에서 옆으로 밀리지 않는다', async ({ page }) => {
  await open(page)
  await noSideShift(page)

  // 검색창과 칩이 왼쪽 여백 16px을 지킨다
  const box = await page.getByRole('searchbox', { name: '검색' }).locator('xpath=ancestor::label').boundingBox()
  expect(Math.round(box!.x)).toBe(16)

  const input = page.getByRole('searchbox', { name: '검색' })
  await input.fill('국밥')
  await expect(page.getByTestId('search-results')).toBeVisible()
  await noSideShift(page)

  // 모바일은 가게를 고르면 지도 아래 카드가 뜬다(사고가 난 화면)
  await page.getByTestId('search-restaurant').first().click()
  const card = page.getByTestId('preview-card')
  await expect(card).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(600)
  await noSideShift(page)
  const cb = await card.boundingBox()
  const w = page.viewportSize()!.width
  expect(Math.round(cb!.x)).toBeGreaterThanOrEqual(16)
  expect(Math.round(cb!.x + cb!.width)).toBeLessThanOrEqual(w - 16)

  await card.getByRole('button', { name: /자세히 보기/ }).click()
  await expect(page.getByTestId('detail-view')).toBeVisible({ timeout: 10_000 })
  // 토스 상단바에 뒤로가기가 있으니 상세의 자체 뒤로가기는 겹쳐 보이지 않아야 한다
  await expect(page.getByTestId('detail-back')).toBeHidden()
  // 토스 밖(광고 SDK 미지원)에서는 광고 자리가 빈칸으로 남지 않고 접힌다
  await expect(page.getByTestId('ad-banner')).toHaveCount(0)
  await page.waitForTimeout(600)
  await noSideShift(page)

  await page.goBack()
  await page.waitForTimeout(600)
  await noSideShift(page)
})

// 지도 키에 localhost:5174가 없어 지도가 뜨지 않으므로, 키에 등록된 localhost:3000 주소로 토스 번들을 받아 띄운다
async function openWithMap(page: Page, channelsDelay = 0) {
  await page.route('http://localhost:3000/**', async (route) => {
    try {
      const res = await route.fetch({ url: route.request().url().replace('localhost:3000', 'localhost:5174') })
      await route.fulfill({ response: res })
    } catch {
      // 테스트가 먼저 끝나 페이지가 닫힌 경우
    }
  })
  await page.route('https://mukmap.kr/api/**', async (route) => {
    try {
      if (channelsDelay && route.request().url().includes('/api/channels')) await new Promise((r) => setTimeout(r, channelsDelay))
      const res = await route.fetch()
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } })
    } catch {
      // 테스트가 먼저 끝나 페이지가 닫힌 경우
    }
  })
  await page.goto('http://localhost:3000/')
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 15_000 })
}

test('토스: 유튜버 목록이 늦게 와도 지도 핀에 얼굴이 그려진다', async ({ page }) => {
  // 실제 사고: 토스는 채널을 따로 받아서 핀이 먼저 그려지면 확대하기 전까지 얼굴 없이 회색 원만 보였다
  await openWithMap(page, 5_000)
  const clusters = page.locator('[data-cluster]')
  await expect(clusters.first()).toBeVisible({ timeout: 10_000 })
  await expect.poll(async () => {
    const n = await clusters.count()
    const withFace = await page.locator('[data-cluster] img').count()
    return n > 0 && withFace === n
  }, { timeout: 15_000 }).toBe(true)
})

test('토스: 지도 틀이 처음에 작다가 커져도 지도가 화면을 다 채운다', async ({ page }) => {
  // 실제 사고: 토스 웹뷰가 처음엔 틀을 작게 잡았다가 키워서 지도가 위쪽만 그려지고 아래는 빈 회색, 목록 0곳이 됐다
  await page.addInitScript(() => {
    const st = document.createElement('style')
    st.id = 'shrink'
    st.textContent = 'main{max-height:300px!important}'
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st))
  })
  await openWithMap(page)
  const pill = page.getByTestId('list-pill')
  const places = async () => Number((await pill.textContent())?.match(/([\d,]+)곳/)?.[1].replace(/,/g, '') ?? 0)
  await expect.poll(places, { timeout: 10_000 }).toBeGreaterThan(0)
  await page.waitForTimeout(1500)
  const before = await places()
  await page.evaluate(() => document.getElementById('shrink')?.remove())
  // 지도가 커진 틀만큼 더 넓게 보여야 한다(예전엔 작은 크기로 굳어 개수가 그대로였다)
  await expect.poll(places, { timeout: 10_000 }).toBeGreaterThan(before)
})

test('토스: 유튜버 목록을 끝내 못 받으면 안내가 뜨고, 다시 불러오면 칩이 채워진다', async ({ page }) => {
  test.setTimeout(120_000)
  let fail = true
  await open(page, () => page.route('https://mukmap.kr/api/channels', (route) =>
    fail ? route.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: 'x' }) : route.fallback()))
  const notice = page.getByTestId('channels-retry')
  // 여섯 번 더 받아 본 뒤(약 30초) 안내한다
  await expect(notice).toBeVisible({ timeout: 60_000 })
  fail = false
  await notice.getByRole('button', { name: '다시 불러오기' }).click()
  await expect(notice).toHaveCount(0)
  await expect(page.locator('nav[aria-label="유튜버 고르기"] button')).not.toHaveCount(1, { timeout: 15_000 })
})
