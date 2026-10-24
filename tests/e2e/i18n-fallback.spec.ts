import { test, expect, type APIRequestContext } from '@playwright/test'

// 번역 전인 가게도 외국어 가게 페이지가 로마자 이름으로 열리고, 외국어 상세엔 구글맵 버튼이 있다
test.setTimeout(90_000)

const GOOGLE = 'https://www.google.com/maps/search/?api=1&query='

async function ids(request: APIRequestContext) {
  const xml = await (await request.get('/sitemap.xml')).text()
  const translated = new Set(Array.from(xml.matchAll(/\/en\/restaurant\/(\d+)/g), (m) => Number(m[1])))
  const { pins } = (await (await request.get('/api/pins')).json()) as { pins: { id: number }[] }
  const untranslated = pins.map((p) => p.id).find((id) => !translated.has(id))
  return { translated: Array.from(translated)[0], untranslated: untranslated! }
}

test('번역 전 가게: /en/restaurant/<id>가 로마자 이름으로 열리고 색인은 막는다', async ({ page, request }) => {
  const { untranslated: id } = await ids(request)
  expect(id).toBeTruthy()
  const res = await page.goto(`/en/restaurant/${id}`)
  expect(res!.status()).toBe(200)
  // "Romanized (한국어)" 꼴: 읽을 수 있는 로마자 이름 + 간판용 한국어
  await expect(page.locator('h1')).toHaveText(/^[A-Z][A-Za-z0-9 .&'-]* \([^)]*[가-힣][^)]*\)$/)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await expect(page.getByRole('link', { name: 'Directions' })).toBeVisible()
  const g = page.getByTestId('google-maps')
  await expect(g).toBeVisible()
  expect(await g.getAttribute('href')).toMatch(new RegExp(`^${GOOGLE.replace(/[.?]/g, '\\$&')}.*%[0-9A-F]{2}`))
})

test('번역된 가게: 길찾기(네이버) 다음에 구글맵 버튼, 검색어는 한국어 이름+주소', async ({ page, request }) => {
  const { translated: id } = await ids(request)
  await page.goto(`/ja/restaurant/${id}`)
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  const naver = page.getByRole('link', { name: '道順' })
  const g = page.getByTestId('google-maps')
  await expect(naver).toBeVisible()
  await expect(g).toBeVisible()
  // 네이버가 먼저(위 또는 왼쪽)
  const [nb, gb] = [await naver.boundingBox(), await g.boundingBox()]
  expect(nb!.y < gb!.y || (nb!.y === gb!.y && nb!.x < gb!.x)).toBe(true)
  const q = decodeURIComponent(new URL((await g.getAttribute('href'))!).searchParams.get('query')!)
  expect(q).toMatch(/[가-힣]/)
  expect(q).not.toMatch(/[ぁ-ゟ゠-ヿ]/)
})

test('한국어 상세에는 구글맵 버튼이 없다', async ({ page, request }) => {
  const { translated: id } = await ids(request)
  await page.goto(`/restaurant/${id}`)
  await expect(page.getByRole('link', { name: '길찾기' })).toBeVisible()
  await expect(page.getByTestId('google-maps')).toHaveCount(0)
})

test('외국어 첫 화면·지역 페이지에 그 언어 공유 미리보기 이미지가 있다', async ({ request }) => {
  for (const p of ['/en', '/ja', '/zh-cn', '/zh-tw', '/en/region/seoul']) {
    const html = await (await request.get(p)).text()
    const url = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
    expect(url, p).toBeTruthy()
    const img = await request.get(new URL(url!).pathname + new URL(url!).search)
    expect(img.status(), url).toBe(200)
    expect(img.headers()['content-type'], url).toBe('image/png')
  }
})
