import { test, expect, type Page } from '@playwright/test'

// 지역·유튜버 목록 페이지: 칩을 누르면 그 자리에서 걸러지고, 지도로 가는 길은 위 지도의 큰 지도 '전체 지도' 하나다

const SEOUL = '/region/' + encodeURIComponent('서울')

/** 위 작은 지도의 '크게 보기'를 눌러 큰 지도를 열고 '전체 지도' 링크를 돌려준다 */
async function mapLink(page: Page) {
  await page.getByTestId('map-expand').click()
  await expect(page.getByTestId('list-map')).toHaveAttribute('data-full', '1')
  return page.getByTestId('open-map')
}

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
  await expect(await mapLink(page)).toHaveAttribute('href', /area_city=%EA%B0%95%EB%82%A8%EA%B5%AC/)
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
  await expect(await mapLink(page)).toHaveAttribute('href', /yt=/)
})

test('목록 페이지의 지도 버튼은 하나다: 위 머리말·화면 아래엔 없고, 큰 지도 위 "전체 지도"만 있다', async ({ page }) => {
  // 사용자 지적(2026-10-21): 위 '지도 보기', 아래 '지도로 보기', 본문 지도까지 세 곳이라 헷갈렸다
  await page.goto(SEOUL)
  await expect(page.locator('header').getByRole('link', { name: '지도 보기' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /지도로 보기/ })).toHaveCount(0)
  await expect(page.getByTestId('open-map')).toHaveCount(0)
  const link = await mapLink(page)
  await expect(link).toBeInViewport()
  await expect(link).toHaveText('전체 지도')
})

// 토스 앱으로 열기: 토스 링크를 받는 쪽처럼 풀면 웹에서 고른 조건이 미니앱에 그대로 넘어간다
function intossQuery(href: string) {
  const supertoss = new URL(href).searchParams.get('af_dp')!
  const intoss = new URLSearchParams(supertoss.split('?')[1]).get('redirect')!
  expect(intoss.startsWith('intoss://mukmap-kr')).toBe(true)
  return new URLSearchParams(intoss.slice(intoss.indexOf('?')))
}

test('목록의 토스 앱으로 열기는 화면 아래 가운데 떠 있고, 고른 지역·구를 실어 토스 미니앱을 연다', async ({ page, request }) => {
  await page.goto(SEOUL)
  await page.getByTestId('facet-city').getByRole('button', { name: /^강남구/ }).click()
  const toss = page.getByTestId('open-toss')
  await expect(toss).toBeInViewport()
  await page.evaluate(() => window.scrollTo(0, 3000))
  await expect(toss).toBeInViewport()
  // 화면 밖으로 잘리지 않고 가운데 있다
  const t = (await toss.boundingBox())!
  const w = page.viewportSize()!.width
  expect(t.x).toBeGreaterThanOrEqual(0)
  expect(t.x + t.width).toBeLessThanOrEqual(w)
  expect(Math.abs(t.x + t.width / 2 - w / 2)).toBeLessThan(2)
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

test('목록에서 구를 골라 지도로 가면 가게를 거르지 않고 그 구에서 지도를 시작하고, 목록으로 돌아갈 수 있다', async ({ page }) => {
  // 사용자 결정(2026-10-21): 검색으로 목록에 온 사람이 지도를 밀면 옆 동네 가게도 보여야 한다
  test.setTimeout(90_000)
  await page.goto(SEOUL)
  await page.getByTestId('facet-city').getByRole('button', { name: /^강남구/ }).click()
  await (await mapLink(page)).click()
  await expect(page).toHaveURL(/area_city=/)
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  await expect(page.getByTestId('place-chip')).toHaveCount(0)
  // 지도가 강남구로 옮겨 간다 (강남구 가운데 37.50, 127.05 근처)
  await expect.poll(() => page.evaluate(() => {
    const el = document.querySelector('[data-testid="map"]') as HTMLElement & { __map?: naver.maps.Map }
    const c = el?.__map?.getCenter()
    return c ? Math.abs(c.lat() - 37.5) < 0.05 && Math.abs(c.lng() - 127.05) < 0.06 : false
  }), { timeout: 15_000 }).toBe(true)

  // 목록으로 = 뒤로가기: 왔던 서울 목록 페이지로 돌아가고, 앞으로 가면 다시 지도다
  await page.getByTestId('back-to-list').locator('visible=true').click()
  await expect(page).toHaveURL(new RegExp(`${SEOUL}$`))
  await expect(page.getByTestId('map-preview')).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(/area_city=/)
})

test('지도 링크로 바로 들어오면 목록으로는 그 목록 주소로 간다', async ({ page }) => {
  await page.goto(`/?region=${encodeURIComponent('서울')}&from=${encodeURIComponent(SEOUL)}`)
  await page.getByTestId('back-to-list').locator('visible=true').click()
  await expect(page).toHaveURL(new RegExp(`${SEOUL}$`))
})

test('홈에서 바로 연 지도엔 목록으로 버튼이 없다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  await expect(page.getByTestId('back-to-list')).toHaveCount(0)
  await expect(page.getByTestId('place-chip')).toHaveCount(0)
})
