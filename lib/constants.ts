export const REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '대전', '광주',
  '울산', '세종', '강원', '충북', '충남', '전북', '전남',
  '경북', '경남', '제주'
] as const

export const CATEGORIES = [
  '한식', '일식', '중식', '양식', '카페/디저트',
  '분식', '고기/구이', '해산물', '기타'
] as const

export const DEFAULT_CENTER = { lat: 36.5, lng: 127.5 } // 한국 중심
export const DEFAULT_ZOOM = 7 // 한국 전체
