// 받침 유무에 따라 조사를 고른다: 쯔양은 / 히밥은 / 츄릅켠은 / 김사원은 / 둘시네아는
function hasBatchim(word: string) {
  const ch = word.trim().slice(-1)
  const code = ch.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) return false
  return code % 28 !== 0
}

export function eunNeun(word: string) {
  return `${word}${hasBatchim(word) ? '은' : '는'}`
}

export function iGa(word: string) {
  return `${word}${hasBatchim(word) ? '이' : '가'}`
}
