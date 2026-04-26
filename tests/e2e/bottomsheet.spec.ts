import { test, expect, Page } from '@playwright/test'

async function getTranslateY(page: Page): Promise<number> {
  return page.locator('[data-testid="bottom-sheet"]').evaluate((el) => {
    const transform = (el as HTMLElement).style.transform
    const match = transform.match(/translateY\((-?[\d.]+)px\)/)
    return match ? parseFloat(match[1]) : 0
  })
}

// @use-gesture/react는 touch device에서 TouchEvents를 사용 — synthetic TouchEvent dispatch
async function simulateTouchDrag(page: Page, deltaY: number) {
  const box = await page.locator('[data-testid="sheet-handle"]').boundingBox()
  if (!box) return
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  await page.evaluate(([sx, sy, dy]: number[]) => {
    const el = document.querySelector('[data-testid="sheet-handle"]') as HTMLElement
    if (!el) return
    const mkTouch = (y: number) => new Touch({ identifier: 1, target: el, clientX: sx, clientY: y, pageX: sx, pageY: y })
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [mkTouch(sy)], targetTouches: [mkTouch(sy)], changedTouches: [mkTouch(sy)], bubbles: true, cancelable: true }))
    el.dispatchEvent(new TouchEvent('touchmove', { touches: [mkTouch(sy + dy)], targetTouches: [mkTouch(sy + dy)], changedTouches: [mkTouch(sy + dy)], bubbles: true, cancelable: true }))
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mkTouch(sy + dy)], bubbles: true, cancelable: true }))
  }, [cx, cy, deltaY] as number[])
  await page.waitForTimeout(500)
}

test.describe('BottomSheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="bottom-sheet"]')
    await page.waitForTimeout(300)
  })

  test('collapsed on initial load', async ({ page }) => {
    const translateY = await getTranslateY(page)
    expect(translateY).toBeGreaterThan(0)
  })

  test('swipe up expands to half', async ({ page }) => {
    const initialY = await getTranslateY(page)
    await simulateTouchDrag(page, -200)
    const afterY = await getTranslateY(page)
    expect(afterY).toBeLessThan(initialY)
  })

  test('swipe up again expands to full', async ({ page }) => {
    await simulateTouchDrag(page, -200) // collapsed → half
    await simulateTouchDrag(page, -200) // half → full
    const afterY = await getTranslateY(page)
    expect(afterY).toBeLessThanOrEqual(10) // ≈ 0
  })

  test('swipe down from full collapses to half', async ({ page }) => {
    await simulateTouchDrag(page, -200) // → half
    await simulateTouchDrag(page, -200) // → full
    const fullY = await getTranslateY(page)
    await simulateTouchDrag(page, 200)  // → half
    const afterY = await getTranslateY(page)
    expect(afterY).toBeGreaterThan(fullY)
  })

  test('realtime drag follows finger', async ({ page }) => {
    const initialY = await getTranslateY(page)
    const box = await page.locator('[data-testid="sheet-handle"]').boundingBox()
    if (!box) return
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.evaluate(([sx, sy]: number[]) => {
      const el = document.querySelector('[data-testid="sheet-handle"]') as HTMLElement
      if (!el) return
      const mkTouch = (y: number) => new Touch({ identifier: 1, target: el, clientX: sx, clientY: y, pageX: sx, pageY: y })
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [mkTouch(sy)], targetTouches: [mkTouch(sy)], changedTouches: [mkTouch(sy)], bubbles: true, cancelable: true }))
      el.dispatchEvent(new TouchEvent('touchmove', { touches: [mkTouch(sy - 30)], targetTouches: [mkTouch(sy - 30)], changedTouches: [mkTouch(sy - 30)], bubbles: true, cancelable: true }))
    }, [cx, cy] as number[])

    const duringDragY = await getTranslateY(page)
    expect(duringDragY).toBeLessThan(initialY)
  })

  test('snap back on small drag', async ({ page }) => {
    const initialY = await getTranslateY(page)
    await simulateTouchDrag(page, -20) // 20px < 아무 snap 경계 미달
    const afterY = await getTranslateY(page)
    expect(afterY).toBeCloseTo(initialY, -1) // ±10px 허용
  })
})
