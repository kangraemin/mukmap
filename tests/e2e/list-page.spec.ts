import { test, expect } from '@playwright/test'

// 지역·유튜버 목록 페이지: 칩을 누르면 그 자리에서 걸러지고, 지도 버튼은 늘 화면에 보인다

const SEOUL = '/region/' + encodeURIComponent('서울')

test('구 칩을 누르면 그 구 가게만 남는다', async ({ page }) => {
  await page.goto(SEOUL)
  const count = page.getByTestId('list-count')
  const total = Number((await count.textContent())!.replace(/\D/g, ''))
  await page.getByTestId('facet-city').getByRole('button', { name: /^강남구/ }).click()
  await expect(count).not.toHaveText(`${total}곳`)
  const n = Number((await count.textContent())!.replace(/\D/g, ''))
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThan(total)
  const areas = await page.locator('ol li a').evaluateAll((els) => els.slice(0, 10).map((e) => e.textContent || ''))
  for (const a of areas) expect(a).toContain('강남')
  await expect(page.getByTestId('open-map')).toHaveAttribute('href', /city=%EA%B0%95%EB%82%A8%EA%B5%AC/)
})

test('유튜버 칩을 누르면 그 유튜버가 간 가게만 남는다', async ({ page }) => {
  await page.goto(SEOUL)
  const count = page.getByTestId('list-count')
  const total = Number((await count.textContent())!.replace(/\D/g, ''))
  const chip = page.getByTestId('facet-channel').getByRole('button').nth(1)
  const name = (await chip.textContent())!.replace(/\d+$/, '')
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  const n = Number((await count.textContent())!.replace(/\D/g, ''))
  expect(n).toBeLessThan(total)
  const first = await page.locator('ol li a').first().textContent()
  expect(first).toContain(name)
  await expect(page.getByTestId('open-map')).toHaveAttribute('href', /yt=/)
})

test('지도로 보기 버튼이 스크롤해도 화면 안에 있다', async ({ page }) => {
  await page.goto(SEOUL)
  const btn = page.getByTestId('open-map')
  await expect(btn).toBeInViewport()
  await page.evaluate(() => window.scrollTo(0, 3000))
  await expect(btn).toBeInViewport()
})
