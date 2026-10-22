import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// 웹(mukmap.kr) 공유·찜·역 맛집 페이지, 목록의 토스 앱 버튼

const TOSS = 'http://localhost:5174/'
const ID = 142

async function ready(page: Page, path = '/') {
  await page.goto(path)
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 15_000 })
  // 가게를 바로 열면 개수 알약 대신 카드·상세가 뜬다
  const shown = path.includes('pin=') ? 'preview-card' : path.includes('place=') ? 'detail-view' : null
  if (shown) await expect(page.getByTestId(shown)).toBeVisible({ timeout: 30_000 })
  else await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
}

// 휴대폰 공유창을 흉내 낸다. 받은 값을 window.__shared에 남긴다
async function stubShare(page: Page, withShare = true) {
  await page.addInitScript((on) => {
    const w = window as unknown as { __shared?: unknown; __copied?: string }
    Object.defineProperty(navigator, 'share', { configurable: true, value: on ? async (d: unknown) => { w.__shared = d } : undefined })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { w.__copied = t } } })
  }, withShare)
}
const shared = (page: Page) => page.evaluate(() => (window as unknown as { __shared?: { text: string; url: string } }).__shared)
const copied = (page: Page) => page.evaluate(() => (window as unknown as { __copied?: string }).__copied)

test('웹 지도 카드 공유는 휴대폰 공유창에 그 가게의 mukmap.kr 페이지 주소를 넘긴다', async ({ page, baseURL }) => {
  await stubShare(page)
  await ready(page, `/?pin=${ID}`)
  await page.getByTestId('share-place').click({ timeout: 30_000 })
  await expect.poll(() => shared(page)).toMatchObject({ url: `${baseURL}/restaurant/${ID}` })
  expect((await shared(page))!.text).toContain('먹맵에서')
})

test('웹 상세 공유도 가게 페이지 주소를 넘긴다', async ({ page, baseURL }) => {
  await stubShare(page)
  await ready(page, `/?place=${ID}`)
  await page.getByTestId('share-detail').click({ timeout: 30_000 })
  await expect.poll(() => shared(page)).toMatchObject({ url: `${baseURL}/restaurant/${ID}` })
})

test('웹 검색으로 거른 지도 공유는 같은 조건의 지도 주소를 넘긴다', async ({ page, baseURL }) => {
  await stubShare(page)
  await ready(page, `/?q=${encodeURIComponent('국밥')}`)
  await page.getByTestId('share-filter').click({ timeout: 30_000 })
  await expect.poll(() => shared(page)).toMatchObject({ url: `${baseURL}/?q=${encodeURIComponent('국밥')}` })
})

test('공유창이 없는 브라우저는 글과 링크를 복사하고 복사했다고 알린다', async ({ page, baseURL }) => {
  await stubShare(page, false)
  await ready(page, `/?pin=${ID}`)
  await page.getByTestId('share-place').click({ timeout: 30_000 })
  await expect.poll(() => copied(page)).toContain(`${baseURL}/restaurant/${ID}`)
  await expect(page.getByRole('status')).toHaveText('링크를 복사했어요')
})

test('웹 가게 페이지에도 공유 버튼이 있다', async ({ page, baseURL }) => {
  await stubShare(page)
  await page.goto(`/restaurant/${ID}`)
  await page.waitForLoadState('networkidle')
  await page.getByTestId('share-detail').click()
  await expect.poll(() => shared(page)).toMatchObject({ url: `${baseURL}/restaurant/${ID}` })
})

test('찜: 카드의 하트를 누르면 다시 열어도 남고, 목록의 찜 칩으로 찜한 곳만 본다', async ({ page }) => {
  await ready(page, `/?pin=${ID}`)
  const like = page.getByTestId('preview-card').getByTestId('like')
  await expect(like).toHaveAttribute('aria-pressed', 'false', { timeout: 30_000 })
  await like.click()
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status')).toHaveText('찜했어요')

  await ready(page, `/?pin=${ID}`)
  await expect(page.getByTestId('preview-card').getByTestId('like')).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 })
  await page.getByTestId('preview-card').getByRole('button', { name: '닫기' }).click()

  await page.getByTestId('list-pill').click()
  // 칩 줄은 지도 위와 목록 화면에 하나씩 있다. 목록을 열면 지도 쪽 칩은 가려진다
  await page.getByTestId('list-view').getByTestId('liked-chip').click()
  await expect(page.getByTestId('list-count')).toHaveText('1')
  await expect(page.getByTestId('list-item')).toHaveCount(1)

  // 상세에서 하트를 풀면 찜 칩이 사라진다
  await page.getByTestId('list-item').first().click()
  await page.getByTestId('detail-view').getByTestId('like').click()
  await expect(page.getByTestId('detail-view').getByTestId('like')).toHaveAttribute('aria-pressed', 'false')
})

