import { test, expect } from '@playwright/test'

// 데이터로 쓴 글(content/blog/*.md)을 mukmap.kr/blog에 둔다. 글 속 가게 카드·숫자는 지금 DB 값으로 그린다

async function aPostPath(request: import('@playwright/test').APIRequestContext) {
  const html = await (await request.get('/blog')).text()
  const m = html.match(/href="(\/blog\/[a-z0-9-]+)"/)
  expect(m, '/blog 목록에 글 링크가 하나 이상 있어야 한다').toBeTruthy()
  return m![1]
}

test('/blog 목록: h1·글 링크·canonical', async ({ request }) => {
  const res = await request.get('/blog')
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toMatch(/<h1[^>]*>먹맵 블로그<\/h1>/)
  expect(html).toContain('<link rel="canonical" href="https://mukmap.kr/blog"')
  await aPostPath(request)
})

test('/blog 글: 본문·지금 데이터로 그린 가게 카드·Article JSON-LD', async ({ request }) => {
  const path = await aPostPath(request)
  const res = await request.get(path)
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toMatch(/<h1[^>]*>[^<]+<\/h1>/)
  expect(html).toMatch(/<h2[^>]*>[^<]+<\/h2>/)
  // [[가게:id]] 짧은 코드가 카드로 바뀐다(원문 코드가 남지 않는다)
  expect(html).toMatch(/href="\/restaurant\/\d+"[^>]*data-track="blog_place_click"/)
  expect(html).not.toContain('[[가게:')
  expect(html).not.toContain('[[숫자:')
  expect(html).toContain('"@type":"BlogPosting"')
  expect(html).toContain('"dateModified"')
  expect(html).toContain(`<link rel="canonical" href="https://mukmap.kr${path}"`)
  expect(html).toMatch(/<meta property="og:type" content="article"/)
})

test('없는 글은 404', async ({ request }) => {
  expect((await request.get('/blog/no-such-post')).status()).toBe(404)
})

test('홈·sitemap·llms.txt·RSS가 블로그로 잇는다', async ({ request }) => {
  const path = await aPostPath(request)
  expect(await (await request.get('/')).text()).toContain('href="/blog"')
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('https://mukmap.kr/blog</loc>')
  expect(sitemap).toContain(`https://mukmap.kr${path}</loc>`)
  expect(await (await request.get('/llms.txt')).text()).toContain(`https://mukmap.kr${path}`)
  expect(await (await request.get('/feed.xml')).text()).toContain(`https://mukmap.kr${path}</link>`)
})
