-- pg_trgm 확장 (검색 자동완성용)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 유튜브 채널
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  subscriber_count INTEGER DEFAULT 0,
  slug TEXT UNIQUE,  -- URL용 한글 이름 (쯔양, 츄릅켠 …)
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
  city TEXT,  -- 시군구 ("광주광역시 동구" → region 광주, city 동구)
  naver_place_id TEXT,
  needs_review BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE,
  closed_checked_at TIMESTAMPTZ,  -- 월간 폐업 재점검 시각
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
  view_count BIGINT DEFAULT 0,
  menu TEXT,   -- 먹은 메뉴와 양
  price TEXT,  -- 영상에서 말한 가격
  quote TEXT,  -- 유튜버 발언 원문 (자막에 있는 문장만)
  why TEXT,    -- 추천 이유 / 아쉬운 점
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
  extraction_result JSONB,
  prompt_version TEXT,  -- 이 버전으로 끝난 영상은 다시 추출하지 않는다
  UNIQUE(video_id)
);

-- 인덱스
CREATE INDEX idx_restaurants_region ON restaurants(region);
CREATE INDEX idx_restaurants_region_city ON restaurants(region, city);
CREATE UNIQUE INDEX uq_restaurants_place ON restaurants(naver_place_id) WHERE naver_place_id IS NOT NULL;
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
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;  -- 정책 없음 = service key만 접근

CREATE POLICY "Public read channels" ON channels FOR SELECT USING (true);
CREATE POLICY "Public read restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Public read videos" ON videos FOR SELECT USING (true);
