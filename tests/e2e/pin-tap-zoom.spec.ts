import { test, expect, type Page } from '@playwright/test'

// 전국 지도에서 핀을 누르면 줌을 한 번에 7→15로 당겨, 흐린 타일이 수백 배로 커지며 지도가 앞으로 덮쳐 오는 느낌이었다.
// 카드 높이를 잰 뒤 움직이는 중의 줌으로 목표를 다시 정해 한 번 더 튀기도 했다(10/25 실기기 녹화).
// 핀을 누르면 세 단계까지만 당기고, 그 핀으로 가는 이동은 모두 같은 줌을 향한다
test.setTimeout(90_000)

type W = Window & { tapMap?: naver.maps.Map; morphZooms?: number[] }

async function uncoveredPin(page: Page) {
  const i = await page.locator('[data-pin]').evaluateAll((els) => els.findIndex((el) => {
    const r = el.getBoundingClientRect()
    if (!r.width || r.y < 150 || r.y > window.innerHeight * 0.55) return false
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return !!(top && el.contains(top))
  }))
  return i >= 0 ? page.locator('[data-pin]').nth(i) : null
}

test('전국 지도에서 핀을 누르면 세 단계까지만, 한 목표 줌으로 당긴다', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as W
    w.morphZooms = []
    const hook = () => {
      const M = (window as unknown as { naver?: typeof naver }).naver?.maps?.Map
      if (!M) return setTimeout(hook, 50)
      const getZoom = M.prototype.getZoom
      M.prototype.getZoom = function () { w.tapMap = this; return getZoom.call(this) }
      const morph = M.prototype.morph
      M.prototype.morph = function (...args: Parameters<typeof morph>) {
        w.morphZooms!.push(args[1] as number)
        return morph.apply(this, args)
      }
    }
    hook()
  })
  await page.goto('/')
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 10_000 })
  await expect(page.locator('[data-cluster], [data-pin]').first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(800)
  // 전국 줌에서 바로 누를 수 있는 낱개 핀. 없으면 묶음을 한 번씩 눌러 들어간다(그래도 줌이 11 이하일 때만 본다)
  let pin = await uncoveredPin(page)
  for (let i = 0; !pin && i < 3; i++) {
    const c = page.locator('[data-cluster]').first()
    await c.tap()
    await page.waitForTimeout(1200)
    pin = await uncoveredPin(page)
  }
  expect(pin).not.toBeNull()
  const before = await page.evaluate(() => (window as W).tapMap!.getZoom())
  expect(before).toBeLessThanOrEqual(11)
  await page.evaluate(() => { (window as W).morphZooms = [] })
  await pin!.tap()
  await expect(page.getByTestId('preview-card')).toBeVisible()
  await page.waitForTimeout(2500)
  const zooms = await page.evaluate(() => (window as W).morphZooms!)
  expect(zooms.length).toBeGreaterThan(0)
  expect(new Set(zooms).size, `목표 줌 ${zooms}`).toBe(1)
  expect(zooms[0] - before, `${before} → ${zooms[0]}`).toBeLessThanOrEqual(3)
  expect(zooms[0]).toBeGreaterThan(before)
  expect(await page.evaluate(() => (window as W).tapMap!.getZoom())).toBe(zooms[0])
})
