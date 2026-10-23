import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildSnap } from '../../lib/build-snap'

// 배포 빌드 워커 여러 개가 같은 질의를 동시에 던져 DB가 statement timeout을 냈다(10/23).
// 빌드 중에는 키마다 한 번만 DB를 부르고 나머지는 그 결과를 나눠 쓴다

test.describe.configure({ mode: 'serial' })

function setup() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mukmap-snap-'))
  process.env.MUKMAP_SNAP_DIR = d
  return d
}

test('빌드 중 같은 키를 동시에 여러 번 불러도 DB는 한 번만 부른다', async () => {
  setup()
  process.env.NEXT_PHASE = 'phase-production-build'
  let n = 0
  const run = async () => {
    n++
    await new Promise((r) => setTimeout(r, 300))
    return { rows: [1, 2, 3] }
  }
  const out = await Promise.all([buildSnap('chunk:0', run), buildSnap('chunk:0', run), buildSnap('chunk:0', run)])
  expect(out).toEqual([{ rows: [1, 2, 3] }, { rows: [1, 2, 3] }, { rows: [1, 2, 3] }])
  expect(n).toBe(1)
  expect(await buildSnap('chunk:0', run)).toEqual({ rows: [1, 2, 3] })
  expect(n).toBe(1)
})

test('빌드가 아닐 때는 매번 DB를 부른다', async () => {
  setup()
  delete process.env.NEXT_PHASE
  let n = 0
  await buildSnap('channels', async () => ++n)
  await buildSnap('channels', async () => ++n)
  expect(n).toBe(2)
})

test('DB가 실패하면 파일을 남기지 않고 오류를 던진다', async () => {
  const d = setup()
  process.env.NEXT_PHASE = 'phase-production-build'
  await expect(buildSnap('bad', async () => { throw new Error('timeout') })).rejects.toThrow('timeout')
  expect(fs.readdirSync(d)).toEqual([])
  delete process.env.NEXT_PHASE
})
