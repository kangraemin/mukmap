// 홈 검색. 받아 둔 핀 안에서 바로 찾는다(서버 왕복 없음).
// 검색어를 띄어쓰기로 나눠, 낱말마다 가게 이름·메뉴·유튜버·지역·업종 중 어디든 들어 있으면 맞다고 본다.
import { REGIONS } from './constants'
import type { Pin } from './pins'

export interface Station {
  name: string
  lat: number
  lng: number
}

/** 가게·메뉴 검색에는 외부 API를 쓰지 않는다. 역명 뒤 노선명도 허용한다. */
export function isStationQuery(q: string): boolean {
  return q.length <= 80 && /^.+역(?:\s+\S*(?:선|철도|전철))?$/.test(q.trim())
}

/** lib/stations.json 한 줄: [역 이름(역 뺌), 위도, 경도, 같은 이름 역을 가르는 지역] */
export type StationRow = [string, number, number, string?]

let stationRows: Promise<StationRow[]> | null = null
/** 전국 역 목록(약 40KB). 검색창을 처음 누를 때 받는다 */
export function loadStations(): Promise<StationRow[]> {
  stationRows ??= import('./stations.json').then((m) => m.default as unknown as StationRow[]).catch(() => {
    stationRows = null
    return []
  })
  return stationRows
}

/** '강남역', '강남역 2호선'을 받아 둔 목록에서 바로 찾는다. 이름이 같으면 먼저, 그다음 앞이 같은 역 */
export function findStations(rows: StationRow[], q: string): Station[] {
  const term = norm(q.trim().replace(/\s+\S*(?:선|철도|전철)$/, '')).replace(/역$/, '')
  if (!term) return []
  const exact = rows.filter((r) => r[0] === term)
  const head = exact.length ? [] : rows.filter((r) => r[0].startsWith(term))
  return [...exact, ...head].slice(0, 3).map(([name, lat, lng, hint]) => ({ name: `${name}역${hint ? ` ${hint}` : ''}`, lat, lng }))
}

const REGION_ALIAS: Record<string, string> = {
  서울특별시: '서울', 서울시: '서울', 경기도: '경기', 인천광역시: '인천', 인천시: '인천',
  부산광역시: '부산', 부산시: '부산', 대구광역시: '대구', 대구시: '대구', 대전광역시: '대전', 대전시: '대전',
  광주광역시: '광주', 울산광역시: '울산', 울산시: '울산', 세종특별자치시: '세종', 세종시: '세종',
  강원도: '강원', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남',
  전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남',
  제주도: '제주', 제주특별자치도: '제주',
}

export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')

export interface SearchIndex {
  pins: Pin[]
  hay: string[]
  names: string[]
  /** 붙여 쓴 검색어(쯔양광주)를 가를 때 쓰는 낱말: 유튜버·시도·시군구 */
  vocab: string[]
}

export function buildIndex(pins: Pin[], channelName: (id: string) => string): SearchIndex {
  const vocab = new Set<string>(REGIONS)
  const hay = pins.map((p) => {
    const chs = p.ch.map(channelName)
    chs.forEach((c) => c && vocab.add(norm(c)))
    if (p.city) vocab.add(norm(p.city))
    return norm([p.name, p.category, p.region, p.city, p.menu, p.line, ...chs].filter(Boolean).join(' '))
  })
  return {
    pins,
    hay,
    names: pins.map((p) => norm(p.name)),
    vocab: Array.from(vocab).filter((v) => v.length >= 2).sort((a, b) => b.length - a.length),
  }
}

function split(tok: string, vocab: string[]): string[] {
  const out: string[] = []
  let rest = tok
  for (const v of vocab) {
    if (rest.includes(v)) {
      out.push(v)
      rest = rest.split(v).join(' ')
    }
  }
  return [...out, ...rest.split(' ').filter(Boolean)]
}

export function tokensOf(q: string, idx?: SearchIndex): string[] {
  const raw = q.trim().split(/\s+/).filter(Boolean).map((t) => norm(REGION_ALIAS[t] || t))
  if (!idx) return raw
  // 낱말 하나로는 아무것도 안 걸리면 아는 낱말(유튜버·지역)로 갈라 본다
  return raw.flatMap((t) => (t.length >= 3 && !idx.hay.some((h) => h.includes(t)) ? split(t, idx.vocab) : [t]))
}

/** 맞는 가게를 이름에 걸린 것부터 돌려준다 */
export function searchPins(idx: SearchIndex, q: string): Pin[] {
  const toks = tokensOf(q, idx)
  if (toks.length === 0) return []
  const whole = norm(q)
  const hits: { p: Pin; s: number }[] = []
  idx.pins.forEach((p, i) => {
    const h = idx.hay[i]
    if (!toks.every((t) => h.includes(t))) return
    const name = idx.names[i]
    let s = 0
    if (name === whole) s += 1000
    else if (name.startsWith(whole)) s += 300
    else if (name.includes(whole)) s += 200
    for (const t of toks) if (name.includes(t)) s += 20
    s += p.ch.length
    hits.push({ p, s })
  })
  return hits.sort((a, b) => b.s - a.s || b.p.date.localeCompare(a.p.date)).map((x) => x.p)
}
