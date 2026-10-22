// 공유 메시지. 받은 사람이 링크만 보고도 어떤 가게·어떤 목록인지 알고 눌러 보고 싶게 쓴다
import type { Pin } from './pins'

export interface ShareMessage {
  /** 받은 사람이 열 주소 쿼리(pin=12, yt=쯔양&region=서울) */
  query: string
  /** 링크 위에 붙일 글 */
  text: string
  /** 링크 미리보기 그림 */
  image?: string
}

const thumb = (vid: string | null | undefined) => (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : undefined)

// 이름 끝 글자에 받침이 있으면 '이', 없으면 '가'
function iGa(word: string) {
  const c = word.charCodeAt(word.length - 1) - 0xac00
  return c >= 0 && c <= 11171 && c % 28 === 0 ? '가' : '이'
}

function who(ids: string[], nameOf: (id: string) => string) {
  const names = ids.map(nameOf).filter(Boolean)
  if (!names.length) return '유튜버'
  return names.length > 2 ? `${names.slice(0, 2).join('·')} 외 ${names.length - 2}명` : names.join('·')
}

/** 지도 핀이 아직 안 왔을 때 상세 정보만으로 만드는 가게 공유 */
export function placeNameMessage(name: string, address: string | null, query: string): ShareMessage {
  const lines = [`🍽️ 유튜버가 다녀간 ‘${name}’`, address || '', '영상 속 장면이랑 위치, 먹맵에서 바로 보기 👇']
  return { query, text: lines.filter(Boolean).join('\n') }
}

/** 가게 하나(지도 카드·상세) */
export function placeMessage(p: Pin, query: string, nameOf: (id: string) => string): ShareMessage {
  const area = [p.region, p.city].filter(Boolean).join(' ')
  const w = who(p.ch, nameOf)
  // 자막 원문은 잘린 말이라 쓰지 않는다. 요약한 한 줄 평, 없으면 먹은 메뉴
  const ate = p.line && !p.quote ? p.line : p.menu.split(/,\s*/).slice(0, 3).join(', ')
  const lines = [
    `🍽️ ${w}${iGa(w)} 다녀간 ‘${p.name}’`,
    [area, p.category, p.rec].filter(Boolean).join(' · '),
    p.verdict ? `“${p.verdict}”` : ate ? `먹은 것: ${ate}` : '',
    [p.best && `대표 메뉴 ${p.best}`, p.price].filter(Boolean).join(' · '),
    '영상 속 장면이랑 위치, 먹맵에서 바로 보기 👇',
  ]
  return { query, text: lines.filter(Boolean).join('\n'), image: thumb(p.vid) }
}

/** 유튜버·지역·검색으로 거른 목록 */
export function listMessage(query: string, what: string, list: Pin[], nameOf: (id: string) => string): ShareMessage {
  // 영상 요약에서 강추가 나온 곳을 앞에 둔다
  const top = [...list].sort((a, b) => Number(b.rec === '강추') - Number(a.rec === '강추')).slice(0, 3)
  const chs = Array.from(new Set(list.flatMap((p) => p.ch)))
  const lines = [
    `🗺️ ${what} 맛집 ${list.length}곳`,
    `${who(chs, nameOf)}${iGa(who(chs, nameOf))} 직접 가서 먹어 본 곳만 지도에 모았어요`,
    top.length ? top.map((p) => `· ${p.name}${p.best ? ` (${p.best})` : ''}`).join('\n') : '',
    '먹맵에서 지도로 한눈에 보기 👇',
  ]
  return { query, text: lines.filter(Boolean).join('\n'), image: thumb(top[0]?.vid) }
}
