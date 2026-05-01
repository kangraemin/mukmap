import { test, expect, Page } from '@playwright/test'

async function getTranslateY(page: Page): Promise<number> {
  return page.locator('[data-testid="bottom-sheet"]').evaluate((el) => {
    const m = (el as HTMLElement).style.transform.match(/translateY\((-?[\d.]+)px\)/)
    return m ? parseFloat(m[1]) : 0
  })
}

async function realTouchDrag(page: Page, selector: string, deltaY: number, steps = 10) {
  const box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`no box for ${selector}`)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.evaluate(
    ([sel, sx, sy, dy, n]: [string, number, number, number, number]) => {
      const el = document.querySelector(sel) as HTMLElement
      if (!el) throw new Error('no el')
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, buttons: 1, clientX: sx, clientY: sy, pointerType: 'touch' }))
      for (let i = 1; i <= n; i++) {
        const y = sy + (dy * i) / n
        el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, buttons: 1, clientX: sx, clientY: y, pointerType: 'touch' }))
      }
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0, buttons: 0, clientX: sx, clientY: sy + dy, pointerType: 'touch' }))
    },
    [selector, cx, cy, deltaY, steps] as [string, number, number, number, number]
  )
  await page.waitForTimeout(500)
}

test.describe('BottomSheet UX fix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="bottom-sheet"]')
    await page.waitForTimeout(300)
  })

  test('handle drag: pointermove defaultPrevented (background scroll blocked)', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__prevented = false
      // bubble 페이즈(target 이후)에서 체크 — capture는 target보다 먼저 실행돼 아직 false
      document.addEventListener('pointermove', (e) => {
        if (e.defaultPrevented) (window as any).__prevented = true
      })
    })
    await realTouchDrag(page, '[data-testid="sheet-handle"]', -100)
    const prevented = await page.evaluate(() => (window as any).__prevented)
    expect(prevented).toBe(true)
  })

  test('overscroll dismiss: content at scrollTop=0 drag down → sheet collapses', async ({ page }) => {
    await realTouchDrag(page, '[data-testid="sheet-handle"]', -300)
    await realTouchDrag(page, '[data-testid="sheet-handle"]', -300)
    const fullY = await getTranslateY(page)
    expect(fullY).toBeLessThanOrEqual(10)
    const scrollTop = await page.locator('[data-testid="sheet-content"]').evaluate(el => (el as HTMLElement).scrollTop)
    expect(scrollTop).toBe(0)
    await realTouchDrag(page, '[data-testid="sheet-content"]', 200)
    const afterY = await getTranslateY(page)
    expect(afterY).toBeGreaterThan(fullY + 100)
  })

  test('native scroll not blocked: scrollTop>0 drag down → sheet stays', async ({ page }) => {
    await realTouchDrag(page, '[data-testid="sheet-handle"]', -300)
    await realTouchDrag(page, '[data-testid="sheet-handle"]', -300)
    const fullY = await getTranslateY(page)
    await page.locator('[data-testid="sheet-content"]').evaluate(el => { (el as HTMLElement).scrollTop = 100 })
    await realTouchDrag(page, '[data-testid="sheet-content"]', 100)
    const afterY = await getTranslateY(page)
    expect(afterY).toBeCloseTo(fullY, -1)
  })
})