test('토스 앱 찜도 다시 열면 남는다', async ({ page }) => {
  await page.route('https://mukmap.kr/api/**', async (route) => {
    try {
      const res = await route.fetch()
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } })
    } catch {
      // 테스트가 먼저 끝나 페이지가 닫힌 경우
    }
  })
  await page.goto(`${TOSS}?pin=${ID}`)
  const like = page.getByTestId('preview-card').getByTestId('like')
  await like.click({ timeout: 30_000 })
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  // 저장은 비동기다. 앱 밖에선 토스 저장소가 실패해 localStorage로 남는데, 그 전에 다시 열면 찜이 사라진다(PC가 바쁠 때)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mukmap:likes:v1') || ''), { timeout: 15_000 }).toContain(String(ID))
  await page.goto(`${TOSS}?pin=${ID}`)
  await expect(page.getByTestId('preview-card').getByTestId('like')).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 })
})

test('역 맛집 페이지: 홍대입구역 1km 안 가게를 가까운 순으로 보여 주고, 지도는 역에서 시작한다', async ({ page }) => {
  const res = await page.goto(`/station/${encodeURIComponent('홍대입구')}`)
  expect(res!.status()).toBe(200)
  await expect(page.locator('h1')).toContainText('홍대입구역 맛집')
  await expect(page).toHaveTitle(/홍대입구역 맛집/)
  const walks = await page.getByTestId('walk').allInnerTexts()
  expect(walks.length).toBeGreaterThan(2)
  const mins = walks.map((t) => Number(t.match(/(\d+)분/)![1]))
  expect(mins).toEqual([...mins].sort((a, b) => a - b))
  expect(Math.max(...mins)).toBeLessThanOrEqual(15)
  // 지도로 가는 길은 위 지도를 크게 연 뒤 '전체 지도' 하나다
  await page.getByTestId('map-expand').click()
  const href = (await page.getByTestId('open-map').getAttribute('href'))!
  const at = new URLSearchParams(href.split('?')[1]).get('at')!
  const [lat, lng] = at.split(',').map(Number)
  expect(Math.abs(lat - 37.557)).toBeLessThan(0.01)
  expect(Math.abs(lng - 126.924)).toBeLessThan(0.01)
  // 지도로 넘어가면 가게를 거르지 않고 역 근처에서 시작한다
  await page.getByTestId('open-map').click()
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  await expect(page.getByTestId('place-chip')).toHaveCount(0)
})

test('없는 역은 404, 사이트맵에 역 페이지가 들어 있다', async ({ page, request }) => {
  const res = await page.goto(`/station/${encodeURIComponent('없던역이름')}`)
  expect(res!.status()).toBe(404)
  const xml = await (await request.get('/sitemap.xml')).text()
  expect(xml).toContain(`/station/${encodeURIComponent('홍대입구')}`)
})

// 목록 페이지 아래 '토스 앱으로 열기'가 밝은·어두운 화면 모두에서 바탕과 또렷이 구분된다
function lum(rgb: string) {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

for (const scheme of ['light', 'dark'] as const) {
  test(`목록 페이지 토스 앱 버튼이 ${scheme} 화면에서 바탕과 구분되고 글씨가 읽힌다`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto(`/region/${encodeURIComponent('서울')}`)
    const btn = page.getByTestId('open-toss')
    await expect(btn).toBeVisible()
    const c = await btn.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color, page: getComputedStyle(document.body).backgroundColor }))
    expect(ratio(c.bg, c.page)).toBeGreaterThanOrEqual(3)
    expect(ratio(c.fg, c.bg)).toBeGreaterThanOrEqual(4.5)
  })
}

test('홈 HTML(자바스크립트 없이)에 오구리웍스 다른 서비스 링크가 있다', async ({ request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toContain('href="https://kangraemin.github.io/oneul-kkum/"')
  expect(html).toContain('생활 계산기')
})
