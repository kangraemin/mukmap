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
