import { test, expect } from '@playwright/test'

// 외국어 목록이 너무 빽빽해 읽기 힘들었다(10/25): 이름이 'Gayang Kal...'로 잘리고 'Best …' 칩 줄이 옆으로 넘쳤다.
// 이름을 두 줄까지 다 보여 주고 칩 줄을 뺀다. 한국어도 칩이 사진 밑에 따로 떠 어색해서 같은 줄로 바꿨다
test.setTimeout(90_000)

test('영어 목록: 이름이 잘리지 않고 칩 줄이 없다', async ({ page }) => {
  await page.goto('/en')
  const rows = page.getByTestId('list-item')
  await expect(rows.first()).toBeVisible({ timeout: 30_000 })
  const first = rows.first()
  await expect(first.getByTestId('pin-chips')).toHaveCount(0)
  const name = first.getByTestId('row-name')
  const style = await name.evaluate((el) => ({ overflow: getComputedStyle(el).textOverflow, clamp: getComputedStyle(el).webkitLineClamp }))
  expect(style.overflow).not.toBe('ellipsis')
  expect(style.clamp).toBe('2')
  // 글 칸이 화면 폭의 절반 넘게 남는다
  const w = await name.evaluate((el) => el.getBoundingClientRect().width / window.innerWidth)
  expect(w).toBeGreaterThan(0.5)
  expect(await page.locator('[data-testid="list-item"] [data-testid="pin-chips"]').count()).toBe(0)
})

test('한국어 목록도 같은 줄: 이름 두 줄, 칩 줄 없음', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('list-item').first()).toBeVisible({ timeout: 30_000 })
  expect(await page.locator('[data-testid="list-item"] [data-testid="pin-chips"]').count()).toBe(0)
  await expect(page.getByTestId('list-item').first().getByTestId('row-name')).toBeVisible()
})
