import { test, expect, type Page } from '@playwright/test'

// 외국어 첫 화면(/en 등)은 한국어 홈과 같은 지도 앱이고, 가게 원래 이름·주소 말고는 한글이 보이지 않는다
const LANGS = [
  { lang: 'en', all: 'All', map: 'Directions' },
  { lang: 'ja', all: 'すべて', map: '道順' },
  { lang: 'zh-cn', all: '全部', map: '路线' },
  { lang: 'zh-tw', all: '全部', map: '路線' },
]

test.setTimeout(120_000)

/** 화면에 보이는 글 중 한글이 든 것. 괄호 속 한국어 가게 이름·주소는 허용한다 */
async function visibleHangul(page: Page, root = 'body') {
  return page.evaluate((sel) => {
    const out: string[] = []
    const base = document.querySelector(sel)
    if (!base) return out
    const w = document.createTreeWalker(base, NodeFilter.SHOW_TEXT)
    while (w.nextNode()) {
      const n = w.currentNode
      const el = n.parentElement
      const txt = (n.textContent || '').trim()
      if (!el || !/[가-힣]/.test(txt)) continue
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight || getComputedStyle(el).visibility === 'hidden') continue
      // 가게 이름 'Doryang (도량)', 주소 '서울특별시 …'
      if (/\([^)]*[가-힣][^)]*\)$/.test(txt) || /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)/.test(txt)) continue
      out.push(txt)
    }
    document.querySelectorAll<HTMLInputElement>('input[placeholder]').forEach((i) => { if (/[가-힣]/.test(i.placeholder)) out.push(i.placeholder) })
    return out
  }, root)
}

for (const L of LANGS) {
  test(`/${L.lang}: 한국어 홈과 같은 지도·목록·상세가 그 언어로 뜬다`, async ({ page }) => {
    await page.goto(`/${L.lang}`)
    await expect(page.getByTestId('pill-count')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByRole('button', { name: L.all, exact: true }).first()).toBeVisible()
    expect(await visibleHangul(page)).toEqual([])

    await page.getByTestId('list-pill').click()
    await expect(page.getByTestId('list-item').first()).toBeVisible()
    expect(await visibleHangul(page)).toEqual([])

    await page.getByTestId('list-item').first().click()
    const detail = page.getByTestId('detail-view')
    await expect(detail.getByRole('link', { name: L.map })).toBeVisible({ timeout: 30_000 })
    expect(await visibleHangul(page, '[data-testid="detail-view"]')).toEqual([])
  })
}

test('외국어 핀 목록은 그 언어 가게 이름(한국어 이름 병기)을 준다', async ({ request }) => {
  const p = await (await request.get('/api/pins/ja')).json()
  expect(p.pins.length).toBeGreaterThan(100)
  expect(p.pins.some((x: { name: string }) => /[ァ-ヶ].*\([가-힣]/.test(x.name))).toBe(true)
  expect((await request.get('/api/pins/fr')).status()).toBe(404)
})

// 번역이 아직 안 된 가게도 많아서 /en/restaurant/<id>는 404일 수 있다. 외국어 공유는 그 언어 지도에서 가게를 여는 주소로
test('외국어 지도에서 가게를 공유하면 그 언어 지도 주소(/en?place=)가 넘어간다', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: string[] }
    w.__shared = []
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d: { url: string }) => { w.__shared.push(d.url) } })
  })
  await page.goto('/en')
  await expect(page.getByTestId('pill-count')).toBeVisible({ timeout: 90_000 })
  await page.getByTestId('list-pill').click()
  await page.getByTestId('list-item').first().click()
  await page.getByTestId('detail-view').getByRole('button', { name: 'Share' }).first().click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: string[] }).__shared[0] || '')).toMatch(/\/en\?place=\d+$/)
  // 받은 사람이 열면 그 가게 상세가 영어로 뜬다
  const shared = await page.evaluate(() => (window as unknown as { __shared: string[] }).__shared[0])
  await page.goto(new URL(shared).pathname + new URL(shared).search)
  await expect(page.getByTestId('detail-view').getByRole('link', { name: 'Directions' })).toBeVisible({ timeout: 60_000 })
})
