import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// 공유 왕복: 토스 번들에서 공유 버튼을 눌러 나온 주소를 토스가 실제로 감싸는 방식(minion → og.toss.im → onelink → supertoss → intoss)으로
// 감쌌다가 받는 쪽처럼 풀어서 다시 열면, 보낸 사람이 보던 화면이 그대로 나와야 한다
const TOSS = 'http://localhost:5174/'
const ID = 142

// 2026-10-20 실제 토스 공유 링크에서 본 감싸기 순서
function wrap(query: string) {
  const intoss = `intoss://mukmap-kr?${query}`
  const supertoss = `supertoss://total-services?redirect=${encodeURIComponent(intoss)}`
  const onelink = `https://toss.onelink.me/3563614660?pid=appsintoss&af_dp=${encodeURIComponent(supertoss)}&deep_link_value=${encodeURIComponent(supertoss)}&af_force_deeplink=true`
  return `https://og.toss.im/?returnUrl=${encodeURIComponent(onelink)}&title=${encodeURIComponent('먹맵')}`
}

// 받는 쪽: 한 겹씩 주소 파라미터를 풀어 미니앱에 넘어가는 검색 문자열을 얻는다
function unwrap(og: string) {
  const onelink = new URL(og).searchParams.get('returnUrl')!
  const supertoss = new URL(onelink).searchParams.get('af_dp')!
  const intoss = new URLSearchParams(supertoss.split('?')[1]).get('redirect')!
  return intoss.slice(intoss.indexOf('?'))
}

async function openToss(page: Page, search = '') {
  await page.route('https://mukmap.kr/api/**', async (route) => {
    try {
      const res = await route.fetch()
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } })
    } catch {
      // 테스트가 먼저 끝나 페이지가 닫힌 경우
    }
  })
  await page.goto(`${TOSS}${search}`)
}

const shared = (page: Page) => page.evaluate(() => document.documentElement.dataset.mkShare || '')

async function shareFrom(page: Page, search: string, button: string) {
  await openToss(page, search)
  await page.getByTestId(button).click({ timeout: 30_000 })
  await expect.poll(() => shared(page)).not.toBe('')
  return unwrap(wrap(await shared(page)))
}

async function channel(page: Page) {
  const res = await page.request.get('/api/channels')
  return (await res.json()).channels.find((c: { slug: string | null; restaurant_count: number }) => c.slug && /[^\x00-\x7f]/.test(c.slug) && c.restaurant_count > 20) as { id: string; slug: string; name: string }
}

test('왕복: 지도 카드 공유 → 받은 사람에게 그 가게 카드가 열린다', async ({ page }) => {
  const back = await shareFrom(page, `?pin=${ID}`, 'share-place')
  expect(back).toBe(`?pin=${ID}`)
  await page.goto(`${TOSS}${back}`)
  await expect(page.getByTestId('preview-card')).toBeVisible({ timeout: 30_000 })
})

test('왕복: 상세 공유 → 받은 사람에게 그 가게 상세가 열린다', async ({ page }) => {
  const back = await shareFrom(page, `?place=${ID}`, 'share-detail')
  expect(back).toBe(`?place=${ID}`)
  await page.goto(`${TOSS}${back}`)
  await expect(page.getByTestId('detail-view')).toBeVisible({ timeout: 30_000 })
})

test('왕복: 유튜버 필터 공유 → 받은 사람에게 그 유튜버 칩이 눌려 있다', async ({ page }) => {
  const ch = await channel(page)
  const back = await shareFrom(page, `?yt=${encodeURIComponent(ch.slug)}`, 'share-filter')
  expect(back).toMatch(/^[\x00-\x7f]+$/)
  await page.goto(`${TOSS}${back}`)
  await expect(page.getByRole('button', { name: ch.name, pressed: true }).first()).toBeVisible({ timeout: 30_000 })
})

test('왕복: 한글 검색 공유 → 받은 사람에게 같은 검색어가 걸려 있다', async ({ page }) => {
  const back = await shareFrom(page, `?q=${encodeURIComponent('국밥')}`, 'share-filter')
  await page.goto(`${TOSS}${back}`)
  await expect(page.getByTestId('text-chip').first()).toHaveText(/국밥/, { timeout: 30_000 })
})

test('왕복: 유튜버+지역+구 공유 → 받은 사람에게 세 조건이 모두 걸려 있다', async ({ page }) => {
  const ch = await channel(page)
  const back = await shareFrom(page, `?yt=${encodeURIComponent(ch.slug)}&region=${encodeURIComponent('서울')}&city=${encodeURIComponent('강남구')}`, 'share-filter')
  const q = new URLSearchParams(back)
  expect([q.get('yt'), q.get('region'), q.get('city')]).toEqual([ch.id, '서울', '강남구'])
  await page.goto(`${TOSS}${back}`)
  await expect(page.getByRole('button', { name: ch.name, pressed: true }).first()).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('city'))).toBe('강남구')
})

// 실제로 사용자가 받은 토스 공유 링크를 풀어도 같은 조건이 나온다(토스 서버의 감싸기 방식이 바뀌면 여기서 걸린다)
for (const [code, want] of [['tyLPXvxo', { pin: '2118' }], ['7THZaOwD', { yt: '쯔양' }]] as const) {
  test(`실제 토스 링크 ${code}를 풀면 ${JSON.stringify(want)}가 나온다`, async ({ request }) => {
    const res = await request.get(`https://minion.toss.im/${code}`, { maxRedirects: 0 })
    const back = new URLSearchParams(unwrap(res.headers()['location']))
    for (const [k, v] of Object.entries(want)) expect(back.get(k)).toBe(v)
  })
}
