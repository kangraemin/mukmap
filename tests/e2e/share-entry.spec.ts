import { test, expect, type Page } from '@playwright/test'

// 공유 링크로 들어왔을 때: 공유한 가게·조건이 바로 보이고, 뒤로가기·조건 풀기 같은 다음 동작이 어색하지 않다
const ID = 142
const TOSS = 'http://localhost:5174/'

const countOf = async (page: Page) => Number((await page.getByTestId('pill-count').textContent())!.replace(/\D/g, ''))

async function total(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  return countOf(page)
}

test('지도 카드 공유 링크(?pin)로 열면 그 가게 카드가 뜨고, 뒤로가면 카드만 닫혀 지도에 남는다', async ({ page }) => {
  await page.goto(`/?pin=${ID}`)
  const card = page.getByTestId('preview-card')
  await expect(card).toBeVisible({ timeout: 30_000 })
  // 지도가 그 가게로 옮겨져 핀이 화면에 있다
  await expect(page.locator(`[data-pin="${ID}"]`)).toBeVisible({ timeout: 30_000 })
  await card.getByRole('button', { name: /자세히 보기/ }).click()
  await expect(page.getByTestId('detail-view')).toBeVisible()

  await page.goBack()
  await expect(page.getByTestId('detail-view')).toHaveCount(0)
  await expect(card).toBeVisible()
  await page.goBack()
  await expect(card).toHaveCount(0)
  await expect(page.getByTestId('list-pill')).toBeVisible()
  // 닫은 뒤에도 그 핀을 다시 누를 수 있다
  await page.locator(`[data-pin="${ID}"]`).tap()
  await expect(card).toBeVisible()
})

test('상세 공유 링크(?place)로 열면 상세가 뜨고, 뒤로가면 지도로 돌아와 목록도 열린다', async ({ page }) => {
  await page.goto(`/?place=${ID}`)
  const detail = page.getByTestId('detail-view')
  await expect(detail.getByRole('link', { name: /길찾기/ })).toBeVisible({ timeout: 30_000 })
  await page.goBack()
  await expect(detail).toHaveCount(0)
  await page.getByTestId('list-pill').click()
  await expect(page.getByTestId('list-view')).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId('list-view')).toBeHidden()
})

test('검색 공유 링크(?q)로 열면 검색 조건이 걸려 있고, 풀면 전체로 돌아간다', async ({ page }) => {
  const all = await total(page)
  await page.goto(`/?q=${encodeURIComponent('국밥')}`)
  await expect(page.getByTestId('text-chip').first()).toHaveText(/국밥/, { timeout: 30_000 })
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  await expect.poll(() => countOf(page)).toBeLessThan(all)
  await page.getByTestId('text-chip').first().click()
  await expect(page.getByTestId('text-chip')).toHaveCount(0)
  await expect.poll(() => countOf(page), { timeout: 10_000 }).toBe(all)
})

test('유튜버·지역 공유 링크(?yt&region)로 열면 그 유튜버 칩이 눌려 있고 개수가 줄어 있다', async ({ page }) => {
  const all = await total(page)
  const res = await page.request.get('/api/channels')
  const ch = (await res.json()).channels.find((c: { slug: string | null; restaurant_count: number }) => c.slug && c.restaurant_count > 20)
  await page.goto(`/?yt=${encodeURIComponent(ch.slug)}&region=${encodeURIComponent('서울')}`)
  await expect(page.getByRole('button', { name: ch.name, pressed: true }).first()).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => countOf(page), { timeout: 30_000 }).toBeLessThan(all)
  await expect.poll(() => countOf(page)).toBeGreaterThan(0)
  // 목록을 열고 닫아도 조건이 그대로다
  const n = await countOf(page)
  await page.getByTestId('list-pill').click()
  await expect(page.getByTestId('list-view')).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId('list-view')).toBeHidden()
  expect(await countOf(page)).toBe(n)
})

// 토스 번들: 공유 버튼이 있고, 누르면 받은 사람이 같은 화면으로 들어올 주소를 만든다
async function openToss(page: Page, query = '') {
  await page.route('https://mukmap.kr/api/**', async (route) => {
    try {
      const res = await route.fetch()
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } })
    } catch {
      // 테스트가 먼저 끝나 페이지가 닫힌 경우
    }
  })
  await page.goto(`${TOSS}${query}`)
}

const shared = (page: Page) => page.evaluate(() => document.documentElement.dataset.mkShare)

test('토스: 상세 공유 버튼은 그 가게 상세 주소(place=)를 공유한다', async ({ page }) => {
  await openToss(page, `?place=${ID}`)
  const btn = page.getByTestId('share-detail')
  await expect(btn).toBeVisible({ timeout: 30_000 })
  await btn.click()
  await expect.poll(() => shared(page)).toBe(`place=${ID}`)
})

test('토스: 지도 카드 공유 버튼은 그 가게 카드 주소(pin=)를 공유한다', async ({ page }) => {
  await openToss(page, `?pin=${ID}`)
  const btn = page.getByTestId('share-place')
  await expect(btn).toBeVisible({ timeout: 30_000 })
  // 공유 버튼이 닫기 버튼·가게 이름과 겹치지 않는다
  const close = (await page.getByTestId('preview-card').getByRole('button', { name: '닫기' }).boundingBox())!
  const b = (await btn.boundingBox())!
  expect(b.x + b.width).toBeLessThanOrEqual(close.x + 1)
  await btn.click()
  await expect.poll(() => shared(page)).toBe(`pin=${ID}`)
})

test('토스: 검색 조건으로 들어오면 공유 버튼이 그 조건을 공유하고, 조건을 풀면 버튼이 사라진다', async ({ page }) => {
  await openToss(page, `?q=${encodeURIComponent('국밥')}`)
  const btn = page.getByTestId('share-filter')
  await expect(btn).toBeVisible({ timeout: 30_000 })
  await btn.click()
  await expect.poll(() => shared(page)).toBe(`q=${encodeURIComponent('국밥')}`)
  await page.getByTestId('text-chip').first().click()
  await expect(btn).toHaveCount(0)
})
