// 배포 빌드에서는 워커 여러 개가 같은 DB 질의를 동시에 던진다. 그게 statement timeout으로 배포를 깨뜨렸다(10/23).
// 빌드 중에만 질의 결과를 파일로 나눠 쓴다. 키마다 워커 하나만 DB를 부르고, 나머지 워커는 그 파일을 기다렸다 읽는다.
// 빌드가 아닐 때(요청·재검증)는 그냥 DB를 부른다. next/* 를 쓰지 않는다
import fs from 'node:fs'
import path from 'node:path'

const MAX_AGE_MS = 30 * 60e3 // 지난 빌드가 남긴 파일은 쓰지 않는다
const WAIT_MS = 120e3

function dir() {
  return process.env.MUKMAP_SNAP_DIR || path.join(process.cwd(), '.next', 'cache', 'mukmap-snap')
}

function fresh(file: string) {
  try {
    return Date.now() - fs.statSync(file).mtimeMs < MAX_AGE_MS
  } catch {
    return false
  }
}

export async function buildSnap<T>(key: string, run: () => Promise<T>): Promise<T> {
  if (process.env.NEXT_PHASE !== 'phase-production-build') return run()
  const d = dir()
  const file = path.join(d, encodeURIComponent(key) + '.json')
  const lock = file + '.lock'
  fs.mkdirSync(d, { recursive: true })
  const deadline = Date.now() + WAIT_MS
  for (;;) {
    if (fresh(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) as T
    try {
      fs.mkdirSync(lock) // 먼저 잡은 워커만 DB를 부른다
    } catch {
      // 잡은 워커가 죽어 잠금만 남았거나 너무 오래 걸리면 직접 부른다
      if (Date.now() > deadline || !fresh(lock)) return run()
      await new Promise((r) => setTimeout(r, 200))
      continue
    }
    try {
      const v = await run()
      fs.writeFileSync(file + '.tmp', JSON.stringify(v))
      fs.renameSync(file + '.tmp', file)
      return v
    } finally {
      fs.rmSync(lock, { recursive: true, force: true })
    }
  }
}
