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

// 토스 앱으로 열기: 토스 링크를 받는 쪽처럼 풀면 웹에서 고른 조건이 미니앱에 그대로 넘어간다
function intossQuery(href: string) {
  const supertoss = new URL(href).searchParams.get('af_dp')!
  const intoss = new URLSearchParams(supertoss.split('?')[1]).get('redirect')!
  expect(intoss.startsWith('intoss://mukmap-kr')).toBe(true)
  return new URLSearchParams(intoss.slice(intoss.indexOf('?')))
}

test('목록의 토스 앱으로 열기는 지도 버튼 옆에 보이고, 고른 지역·구를 실어 토스 미니앱을 연다', async ({ page, request }) => {
  await page.goto(SEOUL)
  await page.getByTestId('facet-city').getByRole('button', { name: /^강남구/ }).click()
  const toss = page.getByTestId('open-toss')
  await expect(toss).toBeInViewport()
  // 지도 버튼과 겹치지 않고 화면 밖으로 잘리지 않는다
  const m = (await page.getByTestId('open-map').boundingBox())!
  const t = (await toss.boundingBox())!
  expect(t.x).toBeGreaterThanOrEqual(m.x + m.width)
  expect(t.x + t.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  const q = intossQuery((await toss.getAttribute('href'))!)
  expect([q.get('region'), q.get('city')]).toEqual(['서울', '강남구'])
  // 토스 링크 서버가 이 주소를 받아 준다
  const res = await request.get((await toss.getAttribute('href'))!, { maxRedirects: 0 })
  expect(res.status()).toBeLessThan(400)
})

test('가게 페이지의 토스 앱으로 열기는 그 가게 상세(place=)로 미니앱을 연다', async ({ page }) => {
  await page.goto('/restaurant/142')
  const toss = page.getByTestId('open-toss')
  await expect(toss).toBeVisible()
  expect(intossQuery((await toss.getAttribute('href'))!).get('place')).toBe('142')
})
