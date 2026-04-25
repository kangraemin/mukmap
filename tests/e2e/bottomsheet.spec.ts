import { test, expect, Page } from '@playwright/test'

async function getTranslateY(page: Page): Promise<number> {
  return page.locator('[data-testid="bottom-sheet"]').evaluate((el) => {
    const transform = (el as HTMLElement).style.transform
    const match = transform.match(/translateY\((-?[\d.]+)px\)/)
    return match ? parseFloat(match[1]) : 0
  })
}

async function simulateTouchDrag(page: Page, startY: number, deltaY: number) {
  await page.evaluate(([sy, dy]: [number, number]) => {
    const el = document.querySelector('[data-testid="bottom-sheet"]') as HTMLElement
    if (!el) return
    const cx = window.innerWidth / 2
    const mkTouch = (y: number) =>
      new Touch({ identifier: 1, target: el, clientX: cx, clientY: y })
    el.dispatchEvent(
      new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [mkTouch(sy)] })
    )
    el.dispatchEvent(
      new TouchEvent('touchmove', {
        bubbles: true,
        cancelable: true,
        touches: [mkTouch(sy + dy)],
      })
    )
    el.dispatchEvent(
      new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        changedTouches: [mkTouch(sy + dy)],
      })
    )
  }, [startY, deltaY] as [number, number])
  // 애니메이션 대기
  await page.waitForTimeout(400)
}

test.describe('BottomSheet 드래그 동작', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // 바텀시트가 초기화될 때까지 대기
    await page.waitForSelector('[data-testid="bottom-sheet"]')
    await page.waitForTimeout(300)
  })

  test('초기 상태: collapsed (translateY > 0)', async ({ page }) => {
    const translateY = await getTranslateY(page)
    expect(translateY).toBeGreaterThan(0)
  })

  test('위로 60px 스와이프 → half 전환 (translateY 감소)', async ({ page }) => {
    const initialY = await getTranslateY(page)
    const centerY = 700
    await simulateTouchDrag(page, centerY, -60)
    const afterY = await getTranslateY(page)
    expect(afterY).toBeLessThan(initialY)
  })

  test('half에서 위로 60px → full 전환 (translateY ≈ 0)', async ({ page }) => {
    const centerY = 700
    // collapsed → half
    await simulateTouchDrag(page, centerY, -60)
    // half → full
    await simulateTouchDrag(page, centerY, -60)
    const afterY = await getTranslateY(page)
    expect(afterY).toBeLessThanOrEqual(10) // ≈ 0
  })

  test('full에서 아래로 60px → half 전환 (translateY 증가)', async ({ page }) => {
    const centerY = 700
    await simulateTouchDrag(page, centerY, -60) // → half
    await simulateTouchDrag(page, centerY, -60) // → full
    const fullY = await getTranslateY(page)
    await simulateTouchDrag(page, centerY, 60) // → half
    const afterY = await getTranslateY(page)
    expect(afterY).toBeGreaterThan(fullY)
  })

  test('drag 중 touchmove 시 transform 실시간 변화', async ({ page }) => {
    const initialY = await getTranslateY(page)
    // touchstart + touchmove만 (touchend 없이)
    await page.evaluate((initial: number) => {
      const el = document.querySelector('[data-testid="bottom-sheet"]') as HTMLElement
      if (!el) return
      const cx = window.innerWidth / 2
      const startY = 700
      const mkTouch = (y: number) =>
        new Touch({ identifier: 1, target: el, clientX: cx, clientY: y })
      el.dispatchEvent(
        new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [mkTouch(startY)] })
      )
      el.dispatchEvent(
        new TouchEvent('touchmove', {
          bubbles: true,
          cancelable: true,
          touches: [mkTouch(startY - 30)],
        })
      )
    }, initialY)
    const duringDragY = await getTranslateY(page)
    expect(duringDragY).toBeLessThan(initialY)
  })

  test('30px 미만 스와이프 → snap-back (translateY 복원)', async ({ page }) => {
    const initialY = await getTranslateY(page)
    const centerY = 700
    await simulateTouchDrag(page, centerY, -20) // 20px < 50px threshold
    const afterY = await getTranslateY(page)
    expect(afterY).toBeCloseTo(initialY, -1) // ±10px 허용
  })
})
