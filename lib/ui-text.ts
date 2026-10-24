// 지도 앱(HomeExplorer와 그 안 컴포넌트) 화면 글자. 기본은 한국어, 외국어 첫 화면(/en 등)은 그 언어판을 넘긴다.
// next/* 를 쓰지 않는다(토스 앱도 가져다 쓴다). 토스 앱·한국어 홈은 KO_UI 그대로라 화면이 바뀌지 않는다
import { CATEGORY, cityName, regionName, type Lang } from './i18n'
import { iGa } from './josa'

export interface UiText {
  loadFail: string
  liked: string
  unliked: string
  shared: string
  copied: string
  openScene: string
  placeOnly: (place: string) => string
  clearPlace: string
  pickYoutuber: string
  all: string
  likedN: (n: number) => string
  strongOnly: string
  noPlacesHere: string
  clearSearch: string
  backToList: string
  inMap: string
  likedPlaces: string
  quoted: (q: string) => string
  count: (n: number) => string
  loading: string
  share: string
  sort: string
  sortVisitors: string
  sortLatest: string
  emptyText: (q: string) => string
  emptyChannel: (name: string | null) => string
  emptyMap: string
  emptyHint: string
  listTitle: string
  brand: string
  tagline: string
  viewMap: string
  detailTitle: string
  back: string
  pinsFail: string
  retryHint: string
  retry: string
  cluster: (n: number) => string
  mapLoading: string
  mapError: string
  mapRetry: string
  placeholder: string
  searchLabel: string
  clearQuery: string
  indexLoading: string
  stationPending: string
  noMatch: (q: string) => string
  noMatchHint: string
  stationGo: string
  /** ‘q’ 가게 N곳 지도에서 보기: 굵게·보통·굵게·보통 순서 */
  seeAll: (q: string, n: number) => [string, string, string, string]
  youtuber: string
  region: string
  osm: string
  best: string
  price: string
  wait: string
  park: string
  openDetail: (name: string) => string
  ate: string
  videos: (n: number) => string
  like: string
  more: string
  close: string
  others: (name: string, n: number) => string
  /** 강추/추천/보통/아쉬움 → 보이는 글자 */
  rec: Record<string, string>
  /** DB의 한글 지역·구 → 보이는 글자 */
  area: (region: string | null | undefined, city?: string | null) => string
  regionLabel: (region: string) => string
  category: (c: string) => string
}

const ko = (q: string) => `‘${q}’`

export const KO_UI: UiText = {
  loadFail: '가게 정보를 불러오지 못했어요.',
  liked: '찜했어요',
  unliked: '찜을 풀었어요',
  shared: '공유 링크를 만들었어요',
  copied: '링크를 복사했어요',
  openScene: '유튜브에서 그 장면부터 열어요',
  placeOnly: (p) => `${p}만`,
  clearPlace: '지역 조건 풀기',
  pickYoutuber: '유튜버 고르기',
  all: '전체',
  likedN: (n) => `찜 ${n}`,
  strongOnly: '강추만',
  noPlacesHere: '(이 화면엔 가게 없음)',
  clearSearch: '검색 조건 풀기',
  backToList: '목록으로',
  inMap: '이 지도 안 ',
  likedPlaces: '찜한 곳 ',
  quoted: (q) => `${ko(q)} `,
  count: (n) => `${n}곳`,
  loading: '불러오는 중',
  share: '공유',
  sort: '정렬',
  sortVisitors: '여러 명 간 순',
  sortLatest: '최근 영상순',
  emptyText: (q) => `${ko(q)}에 맞는 가게가 이 지도 안에 없어요.`,
  emptyChannel: (name) => `${iGa(name || '고른 유튜버')} 다녀간 가게가 이 지도 안에 없어요.`,
  emptyMap: '이 지도 안에는 아직 가게가 없어요.',
  emptyHint: '지도를 줄이거나 다른 지역으로 옮겨 보세요.',
  listTitle: '가게 목록',
  brand: '먹맵',
  tagline: '유튜버가 실제로 가서 먹은 집',
  viewMap: '지도 보기',
  detailTitle: '가게 정보',
  back: '뒤로',
  pinsFail: '가게 목록을 불러오지 못했어요',
  retryHint: '인터넷 연결을 확인하고 다시 불러와 보세요.',
  retry: '다시 불러오기',
  cluster: (n) => `가게 ${n}곳`,
  mapLoading: '지도를 불러오는 중',
  mapError: '지도를 불러오지 못했어요. 네트워크를 확인하고 다시 시도하세요.',
  mapRetry: '다시 시도',
  placeholder: '가게, 메뉴, 유튜버, 지역, 역',
  searchLabel: '검색',
  clearQuery: '검색어 지우기',
  indexLoading: '가게 목록을 받는 중이에요…',
  stationPending: '역을 찾는 중이에요…',
  noMatch: (q) => `${ko(q)}에 맞는 가게가 없어요`,
  noMatchHint: '메뉴(국밥), 유튜버(쯔양), 지역(광주)을 띄어 써서 찾아보세요.',
  stationGo: ' — 지도 이동',
  seeAll: (q, n) => [ko(q), ' 가게 ', `${n}곳`, ' 지도에서 보기'],
  youtuber: '유튜버',
  region: '지역',
  osm: '역 위치 © OpenStreetMap 기여자',
  best: '최고',
  price: '가격',
  wait: '웨이팅',
  park: '주차',
  openDetail: (name) => `${name} 자세히 보기`,
  ate: '먹은 것',
  videos: (n) => `영상 ${n}개`,
  like: '찜',
  more: '자세히',
  close: '닫기',
  others: (name, n) => `${name} 외 ${n}명`,
  rec: { 강추: '강추', 추천: '추천', 보통: '보통', 아쉬움: '아쉬움' },
  area: (region, city) => [region, city].filter(Boolean).join(' '),
  regionLabel: (r) => r,
  category: (c) => c,
}

