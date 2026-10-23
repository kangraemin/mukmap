import { test, expect, type Page } from '@playwright/test'

// 사용자 지시(2026-10-23): 다크모드는 지도만 밝게 남아 어색하니 없앤다, 다 펼친 목록은 끌어서 내릴 수 있어야 한다, '강추만' 보기

async function ready(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
}

// 반쯤일 땐 머리줄 pill-count, 다 펼치면 제목 list-count에 개수가 있다
const count = async (page: Page) => Number((await page.locator('[data-testid=pill-count], [data-testid=list-count]').first().textContent())!.replace(/\D/g, ''))

test('폰이 다크모드여도 화면은 밝게 나온다', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await ready(page)
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(255, 255, 255)')
  expect(await page.getByTestId('list-view').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
  expect(await page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')))).toEqual(['#FFFFFF'])
})

test('다 펼친 목록을 맨 위에서 손가락으로 끌어내리면 반쯤으로 내려간다', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', '손가락 끌기는 CDP 터치로만 흉내 낼 수 있다')
  await ready(page)
  await page.getByTestId('list-pill').click()
  const sheet = page.getByTestId('list-view')
  await expect(sheet).toHaveAttribute('data-snap', 'full')
  // 사람처럼 시트가 다 올라와 멈춘 뒤 잡는다(펼쳐지는 그 프레임엔 새 터치 리스너가 아직 안 걸려 있을 수 있다)
  let h = 0
  await expect.poll(async () => { const prev = h; h = (await sheet.boundingBox())!.height; return h === prev }, { intervals: [100] }).toBe(true)
  const b = (await sheet.getByTestId('list-item').first().boundingBox())!
  const x = b.x + b.width / 2
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', b.y + 20)
  for (let i = 1; i <= 12; i++) {
    await touch('touchMove', b.y + 20 + i * 30)
    await page.waitForTimeout(16)
  }
  await touch('touchEnd', 0)
  await expect(sheet).not.toHaveAttribute('data-snap', 'full')
})

test('강추만 칩을 누르면 강추 가게만 남고, 다시 누르면 돌아온다', async ({ page }) => {
  await ready(page)
  const before = await count(page)
  const chip = page.locator('[data-testid=strong-chip] >> visible=true').first()
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => count(page)).toBeLessThan(before)
  const strong = await count(page)
  expect(strong).toBeGreaterThan(0)
  await page.getByTestId('list-pill').click()
  const badges = await page.getByTestId('list-item').evaluateAll((els) => els.slice(0, 8).map((e) => e.textContent?.includes('강추')))
  expect(badges.length).toBeGreaterThan(0)
  expect(badges.every(Boolean)).toBe(true)
  // 다 펼치면 지도 위 칩은 시트에 가려지고, 시트 안 칩을 누른다
  const inSheet = page.getByTestId('list-view').getByTestId('strong-chip')
  await inSheet.click()
  await expect(inSheet).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => count(page)).toBeGreaterThan(strong)
})
