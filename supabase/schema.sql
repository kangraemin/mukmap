-- pg_trgm 확장 (검색 자동완성용)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 유튜브 채널
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  subscriber_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 맛집
CREATE TABLE restaurants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  category TEXT DEFAULT '기타',
  region TEXT,
  naver_place_id TEXT,
  needs_review BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, address)
);

-- 유튜브 영상 (채널-맛집 연결)
CREATE TABLE videos (
  id SERIAL PRIMARY KEY,
  video_id TEXT NOT NULL,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  restaurant_id INTEGER REFERENCES restaurants(id),
  title TEXT,
  thumbnail_url TEXT,
  rating TEXT,
  summary TEXT,
  is_ad BOOLEAN DEFAULT FALSE,
  timestamp_seconds INTEGER,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, restaurant_id)
);

-- 수집 처리 큐
CREATE TABLE processing_queue (
  id SERIAL PRIMARY KEY,
  video_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(video_id)
);

-- 인덱스
CREATE INDEX idx_restaurants_region ON restaurants(region);
CREATE INDEX idx_restaurants_category ON restaurants(category);
CREATE INDEX idx_restaurants_lat_lng ON restaurants(lat, lng);
CREATE INDEX idx_restaurants_name_trgm ON restaurants USING gin(name gin_trgm_ops);
CREATE INDEX idx_videos_channel ON videos(channel_id);
CREATE INDEX idx_videos_restaurant ON videos(restaurant_id);
CREATE INDEX idx_videos_video_id ON videos(video_id);
CREATE INDEX idx_processing_queue_status ON processing_queue(status);

-- RLS: 모든 테이블 공개 읽기
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read channels" ON channels FOR SELECT USING (true);
CREATE POLICY "Public read restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Public read videos" ON videos FOR SELECT USING (true);
