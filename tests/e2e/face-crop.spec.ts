import { test, expect } from '@playwright/test'

// 재선랑 프로필은 빨간 원·글씨가 든 로고라 작은 동그라미에서 원 속의 원으로 뭉개졌다.
// 얼굴(머리 모양)만 잘라 낸 그림을 내려준다
test('재선랑 얼굴 사진은 로고 전체가 아니라 얼굴만 잘라 낸 그림이다', async ({ request }) => {
  const r = await request.get('/api/face/UCzgpOnor-MzT-1iflZil2GQ')
  expect(r.status()).toBe(200)
  expect(r.headers()['content-type']).toBe('image/png')
  // 다른 유튜버는 유튜브 사진(jpeg)을 그대로 준다
  const other = await request.get('/api/face/UCfpaSruWW3S4dibonKXENjA')
  expect(other.headers()['content-type']).toBe('image/jpeg')
})
