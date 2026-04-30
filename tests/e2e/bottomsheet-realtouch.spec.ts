import { test, expect, Page } from '@playwright/test'

async function getTranslateY(page: Page): Promise<number> {
  return page.locator('[data-testid="bottom-sheet"]').evaluate((el) => {
    const m = (el as HTMLElement).style.transform.match(/translateY\((-?[\d.]+)px\)/)
    return m ? parseFloat(m[1]) : 0
  })
}

// PointerEvent dispatch 기반 multi-step drag (use-gesture가 touch로 인식)
// page.mouse가 mobile emulation 환경에서 use-gesture까지 도달하지 못하는 한계를 우회
async function realTouchDrag(
  page: Page,
  selector: string,
  deltaY: number,
  steps = 10,
) {
  const box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`no box for ${selector}`)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  await page.evaluate(
    ([sel, sx, sy, dy, n]: [string, number, number, number, number]) => {
      const el = document.querySelector(sel) as HTMLElement
      if (!el) throw new Error('no el')

      el.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerId: 1, isPrimary: true,
        button: 0, buttons: 1, clientX: sx, clientY: sy, pointerType: 'touch',
      }))

      for (let i = 1; i <= n; i++) {
        const y = sy + (dy * i) / n
        el.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, cancelable: true, pointerId: 1, isPrimary: true,
          button: 0, buttons: 1, clientX: sx, clientY: y, pointerType: 'touch',
        }))
      }

      el.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true, pointerId: 1, isPrimary: true,
        button: 0, buttons: 0, clientX: sx, clientY: sy + dy, pointerType: 'touch',
      }))
    },
    [selector, cx, cy, deltaY, steps] as [string, number, number, number, number]
  )
  await page.waitForTimeout(500)
}

test.describe('BottomSheet realtouch (WebKit/iOS)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="bottom-sheet"]')
    await page.waitForTimeout(300)
  })

  // RED 케이스 1: full 상태에서 콘텐츠 영역 잡고 아래로 드래그 → half로 줄어야 함
  test('drag DOWN on content from full → collapses', async ({ page }) => {
    // full로 만들기 (핸들 두 번 위로)
    await realTouchDrag(page, '[data-testid="sheet-handle"]', -300)
    await realTouchDrag(page, '[data-testid="sheet-handle"]', -300)
    const fullY = await getTranslateY(page)
    expect(fullY).toBeLessThanOrEqual(10)

    // 콘텐츠를 잡고 아래로 → half/collapsed로 가야 함
    await realTouchDrag(page, '[data-testid="sheet-content"]', 250)
    const afterY = await getTranslateY(page)
    expect(afterY).toBeGreaterThan(fullY + 100) // 최소 100px는 내려가야 함
  })

  // RED 케이스 2: 핸들 드래그 다운 (iOS WebKit 환경에서)
  test('drag DOWN on handle from full → collapses', async ({ page }) => {
    await realTouchDrag(page, '[data-testid="sheet-handle"]', -300)
    const halfY = await getTranslateY(page)

    await realTouchDrag(page, '[data-testid="sheet-handle"]', 300)
    const afterY = await getTranslateY(page)
    expect(afterY).toBeGreaterThan(halfY + 50)
  })

  // RED 케이스 3: half 상태에서 콘텐츠 잡고 아래로 → collapsed로 가야 함
  test('drag DOWN on content from half → collapses', async ({ page }) => {
    await realTouchDrag(page, '[data-testid="sheet-handle"]', -200)
    const halfY = await getTranslateY(page)

    await realTouchDrag(page, '[data-testid="sheet-content"]', 200)
    const afterY = await getTranslateY(page)
    expect(afterY).toBeGreaterThan(halfY + 50)
  })
})
