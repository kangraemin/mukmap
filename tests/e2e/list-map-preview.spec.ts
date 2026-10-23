import { test, expect, type Page } from '@playwright/test'

// 목록·역 페이지 위 지도: 얼굴 핀이 찍히고, 핀을 누르면 큰 지도와 그 가게 카드가 뜨며, 큰 지도를 옮겨 다시 찾으면 목록이 그 지역으로 통째 바뀐다

const STATION = `/station/${encodeURIComponent('홍대입구')}`
const REGION = `/region/${encodeURIComponent('서울')}`
const box = (page: Page) => page.getByTestId('list-map')
const marks = (page: Page) => box(page).locator('[data-pin], [data-cluster]')

/** 목록 시트가 지도 위에 반쯤(화면 30~60%) 올라와 있고 가게 줄이 보인다 */
async function expectHalf(page: Page, id: string) {
  const sheet = page.getByTestId(id)
  await expect(sheet).toHaveAttribute('data-snap', 'half')
  const vp = page.viewportSize()!
  await expect.poll(async () => {
    const b = (await sheet.boundingBox())!
    return b.height > vp.height * 0.3 && b.height < vp.height * 0.6 && Math.abs(b.y + b.height - vp.height) < 2
  }).toBe(true)
  await expect(sheet.getByTestId('list-item').first()).toBeVisible()
}

/** 시트 머리줄을 손가락으로 위로 끈다 */
async function pullUp(page: Page, grip: ReturnType<Page['getByTestId']>) {
  const b = (await grip.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - i * 30)
  await page.mouse.up()
}

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

/** 지도 칸 안에 실제로 보이는 첫 핀·묶음. 첫 핀이 지도 가장자리 밖에 걸려 있으면 누를 수 없다 */
async function inside(page: Page, sel: string) {
  const all = box(page).locator(sel)
  const i = await all.evaluateAll((els) => els.findIndex((e) => {
    const m = e.closest('[data-testid=list-map]')!.getBoundingClientRect()
    const r = e.getBoundingClientRect()
    const x = r.left + r.width / 2, y = r.top + r.height / 2
    return r.width > 0 && x > m.left && x < m.right && y > m.top && y < m.bottom
  }))
  return all.nth(Math.max(0, i))
}

