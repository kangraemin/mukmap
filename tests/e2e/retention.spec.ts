import { test, expect } from '@playwright/test'

// 머무는 시간·다시 오기: 가게 하나 보고 끝나지 않게 다음 후보를 잇고, 주마다 새로 볼 거리를 둔다

test('자동화 브라우저(Playwright 등)는 GA4에 방문으로 잡히지 않는다', async ({ request }) => {
  // 10/19~20 GA 방문 2,700명 중 2,650명이 e2e 기기 크기(393x727·390x664)였다
  const html = await (await request.get('/')).text()
  expect(html).toContain('!navigator.webdriver')
})

async function aRestaurantPath(request: import('@playwright/test').APIRequestContext) {
  const html = await (await request.get('/region/' + encodeURIComponent('서울'))).text()
  const m = html.match(/href="(\/restaurant\/\d+)"/)
  expect(m, '서울 목록에 가게 링크가 있어야 한다').toBeTruthy()
  return m![1]
}

test('가게 페이지 HTML(자바스크립트 없이)에 근처 다른 집 카드가 있다', async ({ request }) => {
  const path = await aRestaurantPath(request)
  const html = await (await request.get(path)).text()
  expect(html).toContain('근처 다른 집')
  const links = Array.from(html.matchAll(/href="(\/restaurant\/\d+)"[^>]*data-track="related_click"/g)).map((m) => m[1])
  expect(links.length).toBeGreaterThanOrEqual(1)
  expect(links.length).toBeLessThanOrEqual(6)
  expect(links).not.toContain(path) // 자기 자신은 빼고
  expect(html).toMatch(/\d+(\.\d)?(m|km)/) // 거리 표시
})

test('근처 다른 집을 누르면 related_click이 GA4로 간다', async ({ page, request }) => {
  const path = await aRestaurantPath(request)
  await page.goto(path)
  const card = page.locator('[data-track="related_click"]').first()
  await card.evaluate((el) => el.addEventListener('click', (e) => e.preventDefault()))
  await card.click()
  const names = await page.evaluate(() => ((window as unknown as { __mkEvents?: { name: string }[] }).__mkEvents ?? []).map((e) => e.name))
  expect(names).toContain('related_click')
})

test('홈 HTML에 이번 주 새 영상에 나온 곳이 있다', async ({ request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toContain('이번 주 새 영상에 나온 곳')
  const links = Array.from(html.matchAll(/href="\/restaurant\/\d+"[^>]*data-track="weekly_click"/g))
  expect(links.length).toBeGreaterThanOrEqual(1)
  expect(links.length).toBeLessThanOrEqual(12)
})

test('/this-week 페이지에 최근 7일 새 영상 가게가 있고 홈에서 링크된다', async ({ request }) => {
  const home = await (await request.get('/')).text()
  expect(home).toContain('href="/this-week"')
  const res = await request.get('/this-week')
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toMatch(/<h1[^>]*>이번 주 새로 뜬 맛집 \d+곳<\/h1>/)
  expect(html).toMatch(/\d+월 \d+일 새 영상/)
  expect(html).toMatch(/href="\/restaurant\/\d+"/)
})

test('sitemap에 /this-week가 있다', async ({ request }) => {
  expect(await (await request.get('/sitemap.xml')).text()).toContain('/this-week</loc>')
})
