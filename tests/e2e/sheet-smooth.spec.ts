import { test, expect } from '@playwright/test'

// 사용자 지시(2026-10-24): 폰에서 목록 시트를 끌면 버벅인다. 끄는 동안 높이를 바꾸면 목록 전체를 매 프레임 다시 배치하니
// 높이는 그대로 두고 transform으로만 옮겨야 한다

test('목록 시트를 끄는 동안 높이는 그대로고 위치만 따라 움직이며, 손을 떼면 다 펼친 자리에 붙는다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  const sheet = page.getByTestId('list-view')
  await expect(sheet).toHaveAttribute('data-snap', 'half')
  const vp = page.viewportSize()!
  const grip = (await sheet.locator('[data-grip]').boundingBox())!
  const x = grip.x + grip.width / 2
  const y0 = grip.y + grip.height / 2
  await page.mouse.move(x, y0)
  await page.mouse.down()
  const heights: number[] = []
  const tops: number[] = []
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(x, y0 - i * 25)
    // 손가락 위치는 다음 프레임에 반영된다
    const r = await sheet.evaluate((el: HTMLElement) => new Promise<{ h: number; top: number }>((ok) =>
      requestAnimationFrame(() => requestAnimationFrame(() => ok({ h: el.offsetHeight, top: el.getBoundingClientRect().top })))))
    heights.push(r.h)
    tops.push(r.top)
  }
  await page.mouse.up()
  // 끄는 동안 높이가 바뀌지 않는다
  expect(new Set(heights).size).toBe(1)
  // 보이는 윗변은 손가락을 따라 올라간다
  for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeLessThan(tops[i - 1])
  // 다 펼치면 화면 위까지 올라와 아래 끝에 붙는다
  await expect(sheet).toHaveAttribute('data-snap', 'full')
  await expect.poll(async () => Math.round((await sheet.boundingBox())!.y), { intervals: [100] }).toBeLessThan(2)
  const b = (await sheet.boundingBox())!
  expect(Math.abs(b.y + b.height - vp.height)).toBeLessThan(2)
})

// 사용자 지시(2026-10-24): 웹·토스 모두 시트 움직임이 끊긴다. 끌기 시작·손 뗄 때 높이를 바꾸면 목록 전체를 다시 배치하고 다시 그려
// 폰에서 그때마다 툭 끊겼다. 끌고, 붙고, 단추로 단계를 바꾸는 동안 시트 크기는 한 번도 바뀌면 안 된다
test('끌고 붙고 단추로 단계를 바꾸는 내내 목록 시트 크기는 그대로고 transform으로만 움직인다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  const sheet = page.getByTestId('list-view')
  await expect(sheet).toHaveAttribute('data-snap', 'half')
  const vp = page.viewportSize()!
  // 반쯤일 때도 화면 높이로 펴져 있고, 보이는 건 반쯤이다
  const b0 = (await sheet.boundingBox())!
  expect(Math.round(vp.height - b0.y)).toBeGreaterThan(vp.height * 0.4)
  expect(Math.round(vp.height - b0.y)).toBeLessThan(vp.height * 0.52)
  await sheet.evaluate((el: HTMLElement) => {
    const w = window as unknown as { __sizes: number[] }
    w.__sizes = []
    new ResizeObserver((es) => es.forEach((e) => w.__sizes.push(Math.round(e.contentRect.height)))).observe(el)
  })
  // ResizeObserver는 처음 붙을 때 한 번 알린다
  await expect.poll(() => page.evaluate(() => (window as unknown as { __sizes: number[] }).__sizes.length)).toBe(1)

  const grip = (await sheet.locator('[data-grip]').boundingBox())!
  const x = grip.x + grip.width / 2
  const y0 = grip.y + grip.height / 2
  await page.mouse.move(x, y0)
  await page.mouse.down()
  for (let i = 1; i <= 14; i++) await page.mouse.move(x, y0 - i * 25)
  await page.mouse.up()
  await expect(sheet).toHaveAttribute('data-snap', 'full')
  await page.waitForTimeout(500)
  // 머리줄로 끌어내려 반쯤으로
  const g2 = (await sheet.locator('[data-grip]').boundingBox())!
  await page.mouse.move(g2.x + g2.width / 2, g2.y + 10)
  await page.mouse.down()
  for (let i = 1; i <= 14; i++) await page.mouse.move(g2.x + g2.width / 2, g2.y + 10 + i * 25)
  await page.mouse.up()
  await expect(sheet).toHaveAttribute('data-snap', 'half')
  await page.waitForTimeout(500)
  // 단추로 다 펼치기 → 지도 보기
  await page.getByTestId('list-pill').click()
  await expect(sheet).toHaveAttribute('data-snap', 'full')
  await page.waitForTimeout(500)
  await page.getByTestId('map-pill').click()
  await expect(sheet).toHaveAttribute('data-snap', 'half')
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => (window as unknown as { __sizes: number[] }).__sizes)).toHaveLength(1)
  // 반쯤 자리로 정확히 돌아왔다
  const b1 = (await sheet.boundingBox())!
  expect(Math.abs(b1.y - b0.y)).toBeLessThan(2)
})

test('목록 시트를 위로 짧게 튕기면 다 펼쳐지고, 천천히 조금 끌면 제자리로 돌아온다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  const sheet = page.getByTestId('list-view')
  await expect(sheet).toHaveAttribute('data-snap', 'half')
  const grip = (await sheet.locator('[data-grip]').boundingBox())!
  const x = grip.x + grip.width / 2
  const y0 = grip.y + grip.height / 2
  // 천천히 30px: 단계 거리(48px)에 못 미치니 그대로
  await page.mouse.move(x, y0)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) { await page.mouse.move(x, y0 - i * 5); await page.waitForTimeout(60) }
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(400)
  await expect(sheet).toHaveAttribute('data-snap', 'half')
  // 빠르게 30px: 튕긴 쪽으로 넘어간다
  await page.mouse.move(x, y0)
  await page.mouse.down()
  for (let i = 1; i <= 3; i++) await page.mouse.move(x, y0 - i * 10)
  await page.mouse.up()
  await expect(sheet).toHaveAttribute('data-snap', 'full')
})
