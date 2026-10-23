import { test, expect } from '@playwright/test'
import { retryDb } from '../../lib/retry'

// 배포 빌드가 페이지 수십 개를 동시에 그리며 Supabase를 몰아 부르면 statement timeout(57014)이 나 배포가 깨졌다(10/23 3회).
// 일시적인 DB 오류는 잠깐 쉬고 다시 부른다

test('statement timeout은 다시 불러 성공시킨다', async () => {
  let n = 0
  const v = await retryDb(async () => {
    n++
    if (n < 3) return { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }
    return { data: ['ok'], error: null }
  }, { waitMs: 1 })
  expect(v).toEqual(['ok'])
  expect(n).toBe(3)
})

test('끝내 실패하면 마지막 오류를 던진다', async () => {
  let n = 0
  await expect(retryDb(async () => { n++; return { data: null, error: { code: '57014', message: 'timeout' } } }, { tries: 4, waitMs: 1 })).rejects.toMatchObject({ code: '57014' })
  expect(n).toBe(4)
})

test('잘못된 질의 같은 일시적이지 않은 오류는 바로 던진다', async () => {
  let n = 0
  await expect(retryDb(async () => { n++; return { data: null, error: { code: '42703', message: 'column does not exist' } } }, { waitMs: 1 })).rejects.toMatchObject({ code: '42703' })
  expect(n).toBe(1)
})
