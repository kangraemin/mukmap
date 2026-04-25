export interface Channel {
  id: string
  name: string
  thumbnail_url: string | null
  subscriber_count: number
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
}

export interface RestaurantWithVideos extends Restaurant {
  videos: (Video & {
    channel_name: string
    channel_thumbnail: string | null
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
