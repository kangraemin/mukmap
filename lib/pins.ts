// 지도 핀용 가벼운 가게 정보. 홈은 이걸 한 번만 받고 범위·유튜버·지역 거르기는 화면에서 한다.
export interface Pin {
  id: number
  name: string
  lat: number
  lng: number
  category: string
  region: string | null
  city: string | null
  /** 가장 최근 영상 게시일(YYYY-MM-DD) */
  date: string
  /** 다녀간 유튜버 id, 최근 방문 순, 중복 없음 */
  ch: string[]
  /** 대표 영상 id(썸네일용) */
  vid: string | null
  /** 대표 한 줄: 자막 인용, 없으면 먹은 것 */
  line: string | null
  /** line이 자막 인용인지 */
  quote: boolean
  /** 영상들에서 먹은 메뉴를 이어 붙인 것(검색용) */
  menu: string
  /** 나온 영상 수 */
  nv?: number
  /** 아래는 대표 영상 상세 요약에서 뽑은 것. 요약이 없으면 비어 있다 */
  rec?: string | null
  verdict?: string
  best?: string | null
  price?: string | null
  wait?: string | null
  park?: string | null
}

export interface Bounds {
  sw_lat: number
  sw_lng: number
  ne_lat: number
  ne_lng: number
}

export function inBounds(p: Pin, b: Bounds) {
  return p.lat >= b.sw_lat && p.lat <= b.ne_lat && p.lng >= b.sw_lng && p.lng <= b.ne_lng
}

/** API 응답: 유튜버 id를 표 한 장으로 빼고 핀에는 번호만 넣어 크기를 줄인다 */
export interface PinsPayload {
  channels: string[]
  pins: (Omit<Pin, 'ch'> & { ch: number[] })[]
}

export function decodePins(p: PinsPayload): Pin[] {
  return p.pins.map((x) => ({ ...x, ch: x.ch.map((i) => p.channels[i]) }))
}

// 핀은 한 번만 받는다. 토스 앱은 화면을 그리기 전에 미리 불러 둔다
const loading = new Map<string, Promise<PinsPayload>>()

/** 유튜브 프로필 사진은 800px 원본으로 오는데, 화면엔 40px 남짓이라 작은 크기로 받는다 */
export function faceSrc(url: string): string {
  return url.replace(/=s\d+(-|$)/, '=s120$1')
}

/** lang: 외국어 지도(en·ja·zh-cn·zh-tw)면 그 언어판 핀 */
export function loadPins(apiBase = '', lang?: string): Promise<PinsPayload> {
  const url = `${apiBase}/api/pins${lang ? `/${lang}` : ''}`
  let p = loading.get(url)
  if (!p) {
    p = fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    p.catch(() => loading.delete(url))
    loading.set(url, p)
  }
  return p
}