type Words = Omit<UiText, 'area' | 'regionLabel' | 'category'>

const WORDS: Record<Lang, Words> = {
  en: {
    loadFail: 'Couldn’t load this restaurant.',
    liked: 'Saved',
    unliked: 'Removed from saved',
    shared: 'Share link created',
    copied: 'Link copied',
    openScene: 'Opening YouTube at that scene',
    placeOnly: (p) => `${p} only`,
    clearPlace: 'Clear area filter',
    pickYoutuber: 'Choose a YouTuber',
    all: 'All',
    likedN: (n) => `Saved ${n}`,
    strongOnly: 'Top picks',
    noPlacesHere: '(no places on this map)',
    clearSearch: 'Clear search',
    backToList: 'Back to list',
    inMap: 'On this map: ',
    likedPlaces: 'Saved: ',
    quoted: (q) => `“${q}”: `,
    count: (n) => `${n.toLocaleString('en-US')} place${n === 1 ? '' : 's'}`,
    loading: 'Loading',
    share: 'Share',
    sort: 'Sort',
    sortVisitors: 'Most YouTubers',
    sortLatest: 'Newest video',
    emptyText: (q) => `No places match “${q}” on this map.`,
    emptyChannel: (name) => `No places ${name || 'this YouTuber'} visited on this map.`,
    emptyMap: 'No places on this map yet.',
    emptyHint: 'Zoom out or move to another area.',
    listTitle: 'Restaurant list',
    brand: 'MukMap',
    tagline: 'Where Korean food YouTubers actually ate',
    viewMap: 'Map',
    detailTitle: 'Restaurant',
    back: 'Back',
    pinsFail: 'Couldn’t load restaurants',
    retryHint: 'Check your connection and try again.',
    retry: 'Try again',
    cluster: (n) => `${n} places`,
    mapLoading: 'Loading map',
    mapError: 'Couldn’t load the map. Check your connection and try again.',
    mapRetry: 'Try again',
    placeholder: 'Restaurant, dish, YouTuber, area',
    searchLabel: 'Search',
    clearQuery: 'Clear search',
    indexLoading: 'Loading restaurants…',
    stationPending: 'Finding station…',
    noMatch: (q) => `No places match “${q}”`,
    noMatchHint: 'Try a dish (bibimbap), YouTuber (Tzuyang) or area (Busan), separated by spaces.',
    stationGo: ' — go there',
    seeAll: (q, n) => [`“${q}”`, ': see ', `${n} places`, ' on the map'],
    youtuber: 'YouTuber',
    region: 'Area',
    osm: 'Station locations © OpenStreetMap contributors',
    best: 'Best',
    price: 'Price',
    wait: 'Wait',
    park: 'Parking',
    openDetail: (name) => `Open ${name}`,
    ate: 'Ate',
    videos: (n) => `${n} video${n === 1 ? '' : 's'}`,
    like: 'Save',
    more: 'Details',
    close: 'Close',
    others: (name, n) => `${name} +${n}`,
    rec: { 강추: 'Must-try', 추천: 'Recommended', 보통: 'Okay', 아쉬움: 'Meh' },
  },
  ja: {
    loadFail: 'お店の情報を読み込めませんでした。',
    liked: '保存しました',
    unliked: '保存を解除しました',
    shared: '共有リンクを作成しました',
    copied: 'リンクをコピーしました',
    openScene: 'YouTubeでその場面から開きます',
    placeOnly: (p) => `${p}のみ`,
    clearPlace: '地域の絞り込みを解除',
    pickYoutuber: 'YouTuberを選ぶ',
    all: 'すべて',
    likedN: (n) => `保存 ${n}`,
    strongOnly: '激推しのみ',
    noPlacesHere: '(この地図にお店なし)',
    clearSearch: '検索条件を解除',
    backToList: '一覧へ戻る',
    inMap: 'この地図内 ',
    likedPlaces: '保存したお店 ',
    quoted: (q) => `「${q}」 `,
    count: (n) => `${n.toLocaleString('ja-JP')}軒`,
    loading: '読み込み中',
    share: '共有',
    sort: '並べ替え',
    sortVisitors: '訪問YouTuberが多い順',
    sortLatest: '新しい動画順',
    emptyText: (q) => `この地図内に「${q}」に合うお店はありません。`,
    emptyChannel: (name) => `この地図内に${name || 'このYouTuber'}が訪れたお店はありません。`,
    emptyMap: 'この地図内にはまだお店がありません。',
    emptyHint: '地図を縮小するか、別の地域に移動してください。',
    listTitle: 'お店一覧',
    brand: 'モクマップ',
    tagline: '韓国のYouTuberが実際に食べたお店',
    viewMap: '地図',
    detailTitle: 'お店情報',
    back: '戻る',
    pinsFail: 'お店一覧を読み込めませんでした',
    retryHint: '接続を確認して、もう一度読み込んでください。',
    retry: '再読み込み',
    cluster: (n) => `お店${n}軒`,
    mapLoading: '地図を読み込み中',
    mapError: '地図を読み込めませんでした。接続を確認して、もう一度お試しください。',
    mapRetry: '再試行',
    placeholder: 'お店・料理・YouTuber・地域',
    searchLabel: '検索',
    clearQuery: '検索語を消す',
    indexLoading: 'お店一覧を読み込み中…',
    stationPending: '駅を探しています…',
    noMatch: (q) => `「${q}」に合うお店はありません`,
    noMatchHint: '料理(ビビンバ)、YouTuber(ツヤン)、地域(釜山)をスペースで区切って探してみてください。',
    stationGo: ' — 地図で移動',
    seeAll: (q, n) => [`「${q}」`, 'のお店', `${n}軒`, 'を地図で見る'],
    youtuber: 'YouTuber',
    region: '地域',
    osm: '駅の位置 © OpenStreetMap contributors',
    best: 'イチオシ',
    price: '価格',
    wait: '待ち時間',
    park: '駐車場',
    openDetail: (name) => `${name}の詳細を見る`,
    ate: '食べたもの',
    videos: (n) => `動画${n}本`,
    like: '保存',
    more: '詳細',
    close: '閉じる',
    others: (name, n) => `${name} ほか${n}人`,
    rec: { 강추: '激推し', 추천: 'おすすめ', 보통: 'ふつう', 아쉬움: 'いまひとつ' },
  },
  'zh-cn': {
    loadFail: '无法加载餐厅信息。',
    liked: '已收藏',
    unliked: '已取消收藏',
    shared: '已生成分享链接',
    copied: '已复制链接',
    openScene: '在YouTube从该片段开始播放',
    placeOnly: (p) => `仅${p}`,
    clearPlace: '取消地区筛选',
    pickYoutuber: '选择YouTuber',
    all: '全部',
    likedN: (n) => `收藏 ${n}`,
    strongOnly: '强推',
    noPlacesHere: '(此地图内没有餐厅)',
    clearSearch: '取消搜索条件',
    backToList: '返回列表',
    inMap: '此地图内 ',
    likedPlaces: '已收藏 ',
    quoted: (q) => `“${q}” `,
    count: (n) => `${n}家`,
    loading: '加载中',
    share: '分享',
    sort: '排序',
    sortVisitors: '去过的YouTuber最多',
    sortLatest: '最新视频',
    emptyText: (q) => `此地图内没有符合“${q}”的餐厅。`,
    emptyChannel: (name) => `此地图内没有${name || '该YouTuber'}去过的餐厅。`,
    emptyMap: '此地图内还没有餐厅。',
    emptyHint: '请缩小地图或移动到其他地区。',
    listTitle: '餐厅列表',
    brand: '吃播地图',
    tagline: '韩国YouTuber真正去吃过的店',
    viewMap: '地图',
    detailTitle: '餐厅信息',
    back: '返回',
    pinsFail: '无法加载餐厅列表',
    retryHint: '请检查网络连接后重新加载。',
    retry: '重新加载',
    cluster: (n) => `${n}家餐厅`,
    mapLoading: '地图加载中',
    mapError: '无法加载地图。请检查网络后重试。',
    mapRetry: '重试',
    placeholder: '餐厅、菜品、YouTuber、地区',
    searchLabel: '搜索',
    clearQuery: '清除搜索词',
    indexLoading: '正在加载餐厅列表…',
    stationPending: '正在查找车站…',
    noMatch: (q) => `没有符合“${q}”的餐厅`,
    noMatchHint: '可用空格分开输入菜品(拌饭)、YouTuber(Tzuyang)、地区(釜山)。',
    stationGo: ' — 移动地图',
    seeAll: (q, n) => [`“${q}”`, '共', `${n}家`, ',在地图上查看'],
    youtuber: 'YouTuber',
    region: '地区',
    osm: '车站位置 © OpenStreetMap 贡献者',
    best: '最佳',
    price: '价格',
    wait: '排队',
    park: '停车',
    openDetail: (name) => `查看${name}详情`,
    ate: '吃了',
    videos: (n) => `${n}个视频`,
    like: '收藏',
    more: '详情',
    close: '关闭',
    others: (name, n) => `${name}等${n + 1}人`,
    rec: { 강추: '强推', 추천: '推荐', 보통: '一般', 아쉬움: '遗憾' },
  },
  'zh-tw': {
    loadFail: '無法載入餐廳資訊。',
    liked: '已收藏',
    unliked: '已取消收藏',
    shared: '已建立分享連結',
    copied: '已複製連結',
    openScene: '在YouTube從該片段開始播放',
    placeOnly: (p) => `僅${p}`,
    clearPlace: '取消地區篩選',
    pickYoutuber: '選擇YouTuber',
    all: '全部',
    likedN: (n) => `收藏 ${n}`,
    strongOnly: '大推',
    noPlacesHere: '(此地圖內沒有餐廳)',
    clearSearch: '取消搜尋條件',
    backToList: '返回列表',
    inMap: '此地圖內 ',
    likedPlaces: '已收藏 ',
    quoted: (q) => `「${q}」 `,
    count: (n) => `${n}家`,
    loading: '載入中',
    share: '分享',
    sort: '排序',
    sortVisitors: '造訪YouTuber最多',
    sortLatest: '最新影片',
    emptyText: (q) => `此地圖內沒有符合「${q}」的餐廳。`,
    emptyChannel: (name) => `此地圖內沒有${name || '該YouTuber'}造訪的餐廳。`,
    emptyMap: '此地圖內還沒有餐廳。',
    emptyHint: '請縮小地圖或移動到其他地區。',
    listTitle: '餐廳列表',
    brand: '吃播地圖',
    tagline: '韓國YouTuber真的去吃過的店',
    viewMap: '地圖',
    detailTitle: '餐廳資訊',
    back: '返回',
    pinsFail: '無法載入餐廳列表',
    retryHint: '請檢查網路連線後重新載入。',
    retry: '重新載入',
    cluster: (n) => `${n}家餐廳`,
    mapLoading: '地圖載入中',
    mapError: '無法載入地圖。請檢查網路後重試。',
    mapRetry: '重試',
    placeholder: '餐廳、菜色、YouTuber、地區',
    searchLabel: '搜尋',
    clearQuery: '清除搜尋字詞',
    indexLoading: '正在載入餐廳列表…',
    stationPending: '正在尋找車站…',
    noMatch: (q) => `沒有符合「${q}」的餐廳`,
    noMatchHint: '可用空格分開輸入菜色(拌飯)、YouTuber(Tzuyang)、地區(釜山)。',
    stationGo: ' — 移動地圖',
    seeAll: (q, n) => [`「${q}」`, '共', `${n}家`, ',在地圖上查看'],
    youtuber: 'YouTuber',
    region: '地區',
    osm: '車站位置 © OpenStreetMap 貢獻者',
    best: '最推',
    price: '價格',
    wait: '排隊',
    park: '停車',
    openDetail: (name) => `查看${name}詳情`,
    ate: '吃了',
    videos: (n) => `${n}支影片`,
    like: '收藏',
    more: '詳情',
    close: '關閉',
    others: (name, n) => `${name}等${n + 1}人`,
    rec: { 강추: '大推', 추천: '推薦', 보통: '普通', 아쉬움: '可惜' },
  },
}

export function uiText(lang?: Lang | null): UiText {
  if (!lang) return KO_UI
  return {
    ...WORDS[lang],
    area: (region, city) => [regionName(region, lang), cityName(region, city, lang)].filter(Boolean).join(' '),
    regionLabel: (r) => regionName(r, lang),
    category: (c) => CATEGORY[c]?.[lang] || c,
  }
}
