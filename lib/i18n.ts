// 외국어 페이지(/en, /ja, /zh-cn, /zh-tw) 공용 값. next/* 를 쓰지 않는다(DetailPanel이 쓰고, 토스 앱도 가져다 쓴다).
// 화면 글자는 여기 사전으로, 영상 요약은 videos.i18n(언어별 번역본)으로 바꾼다.
import type { VideoDetail } from '@/lib/types'
import NAMES from './i18n-names.json'
import { romanize } from './romanize'

export const LANGS = ['en', 'ja', 'zh-cn', 'zh-tw'] as const
export type Lang = (typeof LANGS)[number]

export const isLang = (s: string): s is Lang => (LANGS as readonly string[]).includes(s)

/** videos.i18n 안의 키 */
export const DATA_KEY: Record<Lang, string> = { en: 'en', ja: 'ja', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW' }
/** hreflang·html lang 값 */
export const HREFLANG: Record<Lang, string> = { en: 'en', ja: 'ja', 'zh-cn': 'zh-Hans', 'zh-tw': 'zh-Hant' }
export const OG_LOCALE: Record<Lang, string> = { en: 'en_US', ja: 'ja_JP', 'zh-cn': 'zh_CN', 'zh-tw': 'zh_TW' }
/** 빵부스러기 nav의 aria-label */
export const NAV_LABEL: Record<Lang, string> = { en: 'Breadcrumb', ja: '現在地', 'zh-cn': '当前位置', 'zh-tw': '目前位置' }
export const LANG_NAME: Record<Lang | 'ko', string> = { ko: '한국어', en: 'English', ja: '日本語', 'zh-cn': '简体中文', 'zh-tw': '繁體中文' }

/** DetailPanel이 쓰는 글자. 기본은 한국어 */
export interface DetailLabels {
  chips: Partial<Record<keyof VideoDetail, string>>
  more: Partial<Record<keyof VideoDetail, string>>
  pros: string
  cons: string
  tips: string
  best: string
  watch: string
  directions: string
  /** 있으면 길찾기(네이버) 아래에 구글 지도 버튼을 둔다. 외국어 화면만 */
  googleMaps?: string
  share: string
  reviewOf: (name: string) => [string, string]
  visitors: (n: number) => string
  ate: string
  videoPrice: string
  visitSummary: string
  videos: (n: number) => string
  scene: (name: string) => string
  date: (iso: string) => string
}

export const KO_LABELS: DetailLabels = {
  chips: { price: '가격', wait: '웨이팅', parking: '주차', reserve: '예약', hours: '영업', solo_ok: '혼밥' },
  more: { vibe: '분위기', service: '서비스', revisit: '재방문', good_for: '이럴 때', value: '가성비' },
  pros: '좋았던 점', cons: '아쉬운 점', tips: '팁', best: '최고', watch: '영상 보기', directions: '길찾기', share: '공유',
  reviewOf: (name) => [name, '의 평'],
  visitors: (n) => `다녀간 유튜버 ${n}명`,
  ate: '먹은 것', videoPrice: '영상 속 가격', visitSummary: '방문 요약',
  videos: (n) => `나온 영상 ${n}개`,
  scene: (name) => `${name} 영상 장면`,
  date: (iso) => { const d = new Date(iso); return `${d.getFullYear()}년 ${d.getMonth() + 1}월` },
}

const ym = (iso: string) => { const d = new Date(iso); return [d.getFullYear(), d.getMonth() + 1] as const }

export const LABELS: Record<Lang, DetailLabels> = {
  en: {
    chips: { price: 'Price', wait: 'Wait', parking: 'Parking', reserve: 'Reservations', hours: 'Hours', solo_ok: 'Dining solo' },
    more: { vibe: 'Atmosphere', service: 'Service', revisit: 'Would return', good_for: 'Good for', value: 'Value' },
    pros: 'Liked', cons: 'Downsides', tips: 'Tips', best: 'Best', watch: 'Watch video', directions: 'Directions', googleMaps: 'Google Maps', share: 'Share',
    reviewOf: (name) => [name, '’s review'],
    visitors: (n) => `${n} YouTuber${n > 1 ? 's' : ''} visited`,
    ate: 'Ate', videoPrice: 'Price in video', visitSummary: 'Summary',
    videos: (n) => `${n} video${n > 1 ? 's' : ''}`,
    scene: (name) => `Scene of ${name} from the video`,
    date: (iso) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
  },
  ja: {
    chips: { price: '価格', wait: '待ち時間', parking: '駐車場', reserve: '予約', hours: '営業時間', solo_ok: 'ひとり客' },
    more: { vibe: '雰囲気', service: 'サービス', revisit: 'リピート', good_for: 'おすすめの場面', value: 'コスパ' },
    pros: '良かった点', cons: 'いまひとつな点', tips: 'ヒント', best: 'イチオシ', watch: '動画を見る', directions: '道順', googleMaps: 'Googleマップで見る', share: '共有',
    reviewOf: (name) => [name, 'の評価'],
    visitors: (n) => `訪れたYouTuber ${n}人`,
    ate: '食べたもの', videoPrice: '動画内の価格', visitSummary: '訪問まとめ',
    videos: (n) => `動画 ${n}本`,
    scene: (name) => `${name}の動画シーン`,
    date: (iso) => { const [y, m] = ym(iso); return `${y}年${m}月` },
  },
  'zh-cn': {
    chips: { price: '价格', wait: '排队', parking: '停车', reserve: '预约', hours: '营业时间', solo_ok: '一人食' },
    more: { vibe: '氛围', service: '服务', revisit: '回访', good_for: '适合场合', value: '性价比' },
    pros: '优点', cons: '不足', tips: '小贴士', best: '最佳', watch: '看视频', directions: '路线', googleMaps: '在谷歌地图中查看', share: '分享',
    reviewOf: (name) => [name, '的评价'],
    visitors: (n) => `${n}位YouTuber来过`,
    ate: '吃了什么', videoPrice: '视频中的价格', visitSummary: '探店摘要',
    videos: (n) => `${n}个视频`,
    scene: (name) => `${name}的视频画面`,
    date: (iso) => { const [y, m] = ym(iso); return `${y}年${m}月` },
  },
  'zh-tw': {
    chips: { price: '價格', wait: '排隊', parking: '停車', reserve: '訂位', hours: '營業時間', solo_ok: '一人用餐' },
    more: { vibe: '氛圍', service: '服務', revisit: '回訪', good_for: '適合場合', value: 'CP值' },
    pros: '優點', cons: '缺點', tips: '小提醒', best: '最推', watch: '看影片', directions: '路線', googleMaps: '在 Google 地圖查看', share: '分享',
    reviewOf: (name) => [name, '的評價'],
    visitors: (n) => `${n}位YouTuber造訪`,
    ate: '吃了什麼', videoPrice: '影片中的價格', visitSummary: '探店摘要',
    videos: (n) => `${n}支影片`,
    scene: (name) => `${name}的影片畫面`,
    date: (iso) => { const [y, m] = ym(iso); return `${y}年${m}月` },
  },
}

/** 지역 이름과 URL 조각(영문 소문자). DB의 region 값(한글 약칭)이 키다 */
export const REGIONS: Record<string, { slug: string } & Record<Lang, string>> = {
  서울: { slug: 'seoul', en: 'Seoul', ja: 'ソウル', 'zh-cn': '首尔', 'zh-tw': '首爾' },
  부산: { slug: 'busan', en: 'Busan', ja: '釜山', 'zh-cn': '釜山', 'zh-tw': '釜山' },
  대구: { slug: 'daegu', en: 'Daegu', ja: '大邱', 'zh-cn': '大邱', 'zh-tw': '大邱' },
  인천: { slug: 'incheon', en: 'Incheon', ja: '仁川', 'zh-cn': '仁川', 'zh-tw': '仁川' },
  광주: { slug: 'gwangju', en: 'Gwangju', ja: '光州', 'zh-cn': '光州', 'zh-tw': '光州' },
  대전: { slug: 'daejeon', en: 'Daejeon', ja: '大田', 'zh-cn': '大田', 'zh-tw': '大田' },
  울산: { slug: 'ulsan', en: 'Ulsan', ja: '蔚山', 'zh-cn': '蔚山', 'zh-tw': '蔚山' },
  세종: { slug: 'sejong', en: 'Sejong', ja: '世宗', 'zh-cn': '世宗', 'zh-tw': '世宗' },
  경기: { slug: 'gyeonggi', en: 'Gyeonggi', ja: '京畿道', 'zh-cn': '京畿道', 'zh-tw': '京畿道' },
  강원: { slug: 'gangwon', en: 'Gangwon', ja: '江原道', 'zh-cn': '江原道', 'zh-tw': '江原道' },
  충북: { slug: 'chungbuk', en: 'North Chungcheong', ja: '忠清北道', 'zh-cn': '忠清北道', 'zh-tw': '忠清北道' },
  충남: { slug: 'chungnam', en: 'South Chungcheong', ja: '忠清南道', 'zh-cn': '忠清南道', 'zh-tw': '忠清南道' },
  전북: { slug: 'jeonbuk', en: 'North Jeolla', ja: '全羅北道', 'zh-cn': '全罗北道', 'zh-tw': '全羅北道' },
  전남: { slug: 'jeonnam', en: 'South Jeolla', ja: '全羅南道', 'zh-cn': '全罗南道', 'zh-tw': '全羅南道' },
  경북: { slug: 'gyeongbuk', en: 'North Gyeongsang', ja: '慶尚北道', 'zh-cn': '庆尚北道', 'zh-tw': '慶尚北道' },
  경남: { slug: 'gyeongnam', en: 'South Gyeongsang', ja: '慶尚南道', 'zh-cn': '庆尚南道', 'zh-tw': '慶尚南道' },
  제주: { slug: 'jeju', en: 'Jeju', ja: '済州', 'zh-cn': '济州', 'zh-tw': '濟州' },
}

export const regionName = (region: string | null | undefined, lang: Lang) => (region && REGIONS[region]?.[lang]) || region || ''
export const regionBySlug = (slug: string) => Object.keys(REGIONS).find((k) => REGIONS[k].slug === slug) || null

/** 가게 분류(DB의 category 값 11개). 영상 번역이 없는 가게도 분류는 이걸로 보인다 */
export const CATEGORY: Record<string, Record<Lang, string>> = {
  한식: { en: 'Korean', ja: '韓国料理', 'zh-cn': '韩餐', 'zh-tw': '韓式料理' },
  고기: { en: 'Meat', ja: '肉料理', 'zh-cn': '肉类', 'zh-tw': '肉類' },
  구이: { en: 'BBQ', ja: '焼肉', 'zh-cn': '烤肉', 'zh-tw': '燒烤' },
  일식: { en: 'Japanese', ja: '和食', 'zh-cn': '日料', 'zh-tw': '日式料理' },
  중식: { en: 'Chinese', ja: '中華料理', 'zh-cn': '中餐', 'zh-tw': '中式料理' },
  해산물: { en: 'Seafood', ja: '海鮮', 'zh-cn': '海鲜', 'zh-tw': '海鮮' },
  양식: { en: 'Western', ja: '洋食', 'zh-cn': '西餐', 'zh-tw': '西式料理' },
  분식: { en: 'Street food', ja: '粉食(軽食)', 'zh-cn': '小吃', 'zh-tw': '小吃' },
  디저트: { en: 'Dessert', ja: 'デザート', 'zh-cn': '甜点', 'zh-tw': '甜點' },
  카페: { en: 'Cafe', ja: 'カフェ', 'zh-cn': '咖啡馆', 'zh-tw': '咖啡廳' },
  기타: { en: 'Other', ja: 'その他', 'zh-cn': '其他', 'zh-tw': '其他' },
}

/** 외국어 목록·가게 페이지 글자 */
export const PAGE: Record<Lang, {
  siteName: string
  home: { title: string; description: string; h1: string; question: string; answer: (n: number, y: number) => string; regions: string; recent: string }
  region: { title: (r: string, n: number) => string; description: (r: string, n: number, names: string) => string; question: (r: string) => string; answer: (r: string, n: number, names: string) => string }
  restaurant: { title: (name: string, names: string, area: string, cat: string) => string; description: (names: string, area: string, cat: string, name: string, what: string) => string }
  visitedBy: (names: string) => string
  openMap: string
  koreanNote: string
  places: (n: number) => string
  more: string
  langs: string
}> = {
  en: {
    siteName: 'MukMap',
    home: {
      title: 'Korean YouTuber Restaurant Map: Where Food YouTubers Ate in Korea | MukMap',
      description: 'Find restaurants in Korea that Korean food YouTubers actually visited on camera, with what they ate, prices, and the exact video scene.',
      h1: 'Restaurants Korean food YouTubers visited',
      question: 'Where do Korean food YouTubers eat?',
      answer: (n, y) => `MukMap lists ${n.toLocaleString('en-US')} restaurants across Korea that Korean mukbang and food YouTubers visited on camera, as of ${y}. Each page shows what they ordered, the price in the video, what they liked, and a link to the exact scene.`,
      regions: 'By region', recent: 'Recently featured',
    },
    region: {
      title: (r, n) => `${r} restaurants Korean YouTubers visited (${n}) | MukMap`,
      description: (r, n, names) => `${n} restaurants in ${r}, Korea featured by food YouTubers like ${names}. See the menu, price, and video scene.`,
      question: (r) => `Where do YouTubers eat in ${r}?`,
      answer: (r, n, names) => `${n} restaurants in ${r} have been visited on camera by Korean food YouTubers including ${names}. Below, newest videos first.`,
    },
    restaurant: {
      title: (name, names, area, cat) => `${name}: visited by ${names} (${area} ${cat}) | MukMap`,
      description: (names, area, cat, name, what) => `${name}, a ${cat} restaurant in ${area}, Korea, visited by ${names}. ${what}Address and a link to the video scene.`,
    },
    visitedBy: (names) => `Visited by ${names}`,
    openMap: 'Open map',
    koreanNote: 'Summaries are machine-translated from Korean videos. The address is in Korean so you can paste it into Naver Map or Kakao Map.',
    places: (n) => `${n} places`,
    more: 'More in this area',
    langs: 'Language',
  },
  ja: {
    siteName: 'モクマップ',
    home: {
      title: '韓国ユーチューバーが行ったお店マップ | モクマップ(MukMap)',
      description: '韓国のグルメ・モッパンYouTuberが実際に動画で訪れた韓国の飲食店を、食べたメニュー・価格・動画の場面と一緒に探せます。',
      h1: '韓国のグルメYouTuberが訪れたお店',
      question: '韓国のグルメYouTuberはどこで食べている?',
      answer: (n, y) => `モクマップは、韓国のモッパン・グルメYouTuberが動画で実際に訪れた韓国全国の飲食店${n.toLocaleString('ja-JP')}軒を${y}年時点でまとめています。各ページで注文したメニュー、動画内の価格、良かった点、その場面へのリンクを確認できます。`,
      regions: '地域別', recent: '最近の動画',
    },
    region: {
      title: (r, n) => `${r}の韓国YouTuber訪問店${n}軒 | モクマップ`,
      description: (r, n, names) => `${names}などのグルメYouTuberが訪れた${r}の飲食店${n}軒。メニュー・価格・動画の場面をチェック。`,
      question: (r) => `${r}でYouTuberが行ったお店は?`,
      answer: (r, n, names) => `${r}では${names}など韓国のグルメYouTuberが動画で訪れたお店が${n}軒あります。新しい動画順に並べています。`,
    },
    restaurant: {
      title: (name, names, area, cat) => `${name}、${names}が訪問(${area} ${cat}) | モクマップ`,
      description: (names, area, cat, name, what) => `${names}が訪れた${area}の${cat}「${name}」。${what}住所と動画の場面へのリンク。`,
    },
    visitedBy: (names) => `${names}が訪問`,
    openMap: '地図で見る',
    koreanNote: '要約は韓国語の動画から機械翻訳しています。住所は韓国語のままなので、NAVERマップやカカオマップに貼り付けて使えます。',
    places: (n) => `${n}軒`,
    more: 'この地域をもっと見る',
    langs: '言語',
  },
  'zh-cn': {
    siteName: '吃播地图',
    home: {
      title: '韩国YouTuber探店地图:韩国美食博主去过的餐厅 | MukMap',
      description: '查找韩国美食、吃播YouTuber在视频中实际去过的韩国餐厅,附点了什么、价格和视频片段。',
      h1: '韩国美食YouTuber去过的餐厅',
      question: '韩国美食YouTuber都去哪儿吃?',
      answer: (n, y) => `截至${y}年,MukMap收录了韩国吃播和美食YouTuber在视频中实际去过的全韩国${n}家餐厅。每个页面都有点的菜、视频中的价格、优点和对应视频片段的链接。`,
      regions: '按地区', recent: '最新视频',
    },
    region: {
      title: (r, n) => `${r}韩国YouTuber探店餐厅${n}家 | MukMap`,
      description: (r, n, names) => `${names}等美食YouTuber去过的${r}餐厅${n}家。查看菜单、价格和视频片段。`,
      question: (r) => `YouTuber在${r}去哪儿吃?`,
      answer: (r, n, names) => `在${r},${names}等韩国美食YouTuber在视频中去过${n}家餐厅。按最新视频排序。`,
    },
    restaurant: {
      title: (name, names, area, cat) => `${name},${names}探店(${area} ${cat}) | MukMap`,
      description: (names, area, cat, name, what) => `${names}去过的${area}${cat}「${name}」。${what}地址和视频片段链接。`,
    },
    visitedBy: (names) => `${names}去过`,
    openMap: '查看地图',
    koreanNote: '摘要由韩语视频机器翻译。地址保留韩语,可直接粘贴到Naver地图或Kakao地图。',
    places: (n) => `${n}家`,
    more: '这个地区的更多餐厅',
    langs: '语言',
  },
  'zh-tw': {
    siteName: '吃播地圖',
    home: {
      title: '韓國YouTuber探店地圖:韓國美食YouTuber去過的餐廳 | MukMap',
      description: '查找韓國美食、吃播YouTuber在影片中實際造訪的韓國餐廳,附點了什麼、價格和影片片段。',
      h1: '韓國美食YouTuber造訪的餐廳',
      question: '韓國美食YouTuber都去哪裡吃?',
      answer: (n, y) => `截至${y}年,MukMap收錄了韓國吃播和美食YouTuber在影片中實際造訪的全韓國${n}家餐廳。每個頁面都有點的菜、影片中的價格、優點和對應影片片段的連結。`,
      regions: '依地區', recent: '最新影片',
    },
    region: {
      title: (r, n) => `${r}韓國YouTuber探店餐廳${n}家 | MukMap`,
      description: (r, n, names) => `${names}等美食YouTuber造訪的${r}餐廳${n}家。查看菜單、價格和影片片段。`,
      question: (r) => `YouTuber在${r}去哪裡吃?`,
      answer: (r, n, names) => `在${r},${names}等韓國美食YouTuber在影片中造訪過${n}家餐廳。依最新影片排序。`,
    },
    restaurant: {
      title: (name, names, area, cat) => `${name},${names}探店(${area} ${cat}) | MukMap`,
      description: (names, area, cat, name, what) => `${names}造訪的${area}${cat}「${name}」。${what}地址和影片片段連結。`,
    },
    visitedBy: (names) => `${names}造訪`,
    openMap: '查看地圖',
    koreanNote: '摘要由韓語影片機器翻譯。地址保留韓語,可直接貼到Naver地圖或Kakao地圖。',
    places: (n) => `${n}家`,
    more: '這個地區的更多餐廳',
    langs: '語言',
  },
}

/** 외국어 가게 이름. 현지 간판·지도 검색용으로 한국어 이름을 같이 둔다. 번역 전이면 로마자로 읽게 한다 */
export const bilingualName = (label: string | null | undefined, ko: string) => {
  label ||= romanize(ko)
  return label === ko ? ko : label.includes('(') ? `${label} · ${ko}` : `${label} (${ko})`
}

/** 언어별 경로. lang이 없으면 한국어(원래 주소) */
export function langPath(lang: Lang | null, ...parts: string[]) {
  const tail = parts.map((p) => encodeURIComponent(p)).join('/')
  return lang ? `/${lang}${tail ? `/${tail}` : ''}` : `/${tail}`
}

type Names = Record<string, Record<string, string>>
const CITIES = NAMES.cities as Names
const CHANNELS = NAMES.channels as Names

/** 구·시 이름. 같은 이름이 여러 지역에 있으면 '지역 구' 전체가 키다. 번역이 없으면 한국어 그대로 */
export const cityName = (region: string | null | undefined, city: string | null | undefined, lang: Lang) =>
  (city && (CITIES[`${region} ${city}`] || CITIES[city])?.[DATA_KEY[lang]]) || city || ''

export const channelName = (name: string, lang: Lang) => CHANNELS[name]?.[DATA_KEY[lang]] || name
