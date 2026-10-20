import { test, expect, type Page } from '@playwright/test'

// 홈 지도 화면 상태: 지도 → 핀 카드 → 상세, 지도 → 목록 → 상세. 뒤로가기는 한 단계씩 닫는다

async function ready(page: Page) {
  await page.goto('/')
  // 첫 화면 소개가 걷힐 때까지
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 10_000 })
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
    const pin = await uncoveredPin(page)
    if (pin) return pin
    await page.locator('[data-cluster]').first().tap()
    await page.waitForTimeout(900)
  }
  const pin = await uncoveredPin(page)
  expect(pin).not.toBeNull()
  return pin!
}

// 가게가 늘면 핀끼리 겹친다. 가운데를 다른 핀이 덮지 않은 핀만 고른다
async function uncoveredPin(page: Page) {
  const id = await page.locator('[data-pin]').evaluateAll((els) => {
    for (const el of els) {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      if (r.width && top && el.contains(top)) return el.getAttribute('data-pin')
    }
    return null
  })
  return id ? page.locator(`[data-pin="${id}"]`) : null
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

test('첫 화면에서 낱개 핀을 누르면 그 가게로 확대해 카드에 가리지 않는 곳에 둔다', async ({ page }) => {
  await ready(page)
  // 첫 화면의 전체 맞춤 이동이 끝난 뒤에 누른다
  await page.waitForTimeout(1200)
  const pin = await uncoveredPin(page)
  test.skip(!pin, '첫 화면에 낱개 핀이 없다')
  const id = await pin!.getAttribute('data-pin')
  await pin!.tap()
  await expect(page.getByTestId('preview-card')).toBeVisible()
  // 확대가 끝나면 고른 핀이 위 검색·칩과 카드 사이 빈 곳 가운데에 온다(카드에 가려지지 않는다)
  const map = (await page.getByTestId('map').boundingBox())!
  const chips = (await page.getByRole('navigation', { name: '유튜버 고르기' }).first().boundingBox())!
  await expect.poll(async () => {
    const b = await page.locator(`[data-pin="${id}"]`).boundingBox()
    const card = await page.getByTestId('preview-card').boundingBox()
    if (!b || !card) return 999
    const mid = (chips.y + chips.height + card.y) / 2
    return Math.max(Math.abs(b.x + b.width / 2 - (map.x + map.width / 2)), Math.abs(b.y + b.height / 2 - mid))
  }, { timeout: 6_000 }).toBeLessThan(30)
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
  // 올라오는 움직임이 끝난 뒤 위치를 잰다
  await expect.poll(async () => (await list.boundingBox())!.y).toBeLessThanOrEqual(1)
  const box = (await list.boundingBox())!
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

function searchBox(page: Page) {
  return page.locator('input[aria-label="검색"]:visible').first()
}

const num = async (page: Page) => Number((await page.getByTestId('pill-count').textContent())!.replace(/\D/g, ''))

test('첫 화면에 소개가 떴다가 지도가 준비되면 걷힌다', async ({ page }) => {
  // 서버가 그린 HTML에 이미 들어 있어 JS가 돌기 전부터 보인다
  const res = await page.request.get('/')
  expect(await res.text()).toContain('data-testid="intro"')
  await page.goto('/')
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 10_000 })
})

test('메뉴 이름으로 찾아진다', async ({ page }) => {
  await ready(page)
  await searchBox(page).fill('국밥')
  await expect(page.getByTestId('search-restaurant').first()).toBeVisible()
})

test('유튜버 + 지역을 띄어 쓰면 둘 다 맞는 가게가 나오고, 전체 보기는 지도 개수를 줄인다', async ({ page }) => {
  await ready(page)
  const all = await num(page)
  await searchBox(page).fill('쯔양 서울')
  await expect(page.getByTestId('search-restaurant').first()).toBeVisible()
  await page.getByTestId('search-all').click()
  const chip = page.locator('[data-testid="text-chip"]:visible').first()
  await expect(chip).toBeVisible()
  await expect.poll(() => num(page)).toBeLessThan(all)
  await chip.click()
  await expect(page.locator('[data-testid="text-chip"]:visible')).toHaveCount(0)
})

test('붙여 쓴 검색어도 나눠서 찾는다', async ({ page }) => {
  await ready(page)
  await searchBox(page).fill('쯔양서울')
  await expect(page.getByTestId('search-restaurant').first()).toBeVisible()
})

test('검색에서 가게를 누르면 지도가 그 가게로 가고 카드가 뜬다', async ({ page }) => {
  await ready(page)
  // 첫 화면(서울 근처)에서 먼 가게: 강릉
  await searchBox(page).fill('콩새장치찜')
  await page.getByTestId('search-restaurant').first().click()
  const card = page.getByTestId('preview-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText('콩새장치찜')
  // 고른 가게 핀이 화면 안(검색칩과 카드 사이)에 보인다
  const pin = page.locator('[data-pin="647"]')
  await expect(pin).toBeVisible({ timeout: 10_000 })
  await expect.poll(async () => {
    const b = await pin.boundingBox()
    const c = await card.boundingBox()
    const vp = page.viewportSize()!
    return !!b && !!c && b.x > 0 && b.x + b.width < vp.width && b.y > 100 && b.y + b.height < c.y
  }, { timeout: 10_000 }).toBe(true)
})

test('다른 지역 검색 필터가 걸린 채로 가게를 고르면 지도가 그 가게로 간다', async ({ page }) => {
  await ready(page)
  // '영등포' 전체 보기로 필터를 건다
  await searchBox(page).fill('영등포')
  await page.getByTestId('search-all').click()
  await expect(page.getByText('‘영등포’').first()).toBeVisible()
  await page.waitForTimeout(1500) // 지도가 영등포로 다 움직인 뒤
  // 송파 가게를 고른다
  await searchBox(page).fill('기유')
  await page.locator('[data-testid="search-restaurant"]:visible').first().click()
  const card = page.getByTestId('preview-card')
  await expect(card).toContainText('기유')
  const pin = page.locator('[data-pin="655"]')
  await expect(pin).toBeVisible({ timeout: 10_000 })
  await expect.poll(async () => {
    const b = await pin.boundingBox()
    const c = await card.boundingBox()
    const vp = page.viewportSize()!
    return !!b && !!c && b.x > 0 && b.x + b.width < vp.width && b.y > 100 && b.y + b.height < c.y
  }, { timeout: 10_000 }).toBe(true)
})
