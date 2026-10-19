import { test, expect } from '@playwright/test'

// 상세 요약(videos.detail)이 있는 가게: 지도 카드·목록·상세에 한 줄 평이 보이고, 안 말한 칸·자동 추출 안내는 없다.
// 142 = 요약이 저장된 가게(sMHukuYv5bE). 크론이 다시 추출해도 detail은 남는다

const ID = 142

test('핀 API가 요약 있는 가게에 한 줄 평·추천 정도를 담는다', async ({ request }) => {
  const res = await request.get('/api/pins')
  const body = await res.json()
  const pin = body.pins.find((p: { id: number }) => p.id === ID)
  expect(pin.verdict).toBeTruthy()
  expect(['강추', '추천', '보통', '아쉬움']).toContain(pin.rec)
  expect(pin.nv).toBeGreaterThan(0)
})

test('가게 페이지에 유튜버의 평과 나온 영상 목록이 있고 자동 추출 안내 문구는 없다', async ({ page }) => {
  await page.goto(`/restaurant/${ID}`)
  const review = page.getByTestId('detail-review').first()
  await expect(review).toBeVisible()
  await expect(review).toContainText('의 평')
  await expect(review.locator('p').first()).toHaveText(/^“.+”$/)
  await expect(page.getByTestId('detail-videos').locator('a').first()).toBeVisible()
  await expect(page.getByText('자동으로 뽑았')).toHaveCount(0)
  // 타임스탬프는 보여주지 않는다
  await expect(review).not.toContainText(/\d{1,2}:\d{2}/)
})

test('?place로 열면 상세에 평이 나오고, 뒤로 가면 지도 카드에 두 줄 이내 한 줄 평이 보인다', async ({ page }) => {
  await page.goto(`/?place=${ID}`)
  const detail = page.getByTestId('detail-view')
  await expect(detail.getByTestId('detail-review').first()).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('detail-back').click()
  // 상세를 연 가게로 지도가 옮겨져 있다. 그 핀을 누르면 카드가 뜬다
  await page.locator(`[data-pin="${ID}"]`).tap({ timeout: 30_000 })
  const card = page.getByTestId('preview-card')
  await expect(card).toBeVisible({ timeout: 15_000 })
  const verdict = card.getByTestId('card-verdict')
  await expect(verdict).toBeVisible()
  const h = (await verdict.boundingBox())!.height
  expect(h).toBeLessThan(15 * 1.45 * 2 + 4)
})
