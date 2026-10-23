import { test, expect } from '@playwright/test'

// ChatGPT 등 AI 검색은 "쯔양 최근 간 맛집"처럼 최신 정보 질문에서 웹을 찾아 출처를 건다.
// 유튜버마다 날짜가 박힌 최근 30일 새 맛집 페이지를 둔다

async function aNewPath(request: import('@playwright/test').APIRequestContext) {
  const xml = await (await request.get('/sitemap.xml')).text()
  const m = xml.match(/<loc>[^<]*(\/youtuber\/[^<\/]+\/new)<\/loc>/)
  expect(m, 'sitemap에 유튜버 최근 새 맛집 페이지가 하나 이상 있어야 한다').toBeTruthy()
  return m![1]
}

test('유튜버 최근 30일 새 맛집 페이지: 날짜 기준·직답·가게 링크·dateModified', async ({ request }) => {
  const path = await aNewPath(request)
  const res = await request.get(path)
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toMatch(/<h1[^>]*>[^<]+ 최근 30일 새 맛집 \d+곳<\/h1>/)
  expect(html).toMatch(/\d{4}년 \d+월 \d+일 기준/)
  expect(html).toMatch(/최근에 간 맛집은/)
  expect(html).toMatch(/\d+월 \d+일 영상/)
  expect(html).toMatch(/href="\/restaurant\/\d+"/)
  expect(html).toContain('"dateModified"')
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/mukmap\.kr\/youtuber\/[^"]+\/new"/)
  expect(html).toMatch(/<meta property="og:image" content="[^"]+"/)
})

test('유튜버 페이지에서 최근 새 맛집 페이지로 링크한다', async ({ request }) => {
  const path = await aNewPath(request)
  const parent = path.replace(/\/new$/, '')
  const html = await (await request.get(parent)).text()
  expect(html).toContain(`href="${path}"`)
})

test('/this-week와 llms.txt가 유튜버별 최근 새 맛집 페이지로 잇는다', async ({ request }) => {
  const path = await aNewPath(request)
  expect(await (await request.get('/this-week')).text()).toContain(`href="${path}"`)
  expect(await (await request.get('/llms.txt')).text()).toContain(`https://mukmap.kr${path}`)
})

test('없는 유튜버의 새 맛집 페이지는 404', async ({ request }) => {
  expect((await request.get('/youtuber/' + encodeURIComponent('없던유튜버') + '/new')).status()).toBe(404)
})

test('/this-week에 공유 미리보기 그림(og:image)이 있다', async ({ request }) => {
  const html = await (await request.get('/this-week')).text()
  expect(html).toMatch(/<meta property="og:image" content="[^"]+"/)
})
