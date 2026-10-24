// 캐시가 비는 순간 요청이 몰리면 요청마다 가게 전체를 따로 읽어 DB가 버거워했다(10/24, 같은 질의 5만 번).
// 한 서버 안에서 읽는 중에 들어온 호출은 그 결과를 나눠 쓴다. 다 읽은 뒤의 호출은 새로 부른다(그 뒤는 Next 캐시가 맡는다).
// next/* 를 쓰지 않는다
export function coalesce<T>(run: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null
  return () => {
    if (pending) return pending
    const p = run().finally(() => { if (pending === p) pending = null })
    pending = p
    return p
  }
}
