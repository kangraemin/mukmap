import { test, expect } from '@playwright/test'
import fs from 'node:fs'

// 매시 수집 크론이 캐시를 비운 직후에도 가게 상세가 바로 뜬다.
// 전에는 가게 하나를 보여 주려고 가게 전체(수천 곳)를 다시 모아 첫 요청이 20~80초 걸렸고, 그동안 상세가 빈 회색 칸으로 남았다(10/25)
test.setTimeout(120_000)

const secret = fs.readFileSync('.env.local', 'utf8').match(/^REVALIDATE_SECRET=["']?([^"'\n]+)/m)?.[1]

test('캐시를 비운 직후 첫 상세 요청도 3초 안에, 영상·유튜버·번역이 채워져 온다', async ({ request }) => {
  expect(secret).toBeTruthy()
  // 데이터 캐시를 한 번 채워 두고(개발 서버 첫 컴파일 시간 제외) 크론처럼 비운다
  const { pins } = (await (await request.get('/api/pins')).json()) as { pins: { id: number }[] }
  const id = pins[0].id
  await request.get(`/api/restaurants/${id}?lang=en`)
  expect((await request.post('/api/revalidate', { headers: { 'x-revalidate-secret': secret! } })).status()).toBe(200)

  const t0 = Date.now()
  const res = await request.get(`/api/restaurants/${id}?lang=en`)
  const ms = Date.now() - t0
  expect(res.status()).toBe(200)
  expect(ms, `첫 상세 ${ms}ms`).toBeLessThan(3000)

  const r = await res.json()
  expect(r.id).toBe(id)
  expect(r.name_ko).toBeTruthy()
  expect(r.videos.length).toBeGreaterThan(0)
  for (const v of r.videos) expect(v.channel_name).toBeTruthy()
  // 최신 영상이 먼저
  const dates = r.videos.map((v: { published_at: string | null }) => v.published_at || '')
  expect([...dates].sort().reverse()).toEqual(dates)
})
