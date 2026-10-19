import { expect, test, type Page } from '@playwright/test'

// 토스 미니앱 번들을 토스 웹뷰 크기로 띄워, 화면이 옆으로 밀리거나 확대되지 않는지 본다.
// 실제 사고: 검색창 글자가 15px라 iOS가 입력할 때 화면을 확대한 채로 두어 왼쪽이 잘리고 카드가 오른쪽으로 넘쳤다.
const TOSS = 'http://localhost:5174/'

async function open(page: Page) {
  // 운영 API는 토스 오리진만 허용하므로 로컬 번들에서는 응답에 CORS 헤더를 붙여 넘긴다
  await page.route('https://mukmap.kr/api/**', async (route) => {
    try {
      const res = await route.fetch()
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } })
    } catch {
      // 테스트가 먼저 끝나 페이지가 닫힌 경우
    }
  })
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
