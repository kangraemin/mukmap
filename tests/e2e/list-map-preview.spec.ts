import { test, expect, type Page } from '@playwright/test'

// 목록·역 페이지 위 지도: 얼굴 핀이 찍히고, 핀을 누르면 큰 지도와 그 가게 카드가 뜨며, 큰 지도를 옮겨 다시 찾으면 목록이 그 지역으로 통째 바뀐다

const STATION = `/station/${encodeURIComponent('홍대입구')}`
const REGION = `/region/${encodeURIComponent('서울')}`
const box = (page: Page) => page.getByTestId('list-map')
const marks = (page: Page) => box(page).locator('[data-pin], [data-cluster]')

/** 지도 위 지점을 누른 것처럼 그 위치 맨 위 요소를 돌려준다 */
const topAt = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => {
  const el = document.elementFromPoint(x, y)
  return el?.closest('[data-testid]')?.getAttribute('data-testid') ?? null
}, [x, y])

const mapOpts = (page: Page) => box(page).getByTestId('map').evaluate((el) => {
  const m = (el as HTMLElement & { __map?: { getOptions: (k: string) => unknown } }).__map!
  return { drag: m.getOptions('draggable'), pinch: m.getOptions('pinchZoom') }
})

/** 큰 지도를 손가락으로 민다 */
async function drag(page: Page) {
  const vp = page.viewportSize()!
  const x = vp.width / 2
  const y = vp.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(x - i * 20, y - i * 12)
  await page.mouse.up()
}

/** 작은 지도의 핀 하나를 눌러 큰 지도 + 카드를 띄운다. 핀이 다 묶여 있으면 묶음을 눌러 큰 지도에서 핀을 고른다 */
async function openPin(page: Page) {
  await expect(marks(page).first()).toBeVisible({ timeout: 30_000 })
  const single = box(page).locator('[data-pin]')
  if (await single.count()) await single.first().click()
  else {
    await box(page).locator('[data-cluster]').first().click()
    await expect(box(page)).toHaveAttribute('data-full', '1')
    await expect(box(page).locator('[data-pin]').first()).toBeVisible({ timeout: 15_000 })
    await box(page).locator('[data-pin]').first().click()
  }
  await expect(page.getByTestId('preview-card')).toBeVisible()
}

test('지역 목록 페이지: h1 아래·목록 위 지도에 얼굴 핀이 찍히고, 작은 지도는 손으로 못 민다', async ({ page }) => {
  await page.goto(REGION)
  const preview = page.getByTestId('map-preview')
  await expect(preview).toBeVisible()
  const [h1, map, count] = await Promise.all([
    page.locator('h1').boundingBox(),
    preview.boundingBox(),
    page.getByTestId('list-count').boundingBox(),
  ])
  expect(map!.height).toBeGreaterThanOrEqual(200)
  expect(map!.y).toBeGreaterThan(h1!.y + h1!.height)
  expect(count!.y).toBeGreaterThan(map!.y + map!.height)
  // 검은 점이 아니라 유튜버 얼굴 핀
  await expect(marks(page).first()).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => box(page).locator('[data-pin] img, [data-cluster] img').count(), { timeout: 30_000 }).toBeGreaterThan(0)
  expect(await mapOpts(page)).toEqual({ drag: false, pinch: false })
  // '크게 보기'는 지도 밖 따로 떨어진 막대가 아니라 지도 안 오른쪽 위에 붙어 있다(사용자 지적 2026-10-21)
  const ex = page.getByTestId('map-expand')
  await expect(ex).toHaveText(/크게 보기\s*\d+곳/)
  const eb = (await ex.boundingBox())!
  expect(eb.y).toBeGreaterThanOrEqual(map!.y)
  expect(eb.y + eb.height).toBeLessThanOrEqual(map!.y + map!.height / 2)
  expect(eb.x + eb.width).toBeLessThanOrEqual(map!.x + map!.width)
  expect(eb.x).toBeGreaterThan(map!.x + map!.width / 2)
})

test('구 칩을 고르면 지도 핀 개수도 같이 준다', async ({ page }) => {
  await page.goto(REGION)
  const bar = page.getByTestId('map-expand')
  await expect(bar).toHaveText(/\d+곳/, { timeout: 30_000 })
  const before = Number((await bar.innerText()).match(/(\d+)곳/)![1])
  const chip = page.getByTestId('facet-city').getByRole('button').nth(1)
  const n = Number((await chip.innerText()).match(/(\d+)\s*$/)![1])
  await chip.click()
  await expect(page.getByTestId('list-count')).toHaveText(`${n}곳`)
  await expect.poll(async () => Number((await bar.innerText()).match(/(\d+)곳/)![1])).toBeLessThan(before)
})