/** 작은 지도의 핀 하나를 눌러 큰 지도 + 카드를 띄운다. 핀이 다 묶여 있으면 묶음을 눌러 큰 지도에서 핀을 고른다 */
async function openPin(page: Page) {
  await expect(marks(page).first()).toBeVisible({ timeout: 30_000 })
  // 큰 지도에서 돌아온 직후엔 지도가 줄어들며 핀을 다시 그린다. 핀 자리가 멈출 때까지 기다린다
  let last = ''
  await expect.poll(async () => {
    const now = await marks(page).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${r.left | 0},${r.top | 0}` }).join(';'))
    const same = now === last && now !== ''
    last = now
    return same
  }, { intervals: [150], timeout: 15_000 }).toBe(true)
  const single = box(page).locator('[data-pin]')
  if (await single.count()) await (await inside(page, '[data-pin]')).click()
  else {
    await (await inside(page, '[data-cluster]')).click()
    await expect(box(page)).toHaveAttribute('data-full', '1')
    await expect(box(page).locator('[data-pin]').first()).toBeVisible({ timeout: 15_000 })
    await (await inside(page, '[data-pin]')).click()
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

test('핀을 누르면 지도가 화면을 다 채우고 그 가게 카드가 뜨며 목록은 가려진다. 카드 ✕는 카드만 닫고, 목록으로를 눌러야 목록으로 돌아온다', async ({ page }) => {
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

  // 카드 ✕는 카드만 닫는다. 큰 지도는 그대로고, 지도 위에 이 목록이 반쯤 올라온다(사용자 지적 2026-10-21)
  await page.getByTestId('preview-card').getByRole('button', { name: '닫기' }).click()
  await expect(page.getByTestId('preview-card')).toHaveCount(0)
  await expect(box(page)).toHaveAttribute('data-full', '1')
  await expect(page.getByTestId('map-back')).toBeVisible()
  await expectHalf(page, 'map-list')

  // 목록으로는 위 '‹ 목록으로'와 휴대폰 뒤로 가기로 돌아간다
  await page.getByTestId('map-back').click()
  await expect(box(page)).toHaveAttribute('data-full', '0')
  await expect(page.getByTestId('list-count')).toBeVisible()
  expect((await page.getByTestId('map-preview').boundingBox())!.height).toBeLessThan(260)
  await openPin(page)
  await page.getByTestId('map-back').click()
  await expect(box(page)).toHaveAttribute('data-full', '0')
  await openPin(page)
  await page.goBack()
  await expect(box(page)).toHaveAttribute('data-full', '0')
  await expect(page).toHaveURL(new RegExp(encodeURIComponent('홍대입구')))
})

test('큰 지도를 밀면 카드가 닫히고 위 가운데 "이 지역에서 다시 찾기"가 뜬다. 누르면 홈 지도처럼 지도에 남은 채 그 지역 핀을 다시 찍고, 목록은 그대로다', async ({ page }) => {
  // 사용자 지시(2026-10-21): 다시 찾기로 목록을 통째 바꾸지 말고, 기존 지도에서 옮기면 핀을 다시 보여 주듯 한다
  await page.goto(STATION)
  const firstOld = await page.getByTestId('list-count').innerText()
  await openPin(page)
  const pinIds = () => marks(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-pin') ?? `c${e.textContent}`).sort().join(','))
  await drag(page)
  await expect(page.getByTestId('preview-card')).toHaveCount(0)
  const again = page.getByTestId('search-here')
  await expect(again).toBeVisible()
  // 위쪽(화면 위 1/4 안), 좌우 정가운데에 있다
  await page.waitForTimeout(400)
  const ab = (await again.boundingBox())!
  expect(ab.y).toBeLessThan(page.viewportSize()!.height / 4)
  expect(ab.y).toBeGreaterThan((await page.getByTestId('map-back').boundingBox())!.y)
  expect(Math.abs(ab.x + ab.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(2)

  // 역 1km 밖으로 밀었으니 이 목록에 없던 가게 핀이 생긴다
  const before = await pinIds()
  await again.click()
  await expect(again).toHaveCount(0)
  await expect(box(page)).toHaveAttribute('data-full', '1')
  await expect.poll(pinIds, { timeout: 10_000 }).not.toBe(before)
  await expect(page.getByTestId('area-skeleton')).toHaveCount(0)

  // 목록으로 돌아가면 원래 목록 그대로
  await page.getByTestId('map-back').click()
  await expect(box(page)).toHaveAttribute('data-full', '0')
  await expect(page.locator('h1')).toContainText('홍대입구역 맛집')
  await expect(page.getByTestId('list-count')).toHaveText(firstOld)
  // 작은 지도는 다시 이 목록 가게에 맞춰진다(큰 화면 크기로 맞춰 엉뚱한 동네만 보이면 안 된다): 지도 가운데가 홍대입구역 근처
  await expect.poll(() => box(page).getByTestId('map').evaluate((el) => {
    const m = (el as HTMLElement & { __map?: { getCenter: () => { lat: () => number; lng: () => number }; getSize: () => { width: number; height: number } } }).__map!
    const c = m.getCenter()
    return Math.abs(c.lat() - 37.557) < 0.02 && Math.abs(c.lng() - 126.924) < 0.025 && m.getSize().height === el.parentElement!.clientHeight
  }), { timeout: 10_000 }).toBe(true)
})

test('큰 지도에서 카드 ✕를 누르면 지도 위에 이 목록이 반쯤 올라오고, 위로 끌면 화면을 다 채우며, 지도 보기로 다시 반쯤 내려온다', async ({ page }) => {
  // 사용자 지시(2026-10-21): ✕ 눌렀을 때 지도만 남지 말고 목록이 반쯤 보이고, 위로 올리면 풀화면
  await page.goto(STATION)
  await openPin(page)
  const sheet = page.getByTestId('map-list')
  await expect(sheet).toHaveAttribute('data-snap', 'hidden')
  await page.getByTestId('preview-card').getByRole('button', { name: '닫기' }).click()
  await expectHalf(page, 'map-list')
  await expect(page.getByTestId('map-list-count')).toHaveText(/\d+곳/)
  // 위로 끌면 위 막대 아래를 다 채운다
  await pullUp(page, page.getByTestId('map-list-head'))
  await expect(sheet).toHaveAttribute('data-snap', 'full')
  const bar = (await page.getByTestId('map-back').boundingBox())!
  await expect.poll(async () => (await sheet.boundingBox())!.y).toBeLessThan(bar.y + bar.height + 20)
  await expect(box(page)).toHaveAttribute('data-full', '1')
  // 지도 보기로 다시 반쯤
  await page.getByTestId('map-list-map').click()
  await expectHalf(page, 'map-list')
  // 머리줄을 누르기만 해도 다 펼친다
  await page.getByTestId('map-list-head').click()
  await expect(sheet).toHaveAttribute('data-snap', 'full')
})

test('역 페이지 지도 위 크게 보기를 누르면 큰 지도로 열린다', async ({ page }) => {
  await page.goto(STATION)
  await expect(page.getByTestId('map-expand')).toHaveText(/\d+곳/, { timeout: 30_000 })
  await page.getByTestId('map-expand').click()
  await expect(box(page)).toHaveAttribute('data-full', '1')
  await expect(page.getByTestId('preview-card')).toHaveCount(0)
  await expectHalf(page, 'map-list')
})

test('홈 지도는 처음부터 목록이 반쯤 올라와 있고, 위로 끌면 전체 목록, 지도 보기로 다시 반쯤, 핀 카드가 뜨면 내려간다', async ({ page }) => {
  // 사용자 지시(2026-10-21): 먹맵 웹 홈도 리스트 바텀시트가 반쯤 보이고 위로 올리면 풀화면
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  await expectHalf(page, 'list-view')
  const sheet = page.getByTestId('list-view')
  await pullUp(page, page.getByTestId('list-pill'))
  await expect(sheet).toHaveAttribute('data-snap', 'full')
  await expect.poll(async () => (await sheet.boundingBox())!.y).toBeLessThan(2)
  await expect(page.getByTestId('list-count')).toHaveText(/\d+/)
  await page.getByTestId('map-pill').click()
  await expectHalf(page, 'list-view')
  // 휴대폰 뒤로 가기도 전체 목록 → 반쯤
  await page.getByTestId('list-pill').click()
  await expect(sheet).toHaveAttribute('data-snap', 'full')
  await page.goBack()
  await expectHalf(page, 'list-view')
  // 핀을 누르면 시트는 내려가고 카드가 뜬다. 카드 ✕면 다시 반쯤
  await page.goto('/?pin=142')
  await expect(page.getByTestId('preview-card')).toBeVisible({ timeout: 30_000 })
  await expect(sheet).toHaveAttribute('data-snap', 'hidden')
  await page.getByTestId('preview-card').getByRole('button', { name: '닫기' }).click()
  await expectHalf(page, 'list-view')
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

/** 시트 머리줄을 손가락으로 아래로 끈다 */
async function pullDown(page: Page, grip: ReturnType<Page['getByTestId']>) {
  const b = (await grip.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + i * 30)
  await page.mouse.up()
}

/** 시트가 머리줄만 남기고 바닥에 붙어 있다 */
async function expectPeek(page: Page, id: string) {
  const sheet = page.getByTestId(id)
  await expect(sheet).toHaveAttribute('data-snap', 'peek')
  const vp = page.viewportSize()!
  await expect.poll(async () => {
    const b = (await sheet.boundingBox())!
    return b.height > 50 && b.height < 130 && Math.abs(b.y + b.height - vp.height) < 2
  }).toBe(true)
}

test('홈 목록 시트를 밑으로 끌면 머리줄만 남기고 내려가 멈추고, 머리줄을 누르거나 위로 끌면 다시 반쯤', async ({ page }) => {
  // 사용자 지시(2026-10-21): 밑으로 내리면 다시 반쯤으로 튀어 오르지 말고 더 낮은 단계에 멈춰야
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  await expectHalf(page, 'list-view')
  await pullDown(page, page.getByTestId('list-pill'))
  await expectPeek(page, 'list-view')
  await expect(page.getByTestId('pill-count')).toBeVisible()
  await page.getByTestId('list-pill').click()
  await expectHalf(page, 'list-view')
  await pullDown(page, page.getByTestId('list-pill'))
  await expectPeek(page, 'list-view')
  await pullUp(page, page.getByTestId('list-pill'))
  await expect(page.getByTestId('list-view')).not.toHaveAttribute('data-snap', 'peek')
})

test('목록 큰 지도 시트도 밑으로 끌면 머리줄만 남고, 머리줄을 누르면 반쯤', async ({ page }) => {
  await page.goto(STATION)
  await expect(page.getByTestId('map-expand')).toHaveText(/\d+곳/, { timeout: 30_000 })
  await page.getByTestId('map-expand').click()
  await expectHalf(page, 'map-list')
  await pullDown(page, page.getByTestId('map-list-head'))
  await expectPeek(page, 'map-list')
  await page.getByTestId('map-list-head').click()
  await expectHalf(page, 'map-list')
})

test('홈에서 핀을 눌러 카드를 띄웠다가 ✕로 닫으면 핀 누르기 전 목록이 그대로 보인다', async ({ page }) => {
  // 사용자 지시(2026-10-21): 카드 X 누르면 지도가 확대된 "이 지도 안 1곳" 화면이 아니라 보던 목록 그대로
  await page.goto('/')
  await expect(page.getByTestId('pill-count')).toHaveText(/\d+곳/, { timeout: 30_000 })
  const sheet = page.getByTestId('list-view')
  // 묶음을 눌러 들어가 시트에 안 가린 낱개 핀이 보일 때까지
  let pin = null
  for (let i = 0; i < 6 && !pin; i++) {
    await page.waitForTimeout(1200)
    const single = page.locator('[data-pin]')
    const n = await single.evaluateAll((els) => els.findIndex((el) => {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return !!(r.width && top && el.contains(top))
    }))
    if (n >= 0) { pin = single.nth(n); break }
    const ci = await page.locator('[data-cluster]').evaluateAll((els) => els.findIndex((el) => {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return !!(r.width && top && el.contains(top))
    }))
    await page.locator('[data-cluster]').nth(ci).click()
  }
  expect(pin).not.toBeNull()
  await page.waitForTimeout(1200)
  const before = await page.getByTestId('pill-count').textContent()
  const names = await sheet.getByTestId('list-item').evaluateAll((els) => els.slice(0, 3).map((e) => e.textContent))
  await pin!.click()
  await expect(page.getByTestId('preview-card')).toBeVisible()
  await page.waitForTimeout(1500)
  await page.getByTestId('preview-card').getByRole('button', { name: '닫기' }).click()
  await expectHalf(page, 'list-view')
  await expect(page.getByTestId('pill-count')).toHaveText(before!)
  await expect.poll(() => sheet.getByTestId('list-item').evaluateAll((els) => els.slice(0, 3).map((e) => e.textContent))).toEqual(names)
})
