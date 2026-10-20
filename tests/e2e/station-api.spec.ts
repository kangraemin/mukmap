import { test, expect } from '@playwright/test'

test('역 검색 API는 빈 검색·일반 검색을 빈 배열로 돌려주고 토스 CORS를 허용한다', async ({ request }) => {
  const origin = 'https://mukmap-kr.private-apps.tossmini.com'
  for (const q of ['', '국밥', '강남역 맛집']) {
    const response = await request.get('/api/station', { params: { q }, headers: { Origin: origin } })
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual([])
    expect(response.headers()['cache-control']).toContain('s-maxage=86400')
    expect(response.headers()['access-control-allow-origin']).toBe(origin)
  }
  const preflight = await request.fetch('/api/station', { method: 'OPTIONS', headers: { Origin: origin } })
  expect(preflight.status()).toBe(204)
})

test('역 검색 API는 실제 강남역 결과를 중복 없이 WGS84 좌표로 돌려준다', async ({ request }) => {
  const response = await request.get('/api/station', { params: { q: '강남역' } })
  expect(response.status()).toBe(200)
  const rows = await response.json() as { name: string; lat: number; lng: number }[]
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.length).toBeLessThanOrEqual(3)
  expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length)
  const gangnam = rows.find((r) => r.name === '강남역 2호선')
  expect(gangnam).toBeDefined()
  expect(gangnam!.lat).toBeCloseTo(37.4979526, 3)
  expect(gangnam!.lng).toBeCloseTo(127.0276242, 3)
  expect(rows.every((r) => !r.name.includes('<b>'))).toBe(true)
})
