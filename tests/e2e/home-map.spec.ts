import { test, expect, type Page } from '@playwright/test'

// 홈 지도 화면 상태: 지도 → 핀 카드 → 상세, 지도 → 목록 → 상세. 뒤로가기는 한 단계씩 닫는다

async function ready(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  // 지도 SDK가 핀을 그릴 때까지
  await expect(page.locator('[data-cluster], [data-pin]').first()).toBeVisible({ timeout: 30_000 })
}

// 핀이 없는 지도 빈 곳
async function emptySpot(page: Page) {
  const boxes = await page.locator('[data-cluster], [data-pin]').evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })))
  const vp = page.viewportSize()!
  for (let y = 180; y < vp.height - 220; y += 20) {
    for (let x = 30; x < vp.width - 30; x += 20) {
      if (boxes.every((b) => Math.hypot(b.x - x, b.y - y) > 60)) return { x, y }
    }
  }
  throw new Error('빈 곳이 없다')
}

async function zoomToSinglePin(page: Page) {
  // 묶음을 눌러 들어가다 보면 낱개 핀이 나온다
  for (let i = 0; i < 8; i++) {
    const pin = page.locator('[data-pin]').first()
    if (await pin.isVisible().catch(() => false)) return pin
    await page.locator('[data-cluster]').first().tap()
    await page.waitForTimeout(900)
  }
  const pin = page.locator('[data-pin]').first()
  await expect(pin).toBeVisible()
  return pin
}

test('핀 개수가 바로 나오고 "찾는 중"이 없다', async ({ page }) => {
  await ready(page)
  await expect(page.getByText('찾는 중')).toHaveCount(0)
})

test('전국 지도에서도 묶음에 유튜버 얼굴이 보인다', async ({ page }) => {
  await ready(page)
  const img = page.locator('[data-cluster] img').first()
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
})

test('핀 → 카드, 지도 누르면 카드 닫힘', async ({ page }) => {
  await ready(page)
  const pin = await zoomToSinglePin(page)
  await pin.tap()
  const card = page.getByTestId('preview-card')
  await expect(card).toBeVisible()
  await expect(page.getByTestId('list-pill')).toHaveCount(0)

  const spot = await emptySpot(page)
  await page.touchscreen.tap(spot.x, spot.y)
  await expect(card).toHaveCount(0)
  await expect(page.getByTestId('list-pill')).toBeVisible()
})

test('카드 → 상세가 화면 전체를 덮고, 뒤로가면 카드로 돌아온다', async ({ page }) => {
  await ready(page)
  const pin = await zoomToSinglePin(page)
  await pin.tap()
  await page.getByTestId('preview-card').getByRole('button', { name: /자세히 보기/ }).click()

  const detail = page.getByTestId('detail-view')
  await expect(detail).toBeVisible()
  const box = (await detail.boundingBox())!
  const vp = page.viewportSize()!
  expect(box.y).toBeLessThanOrEqual(1)
  expect(box.height).toBeGreaterThanOrEqual(vp.height - 1)
  expect(box.width).toBeGreaterThanOrEqual(vp.width - 1)
  await expect(detail.getByRole('link', { name: /길찾기/ })).toBeVisible({ timeout: 15_000 })

  await page.getByTestId('detail-back').click()
  await expect(detail).toHaveCount(0)
  await expect(page.getByTestId('preview-card')).toBeVisible()

  // 브라우저 뒤로가기는 카드도 닫는다
  await page.goBack()
  await expect(page.getByTestId('preview-card')).toHaveCount(0)
})

test('목록 보기 → 전체 화면 목록 → 상세 → 뒤로 → 목록 → 지도', async ({ page }) => {
  await ready(page)
  await page.getByTestId('list-pill').click()
  const list = page.getByTestId('list-view')
  await expect(list).toBeVisible()
  const box = (await list.boundingBox())!
  expect(box.y).toBeLessThanOrEqual(1)
  expect(box.height).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1)

  const first = page.getByTestId('list-item').first()
  await expect(first).toBeVisible()
  await first.click()
  await expect(page.getByTestId('detail-view')).toBeVisible()

  await page.goBack()
  await expect(page.getByTestId('detail-view')).toHaveCount(0)
  await expect(list).toBeVisible()

  await page.getByTestId('map-pill').click()
  await expect(list).toBeHidden()
  await expect(page.getByTestId('list-pill')).toBeVisible()
})

test('유튜버 칩을 누르면 개수가 그 유튜버 가게로 바뀐다', async ({ page }) => {
  await ready(page)
  const all = Number((await page.getByTestId('pill-count').textContent())!.replace(/\D/g, ''))
  const chip = page.getByRole('navigation', { name: '유튜버 고르기' }).first().getByRole('button').nth(1)
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => Number((await page.getByTestId('pill-count').textContent())!.replace(/\D/g, ''))).toBeLessThan(all)
})

test('가로 스크롤이 없다', async ({ page }) => {
  await ready(page)
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  expect(ok).toBe(true)
})
