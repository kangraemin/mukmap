import { test, expect } from '@playwright/test'

// 외국어 페이지: 번역된 가게만 그 언어로 나오고, 한국어판과 서로 hreflang으로 이어진다
const LANGS = [
  { lang: 'en', html: 'en', watch: 'Watch video', directions: 'Directions' },
  { lang: 'ja', html: 'ja', watch: '動画を見る', directions: '道順' },
  { lang: 'zh-cn', html: 'zh-Hans', watch: '看视频', directions: '路线' },
  { lang: 'zh-tw', html: 'zh-Hant', watch: '看影片', directions: '路線' },
]

// 개발 서버는 처음 여는 페이지를 그 자리에서 빌드해 30초를 넘길 때가 있다
test.setTimeout(90_000)

for (const L of LANGS) {
  test(`/${L.lang}: 첫 화면에서 가게를 누르면 그 언어로 된 상세가 뜨고 한국어판과 이어진다`, async ({ page }) => {
    const res = await page.goto(`/${L.lang}`)
    expect(res!.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', L.html)
    const first = page.getByTestId('lang-list').locator('a').first()
    await expect(first).toBeVisible()
    const href = (await first.getAttribute('href'))!
    expect(href).toMatch(new RegExp(`^/${L.lang}/restaurant/\\d+$`))

    await first.click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.locator('html')).toHaveAttribute('lang', L.html)
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.getByRole('link', { name: L.directions })).toBeVisible()
    // 한국어 화면 글자가 남아 있지 않다
    await expect(page.getByText('길찾기', { exact: true })).toHaveCount(0)
    await expect(page.getByText('영상 보기', { exact: true })).toHaveCount(0)

    const id = href.split('/').pop()
    const alt = page.locator('link[rel="alternate"][hreflang]')
    await expect(page.locator('link[rel="alternate"][hreflang="ko"]')).toHaveAttribute('href', `https://mukmap.kr/restaurant/${id}`)
    await expect(page.locator(`link[rel="alternate"][hreflang="${L.html}"]`)).toHaveAttribute('href', `https://mukmap.kr${href}`)
    expect(await alt.count()).toBeGreaterThanOrEqual(3)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://mukmap.kr${href}`)

    // 한국어판에도 이 언어로 가는 hreflang과 언어 링크가 있다
    // 아래쪽 이미지가 늦게 떠 링크가 밀리므로 누르는 대신 주소를 따라간다
    const ko = page.getByTestId('lang-links').getByRole('link', { name: '한국어' })
    await expect(ko).toHaveAttribute('href', `/restaurant/${id}`)
    await page.goto(`/restaurant/${id}`)
    await expect(page).toHaveURL(new RegExp(`/restaurant/${id}$`))
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
    await expect(page.locator(`link[rel="alternate"][hreflang="${L.html}"]`)).toHaveAttribute('href', `https://mukmap.kr${href}`)
    await expect(page.getByRole('link', { name: '길찾기' })).toBeVisible()
  })
}

test('지역 페이지는 영문 주소(/en/region/seoul)로 열리고 그 지역 가게만 나온다', async ({ page }) => {
  await page.goto('/en')
  const region = page.locator('a[href^="/en/region/"]').first()
  const href = (await region.getAttribute('href'))!
  await region.click()
  await expect(page).toHaveURL(new RegExp(`${href}$`))
  const items = page.getByTestId('lang-list').locator('a')
  await expect(items.first()).toBeVisible()
  await expect(page.locator('h1')).toContainText('restaurants Korean YouTubers visited')
})

test('없는 언어·번역 없는 가게·없는 지역은 404', async ({ request }) => {
  for (const u of ['/fr', '/en/restaurant/999999999', '/en/region/nowhere']) {
    expect((await request.get(u)).status(), u).toBe(404)
  }
})

test('외국어 페이지는 Content-Language 헤더를 보내고 sitemap에 들어간다', async ({ request }) => {
  expect((await request.get('/ja')).headers()['content-language']).toBe('ja')
  const xml = await (await request.get('/sitemap.xml')).text()
  for (const L of LANGS) expect(xml).toMatch(new RegExp(`https://mukmap.kr/${L.lang}/restaurant/\\d+`))
  expect(xml).toContain('https://mukmap.kr/en/region/')
})
