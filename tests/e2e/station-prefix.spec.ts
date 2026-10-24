import { test, expect } from '@playwright/test'

// 역 이름은 끝까지(구의역) 치지 않아도 앞 글자(구의, 구)만으로 검색 결과에 역이 뜬다
test.setTimeout(90_000)

// '구의'는 구의역, '구' 한 글자는 '구'로 시작하는 역(구남역 등)이 뜬다
for (const [q, hit] of [['구의', /구의역/], ['구', /📍 구\S*역/]] as const) {
  test(`'${q}'만 쳐도 역 검색 결과가 뜬다`, async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('pill-count')).toBeVisible({ timeout: 60_000 })
    await page.locator('input[type="search"]').first().fill(q)
    await expect(page.getByTestId('search-station').filter({ hasText: hit }).first()).toBeVisible({ timeout: 15_000 })
  })
}
