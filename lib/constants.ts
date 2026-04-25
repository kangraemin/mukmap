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

export const MARKER_COLORS = ['#FF6B35', '#2196F3', '#4CAF50', '#9C27B0', '#FF9800'] as const

export const RATINGS = ['강력추천', '추천', '보통', '비추', '언급없음'] as const

export const INITIAL_CHANNELS = [
  { id: 'UCehQiKylaW68H_OtRS36wGQ', name: '둘시네아' },
  { id: 'UCl23-Cci_SMqyGXE1T_LYUg', name: '성시경 먹을텐데' },
  { id: 'UCfpaSruWW3S4dibonKXENjA', name: '쯔양' },
  { id: 'UCA6KBBX8cLwYZNepxlE_7SA', name: '히밥' },
  { id: 'UCyn-K7rZLXjGl7VXGweIlcA', name: '백종원' },
] as const

export const CHANNEL_HUE_MAP: Record<string, number> = {
  'UCfpaSruWW3S4dibonKXENjA': 18,  // 쯔양
  'UCl23-Cci_SMqyGXE1T_LYUg': 32,  // 성시경
  'UCyn-K7rZLXjGl7VXGweIlcA': 95,  // 백종원
  'UCA6KBBX8cLwYZNepxlE_7SA': 42,  // 히밥
  'UCehQiKylaW68H_OtRS36wGQ': 200, // 둘시네아
}

export function getChannelHue(channelId: string, index = 0): number {
  return CHANNEL_HUE_MAP[channelId] ?? [18, 32, 95, 42, 200, 358, 140, 60, 220, 280][index % 10]
}

export function channelColor(hue: number) { return `oklch(0.62 0.16 ${hue})` }
export function channelTint(hue: number)  { return `oklch(0.96 0.02 ${hue})` }
export function channelDeep(hue: number)  { return `oklch(0.42 0.12 ${hue})` }
