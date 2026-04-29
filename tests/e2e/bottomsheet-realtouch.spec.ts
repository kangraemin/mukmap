import { test, expect, Page } from '@playwright/test'

async function getTranslateY(page: Page): Promise<number> {
  return page.locator('[data-testid="bottom-sheet"]').evaluate((el) => {
    const m = (el as HTMLElement).style.transform.match(/translateY\((-?[\d.]+)px\)/)
    return m ? parseFloat(m[1]) : 0
  })
}

// Playwright page.mouse 기반 — mobile context(hasTouch:true,isMobile:true)에서
// touch + pointer event를 함께 emulate함 (실제 브라우저 input pipeline 통과)
async function realTouchDrag(
  page: Page,
  selector: string,
  deltaY: number,
) {
  const box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`no box for ${selector}`)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  await page.mouse.move(cx, cy)
  await page.mouse.down()
  // 한 번에 큰 deltaY 이동 (steps=10으로 부드럽게 분할)
  await page.mouse.move(cx, cy + deltaY, { steps: 10 })
  await page.mouse.up()
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
    await realTouchDrag(page, '[data-testid="bottom-sheet"]', 250)
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

    await realTouchDrag(page, '[data-testid="bottom-sheet"]', 200)
    const afterY = await getTranslateY(page)
    expect(afterY).toBeGreaterThan(halfY + 50)
  })
})
