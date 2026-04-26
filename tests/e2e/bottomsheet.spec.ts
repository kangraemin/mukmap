import { test, expect, Page } from '@playwright/test'

async function getTranslateY(page: Page): Promise<number> {
  return page.locator('[data-testid="bottom-sheet"]').evaluate((el) => {
    const transform = (el as HTMLElement).style.transform
    const match = transform.match(/translateY\((-?[\d.]+)px\)/)
    return match ? parseFloat(match[1]) : 0
  })
}

// @use-gesture/react Pointer Events 모드 — buttons:1 필수 (drag 인식 조건)
async function simulateDrag(page: Page, deltaY: number) {
  const box = await page.locator('[data-testid="sheet-handle"]').boundingBox()
  if (!box) return
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  await page.evaluate(([sx, sy, dy]: number[]) => {
    const el = document.querySelector('[data-testid="sheet-handle"]') as HTMLElement
    if (!el) return
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, buttons: 1, clientX: sx, clientY: sy, pointerType: 'touch' }))
    el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, buttons: 1, clientX: sx, clientY: sy + dy, pointerType: 'touch' }))
    el.dispatchEvent(new PointerEvent('pointerup',   { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, buttons: 0, clientX: sx, clientY: sy + dy, pointerType: 'touch' }))
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
    await simulateDrag(page, -200)
    const afterY = await getTranslateY(page)
    expect(afterY).toBeLessThan(initialY)
  })

  test('swipe up again expands to full', async ({ page }) => {
    await simulateDrag(page, -200) // collapsed → half
    await simulateDrag(page, -200) // half → full
    const afterY = await getTranslateY(page)
    expect(afterY).toBeLessThanOrEqual(10) // ≈ 0
  })

  test('swipe down from full collapses to half', async ({ page }) => {
    await simulateDrag(page, -200) // → half
    await simulateDrag(page, -200) // → full
    const fullY = await getTranslateY(page)
    await simulateDrag(page, 200)  // → half
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
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, buttons: 1, clientX: sx, clientY: sy, pointerType: 'touch' }))
      el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, buttons: 1, clientX: sx, clientY: sy - 30, pointerType: 'touch' }))
    }, [cx, cy] as number[])

    const duringDragY = await getTranslateY(page)
    expect(duringDragY).toBeLessThan(initialY)
  })

  test('snap back on small drag', async ({ page }) => {
    const initialY = await getTranslateY(page)
    await simulateDrag(page, -20) // 20px < 아무 snap 경계 미달
    const afterY = await getTranslateY(page)
    expect(afterY).toBeCloseTo(initialY, -1) // ±10px 허용
  })
})