test('핀을 누르면 지도가 화면을 다 채우고 그 가게 카드가 뜨며 목록은 가려진다. 닫으면 목록으로 돌아온다', async ({ page }) => {
  await page.goto(STATION)
  await openPin(page)
  await expect(box(page)).toHaveAttribute('data-full', '1')
  const vp = page.viewportSize()!
  const b = (await box(page).boundingBox())!
  expect(b.height).toBeGreaterThanOrEqual(vp.height - 1)
  expect(b.width).toBeGreaterThanOrEqual(vp.width - 1)
  // 화면 가운데를 눌러도 목록이 아니라 지도가 눌린다
  expect(await topAt(page, vp.width / 2, vp.height / 3)).not.toBe('list-count')
  expect(await mapOpts(page)).toEqual({ drag: true, pinch: true })
  await expect(page.getByTestId('map-back')).toContainText('목록으로')

  await page.getByTestId('preview-card').getByRole('button', { name: '닫기' }).click()
  await expect(box(page)).toHaveAttribute('data-full', '0')
  await expect(page.getByTestId('preview-card')).toHaveCount(0)
  await expect(page.getByTestId('list-count')).toBeVisible()
  expect((await page.getByTestId('map-preview').boundingBox())!.height).toBeLessThan(260)

  // 위 '‹ 목록으로'와 휴대폰 뒤로 가기도 같다
  await openPin(page)
  await page.getByTestId('map-back').click()
  await expect(box(page)).toHaveAttribute('data-full', '0')
  await openPin(page)
  await page.goBack()
  await expect(box(page)).toHaveAttribute('data-full', '0')
  await expect(page).toHaveURL(new RegExp(encodeURIComponent('홍대입구')))
})

test('큰 지도를 밀면 카드가 닫히고 위쪽에 "이 지역에서 다시 찾기"가 뜬다. 누르면 목록이 빈 자리 → 그 지역 가게로 통째 바뀌고, 원래 목록으로 돌아갈 수 있다', async ({ page }) => {
  await page.goto(STATION)
  const firstOld = await page.getByTestId('list-count').innerText()
  await openPin(page)
  await drag(page)
  await expect(page.getByTestId('preview-card')).toHaveCount(0)
  const again = page.getByTestId('search-here')
  await expect(again).toBeVisible()
  // 위쪽(화면 위 1/4 안), 좌우 정가운데에 있다
  await page.waitForTimeout(400)
  const ab = (await again.boundingBox())!
  expect(ab.y).toBeLessThan(page.viewportSize()!.height / 4)
  expect(Math.abs(ab.x + ab.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(2)
  expect(ab.y).toBeGreaterThan((await page.getByTestId('map-back').boundingBox())!.y)

  await again.click()
  await expect(box(page)).toHaveAttribute('data-full', '0')
  // 옛 목록은 바로 사라지고 빈 자리가 보인다
  await expect(page.getByTestId('area-skeleton')).toBeVisible()
  await expect(page.getByTestId('card-skeleton').first()).toBeVisible()
  await expect(page.getByText('홍대입구역 맛집', { exact: false }).locator('xpath=self::h1')).toHaveCount(0)
  // 새 지역 목록
  await expect(page.locator('h1')).toHaveText(/지도에서 찾은 맛집 \d+곳/, { timeout: 5_000 })
  const n = Number((await page.locator('h1').innerText()).match(/(\d+)곳/)![1])
  await expect(page.getByTestId('area-item')).toHaveCount(Math.min(n, 30))
  await expect(page.getByTestId('list-count')).toHaveText(`${n}곳`)
  await expect(page.getByTestId('walk')).toHaveCount(0)

  await page.getByTestId('area-back').click()
  await expect(page.locator('h1')).toContainText('홍대입구역 맛집')
  await expect(page.getByTestId('list-count')).toHaveText(firstOld)
})

test('역 페이지 지도 위 크게 보기를 누르면 큰 지도로 열린다', async ({ page }) => {
  await page.goto(STATION)
  await expect(page.getByTestId('map-expand')).toHaveText(/\d+곳/, { timeout: 30_000 })
  await page.getByTestId('map-expand').click()
  await expect(box(page)).toHaveAttribute('data-full', '1')
  await expect(page.getByTestId('preview-card')).toHaveCount(0)
})

test('자바스크립트 없이도 h1과 가게 목록 글은 그대로 HTML에 있다', async ({ request }) => {
  const html = await (await request.get(REGION)).text()
  expect(html).toContain('data-testid="map-preview"')
  expect(html).toMatch(/<h1[^>]*>서울 유튜버 맛집 \d+곳<\/h1>/)
  expect(html).toContain('href="/restaurant/')
})

test('홈 지도 카드: 찜·공유가 있어도 가게 이름과 유튜버 이름이 잘리거나 세로로 쪼개지지 않는다', async ({ page }) => {
  await page.goto('/?pin=142')
  const card = page.getByTestId('preview-card')
  await expect(card).toBeVisible({ timeout: 30_000 })
  await expect(card.getByTestId('like')).toBeVisible()
  await expect(card.getByTestId('share-place')).toBeVisible()
  const name = card.locator('.text-lead').first()
  // 이름 칸이 글보다 좁으면 잘린 것
  const cut = await name.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
  expect(cut).toBe(false)
  expect((await name.boundingBox())!.width).toBeGreaterThan(120)
  // 유튜버 이름은 한 줄
  const v = card.getByTestId('visitor-name').first()
  const lh = await v.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || 18)
  expect((await v.boundingBox())!.height).toBeLessThan(lh * 1.5)
})
