import { test, expect, type Page } from '@playwright/test'

// 목록·역 페이지 위 지도 미리보기: 글 아래·목록 위에 자리를 먼저 잡고, 손으로 못 움직이며, 누르면 같은 조건의 전체 지도를 연다

const dots = (page: Page) => page.getByTestId('map-preview').locator('[data-dots]').getAttribute('data-dots')

test('지역 목록 페이지: h1 아래·목록 위에 지도 자리가 먼저 잡히고, 핀이 찍히며 손으로 못 움직인다', async ({ page }) => {
  await page.goto(`/region/${encodeURIComponent('서울')}`)
  const box = page.getByTestId('map-preview')
  await expect(box).toBeVisible()
  const [h1, map, count] = await Promise.all([
    page.locator('h1').boundingBox(),
    box.boundingBox(),
    page.getByTestId('list-count').boundingBox(),
  ])
  expect(map!.height).toBeGreaterThanOrEqual(160)
  // 지도가 뜬 뒤에도 실제로 그려지는 칸이 그 높이를 채운다(네이버 지도가 칸 위치를 바꿔 높이 0이 된 적이 있다)
  await expect.poll(() => box.locator('[data-dots]').evaluate((el) => el.clientHeight), { timeout: 30_000 }).toBeGreaterThanOrEqual(160)
  expect(map!.y).toBeGreaterThan(h1!.y + h1!.height)
  expect(count!.y).toBeGreaterThan(map!.y + map!.height)

  await expect.poll(async () => Number(await dots(page)), { timeout: 30_000 }).toBeGreaterThan(5)
  const opts = await box.locator('[data-dots]').evaluate((el) => {
    const m = (el as HTMLElement & { __map?: { getOptions: (k: string) => unknown } }).__map!
    return { drag: m.getOptions('draggable'), pinch: m.getOptions('pinchZoom'), wheel: m.getOptions('scrollWheel') }
  })
  expect(opts).toEqual({ drag: false, pinch: false, wheel: false })
})

test('지역 목록 페이지: 구 칩을 고르면 지도 핀도 줄고, 누르면 그 구에서 시작하는 전체 지도로 간다', async ({ page }) => {
  await page.goto(`/region/${encodeURIComponent('서울')}`)
  await expect.poll(async () => Number(await dots(page)), { timeout: 30_000 }).toBeGreaterThan(5)
  const before = Number(await dots(page))
  const chip = page.getByTestId('facet-city').getByRole('button').nth(1)
  const n = Number((await chip.innerText()).match(/(\d+)\s*$/)![1])
  await chip.click()
  await expect.poll(async () => Number(await dots(page))).toBe(Math.min(n, 300))
  expect(n).toBeLessThan(before)

  const href = (await page.getByTestId('map-preview-link').getAttribute('href'))!
  expect(href).toBe(await page.getByTestId('open-map').getAttribute('href'))
  const sp = new URLSearchParams(href.split('?')[1])
  expect(sp.get('area')).toBe('서울')
  expect(sp.get('area_city')).toBeTruthy()

  await page.getByTestId('map-preview-link').click()
  await expect(page).toHaveURL(/area_city=/)
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
})

test('역 맛집 페이지에도 지도 미리보기가 있고, 누르면 역에서 시작하는 지도로 간다', async ({ page }) => {
  await page.goto(`/station/${encodeURIComponent('홍대입구')}`)
  await expect.poll(async () => Number(await dots(page)), { timeout: 30_000 }).toBeGreaterThan(2)
  const href = (await page.getByTestId('map-preview-link').getAttribute('href'))!
  expect(new URLSearchParams(href.split('?')[1]).get('at')).toMatch(/^37\.5\d*,126\.9\d*$/)
})

test('자바스크립트 없이도 h1과 가게 목록 글은 그대로 HTML에 있다', async ({ request }) => {
  const html = await (await request.get(`/region/${encodeURIComponent('서울')}`)).text()
  expect(html).toContain('data-testid="map-preview"')
  expect(html).toMatch(/<h1[^>]*>서울 유튜버 맛집 \d+곳<\/h1>/)
  expect(html).toContain('href="/restaurant/')
})
