import { test, expect } from '@playwright/test'

// 사용자 지시(2026-10-24): 폰에서 목록 시트를 끌면 버벅인다. 끄는 동안 높이를 바꾸면 목록 전체를 매 프레임 다시 배치하니
// 높이는 그대로 두고 transform으로만 옮겨야 한다

test('목록 시트를 끄는 동안 높이는 그대로고 위치만 따라 움직이며, 손을 떼면 단계 높이로 돌아온다', async ({ page }) => {
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
    const r = await sheet.evaluate((el: HTMLElement) => ({ h: el.offsetHeight, top: el.getBoundingClientRect().top }))
    heights.push(r.h)
    tops.push(r.top)
  }
  await page.mouse.up()
  // 첫 움직임에 한 번 펴진 뒤로는 높이가 바뀌지 않는다
  expect(new Set(heights).size).toBe(1)
  // 보이는 윗변은 손가락을 따라 올라간다
  for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeLessThan(tops[i - 1])
  // 다 펼친 뒤엔 transform 없이 단계 높이로 멈춘다
  await expect(sheet).toHaveAttribute('data-snap', 'full')
  await expect.poll(() => sheet.evaluate((el) => el.style.transform)).toBe('')
  const b = (await sheet.boundingBox())!
  expect(Math.abs(b.y + b.height - vp.height)).toBeLessThan(2)
})
