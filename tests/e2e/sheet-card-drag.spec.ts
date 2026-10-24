import { test, expect } from '@playwright/test'

// 사용자 녹화(2026-10-24 09:13): 반쯤 올라온 목록의 가게 카드를 잡고 세 번 끌어내렸는데 시트가 꿈쩍하지 않고 카드만 눌렸다
test('반쯤 올라온 목록은 가게 카드를 잡고 끌어내려도 내려가고, 카드는 열리지 않는다', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', '손가락 끌기는 CDP 터치로만 흉내 낼 수 있다')
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  const sheet = page.getByTestId('list-view')
  await expect(sheet).toHaveAttribute('data-snap', 'half')
  const card = (await sheet.getByTestId('list-item').first().boundingBox())!
  const x = card.x + card.width / 2
  const y0 = card.y + 20
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', y0)
  for (let i = 1; i <= 10; i++) {
    await touch('touchMove', y0 + i * 25)
    await page.waitForTimeout(16)
  }
  await touch('touchEnd', 0)
  await expect(sheet).toHaveAttribute('data-snap', 'peek')
  await expect(page.getByTestId('detail')).toHaveCount(0)
})

// 같은 녹화를 iOS 시뮬레이터로 재현: 썸네일을 꾹 누르면 사진 메뉴(공유·사진 앱에 저장)가, 글자를 꾹 누르면 글자 선택이 떠서 끌기를 가져갔다
test('목록 시트는 꾹 눌러도 글자 선택·사진 끌기가 시작되지 않는다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  const sheet = page.getByTestId('list-view')
  await expect(sheet.getByTestId('list-item').first()).toBeVisible()
  // 시트에 건 user-select:none은 안쪽 글자 모두에 미친다(WebKit은 자식의 계산값을 text로 보고해 시트에서 본다)
  const st = await sheet.evaluate((el) => {
    const cs = getComputedStyle(el)
    const img = el.querySelector('[data-testid="list-item"] img') as HTMLImageElement | null
    return { select: cs.userSelect || cs.webkitUserSelect, drag: img ? img.draggable : 'no img' }
  })
  expect(st).toEqual({ select: 'none', drag: false })
})
