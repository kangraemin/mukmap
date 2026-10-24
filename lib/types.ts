export interface Channel {
  id: string
  name: string
  thumbnail_url: string | null
  subscriber_count: number
  slug: string | null
  created_at: string
}

export interface Restaurant {
  id: number
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  category: string
  region: string | null
  city: string | null
  naver_place_id: string | null
  needs_review: boolean
  is_visible: boolean
  created_at: string
}

export interface Video {
  id: number
  video_id: string
  channel_id: string
  restaurant_id: number | null
  title: string | null
  thumbnail_url: string | null
  rating: string | null
  summary: string | null
  is_ad: boolean
  timestamp_seconds: number | null
  published_at: string | null
  created_at: string
  view_count: number | null
  menu: string | null
  price: string | null
  quote: string | null
  why: string | null
  /** 영상에서 말한 것만 뽑은 상세 요약. 안 말한 칸은 없다 */
  detail?: VideoDetail | null
}

export interface VideoDish {
  name: string
  comment?: string
  best?: boolean
  ts?: string
}

export interface VideoDetail {
  recommend?: '강추' | '추천' | '보통' | '아쉬움' | string
  /** 외국어 번역본에만 있다: recommend(한국어 값)를 그 언어로 쓴 것 */
  recommend_label?: string
  verdict?: string
  dishes?: VideoDish[]
  pros?: string[]
  cons?: string[]
  price?: string
  wait?: string
  hours?: string
  parking?: string
  reserve?: string
  solo_ok?: string
  taste?: string
  portion?: string
  spicy_salty?: string
  vibe?: string
  service?: string
  revisit?: string
  good_for?: string
  value?: string
  tips?: string[]
}

export interface RestaurantWithVideos extends Restaurant {
  /** 외국어로 바꾼 가게의 원래(한국어) 이름. 지도 검색용 */
  name_ko?: string
  videos: (Video & {
    channel_name: string
    channel_thumbnail: string | null
    channel_slug?: string | null
  })[]
}

export interface ChannelWithCount extends Channel {
  restaurant_count: number
}

export interface SearchResult {
  restaurants: Pick<Restaurant, 'id' | 'name' | 'address' | 'category'>[]
  channels: Pick<Channel, 'id' | 'name' | 'thumbnail_url'>[]
  regions: string[]
}
