// 한글을 국어의 로마자 표기법(2000)에 가깝게 옮긴다. 번역 전 가게 이름을 외국인이 읽을 수 있게 하는 용도라
// 연음·비음화 정도만 반영하고 나머지 음운 규칙은 생략한다

const INITIAL = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const VOWEL = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
// 받침: [자음 앞·끝소리, 모음 앞에서 넘어가는 앞 받침, 넘어가는 소리]
const FINAL: [string, string, string][] = [
  ['', '', ''], ['k', '', 'g'], ['k', '', 'kk'], ['k', 'k', 's'], ['n', '', 'n'], ['n', 'n', 'j'], ['n', 'n', ''],
  ['t', '', 'd'], ['l', '', 'r'], ['k', 'l', 'g'], ['m', 'l', 'm'], ['l', 'l', 'b'], ['l', 'l', 's'], ['l', 'l', 't'],
  ['p', 'l', 'p'], ['l', 'l', ''], ['m', '', 'm'], ['p', '', 'b'], ['p', 'p', 's'], ['t', '', 's'], ['t', '', 'ss'],
  ['ng', 'ng', ''], ['t', '', 'j'], ['t', '', 'ch'], ['k', '', 'k'], ['t', '', 't'], ['p', '', 'p'], ['t', '', ''],
]
// 뒤 글자가 ㄴ·ㅁ으로 시작하면 k·t·p가 ng·n·m으로 바뀐다(국물 → gungmul)
const NASAL: Record<string, string> = { k: 'ng', t: 'n', p: 'm' }

const syl = (c: string) => {
  const n = c.charCodeAt(0) - 0xac00
  return n >= 0 && n < 11172 ? { i: Math.floor(n / 588), v: Math.floor((n % 588) / 28), f: n % 28 } : null
}

export function romanize(ko: string): string {
  const chars = Array.from(ko)
  let out = ''
  let carry: string | null = null
  chars.forEach((c, k) => {
    const s = syl(c)
    if (!s) {
      out += c
      carry = null
      return
    }
    const next = syl(chars[k + 1] || '')
    const head: string = carry ?? INITIAL[s.i]
    carry = null
    let tail = FINAL[s.f][0]
    if (next && s.f && next.i === 11 && s.f !== 21) {
      // 모음으로 시작하는 뒤 글자로 받침이 넘어간다(맛있다 → masitda)
      tail = FINAL[s.f][1]
      carry = FINAL[s.f][2]
    } else if (next && (next.i === 2 || next.i === 6) && NASAL[tail]) tail = NASAL[tail]
    else if (next && next.i === 5) {
      // ㄹ 앞: 설렁 → seolleong, 신림 → sillim, 종로 → jongno
      if (s.f === 8) carry = 'l'
      else if (s.f === 4) [tail, carry] = ['l', 'l']
      else if (tail === 'ng' || tail === 'm') carry = 'n'
    }
    out += head + VOWEL[s.v] + tail
  })
  return out.replace(/(^|\s)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
}
