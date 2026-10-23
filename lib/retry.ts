// 배포 빌드는 페이지 수십 개를 동시에 그리며 Supabase를 몰아 부른다. 그러다 statement timeout(57014)이 나면 배포가 통째로 깨진다.
// 일시적인 오류만 잠깐 쉬었다 다시 부르고, 잘못된 질의 같은 오류는 바로 던진다. next/* 를 쓰지 않는다
type DbError = { code?: string; message?: string }

function transient(e: DbError) {
  return e.code === '57014' || /timeout|fetch failed|ECONNRESET|socket hang up|50[234]/i.test(e.message || '')
}

export async function retryDb<T>(
  run: () => PromiseLike<{ data: T | null; error: DbError | null }>,
  { tries = 5, waitMs = 2000 }: { tries?: number; waitMs?: number } = {},
): Promise<T | null> {
  for (let i = 1; ; i++) {
    const { data, error } = await run()
    if (!error) return data
    if (i >= tries || !transient(error)) throw error
    await new Promise((r) => setTimeout(r, waitMs * i + Math.random() * waitMs))
  }
}
