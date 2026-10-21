// 찜한 가게 id. 로그인 없이 이 기기에만 남긴다. 토스 앱은 앱 저장소(Storage), 웹은 localStorage
export interface LikeStore {
  get: () => Promise<string | null>
  set: (value: string) => Promise<void>
}

export const LIKES_KEY = 'mukmap:likes:v1'

export const localLikeStore: LikeStore = {
  get: async () => {
    try { return localStorage.getItem(LIKES_KEY) } catch { return null }
  },
  set: async (v) => {
    try { localStorage.setItem(LIKES_KEY, v) } catch {}
  },
}

export function parseLikes(raw: string | null): number[] {
  try {
    const xs = JSON.parse(raw || '[]')
    return Array.isArray(xs) ? xs.filter((x): x is number => Number.isInteger(x) && x > 0) : []
  } catch {
    return []
  }
}
