# MukMap 기술 설계서

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────┐
│                 사용자 브라우저                     │
│  Next.js 14 (RSC + Client Components)            │
│  카카오맵 JavaScript SDK v3                       │
└────────────────────┬────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────┐
│               Vercel Edge Network                │
│  Next.js API Routes (/api/*)                     │
│  ISR 정적 페이지 (맛집 상세, 유튜버 프로필)         │
└────────────────────┬────────────────────────────┘
                     │ Supabase REST API
                     ▼
┌─────────────────────────────────────────────────┐
│                  Supabase                        │
│  PostgreSQL (데이터 저장)                          │
│  Row Level Security (공개 읽기 전용)               │
└────────────────────▲────────────────────────────┘
                     │ Supabase Python Client
┌────────────────────┴────────────────────────────┐
│             Railway Cron Job (Python)             │
│  6시간마다 실행                                    │
│  1. YouTube Data API → 신규 영상 감지              │
│  2. youtube-transcript-api → 자막 추출            │
│  3. Claude Haiku API → 가게명/평가 추출            │
│  4. 네이버 로컬 검색 API → 좌표 변환               │
│  5. Supabase INSERT/UPSERT                       │
└─────────────────────────────────────────────────┘
```

## 2. 기술 스택

| 계층 | 기술 | 선택 이유 |
|------|------|----------|
| 프론트엔드 | Next.js 14 (App Router) | RSC로 SEO 최적화, ISR로 정적 페이지 생성 |
| UI | Tailwind CSS | 빠른 프로토타이핑, 별도 CSS 파일 불필요 |
| 지도 | 카카오맵 JS SDK v3 | 한국 지도 정확도, 무료 30만회/일 |
| DB | Supabase (PostgreSQL) | 무료 tier, REST API 자동 생성, RLS |
| 크론잡 | Railway (Python 3.11) | Docker 지원, 크론 스케줄러, 고정 IP |
| LLM | Claude Haiku (claude-haiku-4-5-20251001) | 가격 대비 성능. 맛집 추출에 충분 |
| 호스팅 | Vercel | Next.js 최적화, 자동 배포, 무료 tier |

## 3. 데이터베이스 스키마

```sql
-- 유튜브 채널
CREATE TABLE channels (
  id TEXT PRIMARY KEY,                    -- YouTube channel ID (UC...)
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  subscriber_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 맛집
CREATE TABLE restaurants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,                           -- 도로명 주소
  lat DOUBLE PRECISION,                   -- 위도 (nullable: 좌표 못 찾은 경우)
  lng DOUBLE PRECISION,                   -- 경도
  category TEXT DEFAULT '기타',            -- 한식/일식/중식/양식/카페/분식/고기/해산물/기타
  region TEXT,                            -- 시/도 (서울/경기/부산 등)
  naver_place_id TEXT,                    -- 네이버 지도 연동용
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, address)                   -- 같은 이름+주소 중복 방지
);

-- 유튜브 영상 (채널-맛집 연결)
CREATE TABLE videos (
  id SERIAL PRIMARY KEY,
  video_id TEXT NOT NULL,                 -- YouTube video ID
  channel_id TEXT NOT NULL REFERENCES channels(id),
  restaurant_id INTEGER REFERENCES restaurants(id),
  title TEXT,
  thumbnail_url TEXT,
  rating TEXT,                            -- 강력추천/추천/보통/비추/언급없음
  summary TEXT,                           -- Claude 추출 한줄 요약
  is_ad BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, restaurant_id)         -- 같은 영상+같은 가게 중복 방지
);

-- 수집 처리 큐
CREATE TABLE processing_queue (
  id SERIAL PRIMARY KEY,
  video_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',          -- pending/processing/done/failed/no_transcript/no_restaurant/api_blocked/llm_error
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

-- pg_trgm 확장 (검색 자동완성용)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- RLS: 모든 테이블 공개 읽기
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read channels" ON channels FOR SELECT USING (true);
CREATE POLICY "Public read restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Public read videos" ON videos FOR SELECT USING (true);
```

## 4. API 명세

### GET /api/restaurants

맛집 목록 조회 (지도 뷰포트 기반 + 필터)

- **인증**: 불필요
- **Request**:
  - Query Parameters:
    | 이름 | 타입 | 필수 | 설명 |
    |------|------|------|------|
    | sw_lat | number | ✅ | 뷰포트 남서쪽 위도 |
    | sw_lng | number | ✅ | 뷰포트 남서쪽 경도 |
    | ne_lat | number | ✅ | 뷰포트 북동쪽 위도 |
    | ne_lng | number | ✅ | 뷰포트 북동쪽 경도 |
    | channel_ids | string | ❌ | 채널 ID (쉼표 구분, 최대 5개) |
    | region | string | ❌ | 지역 필터 (예: "서울") |
    | category | string | ❌ | 카테고리 (쉼표 구분) |
    | limit | number | ❌ | 최대 개수 (기본 200, 최대 200) |

- **Response 200**:
```json
{
  "restaurants": [
    {
      "id": 1,
      "name": "성게향",
      "address": "전북특별자치도 전주시 덕진구 들사평3길 5",
      "lat": 35.8412551,
      "lng": 127.1219729,
      "category": "해산물",
      "region": "전북",
      "videos": [
        {
          "video_id": "p5WOwSw9xoc",
          "channel_id": "UC...",
          "channel_name": "맛집기행",
          "channel_thumbnail": "https://...",
          "title": "전주 현지인 맛집 4곳",
          "thumbnail_url": "https://i.ytimg.com/vi/p5WOwSw9xoc/mqdefault.jpg",
          "rating": "강력추천",
          "summary": "성게 특색이 확 느껴지면서도 비리지 않은 성게 미역국",
          "is_ad": false
        }
      ]
    }
  ],
  "total": 47
}
```

- **Response 400**:
```json
{ "error": "sw_lat, sw_lng, ne_lat, ne_lng are required" }
```

- **비즈니스 로직**:
  1. lat/lng NOT NULL 필터 (좌표 없는 가게 제외)
  2. 뷰포트 범위 필터: `lat BETWEEN sw_lat AND ne_lat AND lng BETWEEN sw_lng AND ne_lng`
  3. channel_ids 필터: videos 테이블 JOIN 후 channel_id IN (...)
  4. region/category 필터: WHERE 조건 추가
  5. restaurants + 관련 videos JOIN (각 맛집당 videos 배열)
  6. LIMIT 200

### GET /api/channels

유튜버 채널 목록

- **인증**: 불필요
- **Response 200**:
```json
{
  "channels": [
    {
      "id": "UC...",
      "name": "성시경",
      "thumbnail_url": "https://...",
      "restaurant_count": 47
    }
  ]
}
```

- **비즈니스 로직**: channels LEFT JOIN videos → GROUP BY → restaurant_count 계산, restaurant_count > 0인 것만 반환, 내림차순 정렬

### GET /api/search

통합 검색 (자동완성)

- **인증**: 불필요
- **Request**:
  | 이름 | 타입 | 필수 | 설명 |
  |------|------|------|------|
  | q | string | ✅ | 검색어 (최소 2글자) |

- **Response 200**:
```json
{
  "restaurants": [
    { "id": 1, "name": "성게향", "address": "전주시 덕진구", "category": "해산물" }
  ],
  "channels": [
    { "id": "UC...", "name": "성시경", "thumbnail_url": "https://..." }
  ],
  "regions": ["서울", "전주"]
}
```

- **비즈니스 로직**:
  1. 검색어 sanitize: 특수문자 제거, trim
  2. 길이 < 2 → 빈 결과 반환
  3. restaurants: `name ILIKE '%{query}%' OR address ILIKE '%{query}%'` LIMIT 5
  4. channels: `name ILIKE '%{query}%'` LIMIT 3
  5. regions: 하드코딩된 17개 시/도에서 query 포함하는 것 반환

- **Response 400**:
```json
{ "error": "검색어는 2글자 이상이어야 합니다" }
```

### GET /api/restaurants/[id]

맛집 상세 (SSR/ISR용)

- **인증**: 불필요
- **Response 200**: 맛집 정보 + 관련 영상 전체 + 채널 정보
- **Response 404**: `{ "error": "Restaurant not found" }`
- **비즈니스 로직**: restaurants JOIN videos JOIN channels WHERE restaurants.id = {id}

## 5. 외부 API 연동 상세

### 5.1 카카오맵 JavaScript SDK v3

- **용도**: 프론트엔드 지도 렌더링
- **로드 방식**: `<Script src="//dapi.kakao.com/v2/maps/sdk.js?appkey={KEY}&libraries=clusterer&autoload=false" />`
- **초기화**: `kakao.maps.load(() => { ... })`
- **사용하는 객체**:
  - `kakao.maps.Map` — 지도 생성
  - `kakao.maps.Marker` — 마커
  - `kakao.maps.InfoWindow` — 인포윈도우
  - `kakao.maps.MarkerClusterer` — 클러스터링
  - `kakao.maps.LatLng` — 좌표
  - `kakao.maps.LatLngBounds` — 영역
- **인증**: JavaScript 앱 키 (NEXT_PUBLIC_KAKAO_APP_KEY)
- **제한**: 일 300,000 호출 (무료)

### 5.2 YouTube Data API v3

- **용도**: 채널의 최근 영상 목록 조회 (크론잡)
- **엔드포인트**: `GET https://www.googleapis.com/youtube/v3/search`
- **인증**: API Key (헤더 아닌 쿼리 파라미터 `key=`)
- **요청 예시**:
```
GET https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UC...&maxResults=10&order=date&type=video&key=API_KEY
```
- **응답 예시**:
```json
{
  "items": [
    {
      "id": { "videoId": "p5WOwSw9xoc" },
      "snippet": {
        "title": "전주 현지인 맛집 4곳",
        "thumbnails": { "medium": { "url": "https://..." } },
        "publishedAt": "2024-01-15T10:00:00Z"
      }
    }
  ]
}
```
- **쿼터**: search.list = 100 유닛/호출, 일 10,000 유닛 기본. 10개 채널 × 1회 = 1,000 유닛/실행
- **에러**: 403 (쿼터 초과) → 다음 실행까지 대기

### 5.3 youtube-transcript-api (Python)

- **용도**: 영상 자막 추출 (크론잡)
- **설치**: `pip install youtube-transcript-api`
- **사용 코드**:
```python
from youtube_transcript_api import YouTubeTranscriptApi

ytt_api = YouTubeTranscriptApi()
transcript = ytt_api.fetch(video_id='p5WOwSw9xoc', languages=['ko'])
text = ' '.join([t.text for t in transcript.snippets])
```
- **주의**: 비공식 라이브러리. YouTube가 서버리스 IP 차단함.
- **에러 처리**:
  - `TranscriptsDisabled` → status='no_transcript'
  - `NoTranscriptFound` → 언어 fallback: ['ko'] → ['ko-auto'] → status='no_transcript'
  - `ConnectionError` / `TooManyRequests` → status='api_blocked', retry_count++

### 5.4 Claude Haiku API

- **용도**: 자막에서 가게 정보 구조화 추출 (크론잡)
- **엔드포인트**: `POST https://api.anthropic.com/v1/messages`
- **인증**: `x-api-key: {ANTHROPIC_API_KEY}`
- **요청**:
```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 2000,
  "messages": [
    {
      "role": "user",
      "content": "다음은 먹방 유튜브 영상의 자막입니다.\n이 영상에서 방문한 음식점 정보를 추출해주세요.\n\n자막:\n{transcript}\n\n다음 JSON 형식으로 응답:\n{\"restaurants\": [{\"name\": \"가게명\", \"address_hint\": \"주소 힌트\", \"category\": \"카테고리\", \"rating\": \"평가\", \"summary\": \"한줄평\", \"is_ad\": false}]}\n\n규칙:\n- 가게명이 명확히 언급된 경우만\n- 맞춤법 교정 (성계향→성게향)\n- JSON만 응답"
    }
  ]
}
```
- **응답 파싱**: `response.content[0].text` → JSON.parse → restaurants 배열
- **비용**: 입력 ~2,000 토큰 × $0.25/M = ~$0.0005/영상
- **에러 처리**:
  - 429 (rate limit) → 60초 대기 후 재시도
  - 500/503 → 30초 대기 후 재시도 (최대 2회)
  - JSON 파싱 실패 → status='llm_error', 원본 응답 error_message에 저장

### 5.5 네이버 로컬 검색 API

- **용도**: 가게명 → 좌표(위경도) + 주소 변환 (크론잡)
- **엔드포인트**: `GET https://openapi.naver.com/v1/search/local.json`
- **인증**: 
  - `X-Naver-Client-Id: {NAVER_SEARCH_CLIENT_ID}`
  - `X-Naver-Client-Secret: {NAVER_SEARCH_CLIENT_SECRET}`
- **요청**: `?query={지역} {가게명}&display=1`
- **응답**:
```json
{
  "items": [
    {
      "title": "<b>성게향</b>",
      "address": "전북특별자치도 전주시 덕진구 덕진동1가 1404-39",
      "roadAddress": "전북특별자치도 전주시 덕진구 들사평3길 5",
      "mapx": "1271219729",
      "mapy": "358412551",
      "category": "한식>해물,생선요리"
    }
  ]
}
```
- **좌표 변환**: `lat = int(mapy) / 10_000_000`, `lng = int(mapx) / 10_000_000`
- **title HTML 태그 제거**: `re.sub(r'<[^>]+>', '', title)`
- **제한**: 일 25,000 호출
- **에러**: 
  - items 빈 배열 → 좌표 null로 저장
  - 429 → 60초 대기 후 재시도
  - 인증 실패 (1000) → 키 확인 필요 (Maps 키와 검색 키는 별도!)

## 6. 핵심 로직 상세

### 크론잡 메인 루프 (의사코드)

```python
def main():
    channels = supabase.table('channels').select('*').execute()
    
    for channel in channels:
        # 1. 새 영상 감지
        new_videos = youtube_api.search(channel_id=channel.id, order='date', max_results=10)
        existing = supabase.table('processing_queue').select('video_id').execute()
        existing_ids = {r['video_id'] for r in existing}
        
        for video in new_videos:
            if video.id not in existing_ids:
                supabase.table('processing_queue').insert({
                    'video_id': video.id,
                    'channel_id': channel.id,
                    'status': 'pending'
                }).execute()
    
    # 2. pending 영상 처리 (최대 20개)
    pending = supabase.table('processing_queue') \
        .select('*') \
        .in_('status', ['pending', 'failed']) \
        .lt('retry_count', 3) \
        .order('created_at') \
        .limit(20) \
        .execute()
    
    for item in pending:
        try:
            process_video(item)
        except Exception as e:
            update_status(item, 'failed', str(e))
        
        time.sleep(random.uniform(2, 5))  # rate limit 방지

def process_video(item):
    update_status(item, 'processing')
    
    # 자막 추출
    transcript = fetch_transcript(item['video_id'])
    if not transcript:
        update_status(item, 'no_transcript')
        return
    
    # Claude로 가게 추출
    restaurants = extract_restaurants(transcript)
    if not restaurants:
        update_status(item, 'no_restaurant')
        return
    
    # 각 가게에 대해
    for rest in restaurants:
        # 네이버 검색으로 좌표
        location = search_naver(rest['name'], rest.get('address_hint', ''))
        
        # DB 저장 (UPSERT)
        rest_id = upsert_restaurant({
            'name': location.get('name', rest['name']),
            'address': location.get('roadAddress', ''),
            'lat': location.get('lat'),
            'lng': location.get('lng'),
            'category': rest['category'],
            'region': extract_region(location.get('address', ''))
        })
        
        upsert_video({
            'video_id': item['video_id'],
            'channel_id': item['channel_id'],
            'restaurant_id': rest_id,
            'rating': rest['rating'],
            'summary': rest['summary'],
            'is_ad': rest.get('is_ad', False)
        })
    
    update_status(item, 'done')
```

### region 추출 로직

```python
REGION_MAP = {
    '서울': '서울', '경기': '경기', '인천': '인천',
    '부산': '부산', '대구': '대구', '대전': '대전',
    '광주': '광주', '울산': '울산', '세종': '세종',
    '강원': '강원', '충북': '충북', '충남': '충남',
    '전북': '전북', '전남': '전남', '경북': '경북',
    '경남': '경남', '제주': '제주'
}

def extract_region(address: str) -> str | None:
    for keyword, region in REGION_MAP.items():
        if keyword in address:
            return region
    return None
```

## 7. 보안

- **API 키 관리**: 환경 변수로만 관리. 코드에 하드코딩 금지. `.env` gitignore 필수.
- **CORS**: Next.js API Routes는 같은 origin이므로 별도 설정 불필요.
- **입력 검증**:
  - 검색어: 특수문자 제거 (`re.sub(r'[^\w\s가-힣]', '', query)`)
  - 쿼리 파라미터: number 타입 강제 변환, 범위 체크
  - SQL injection: Supabase Client 사용 시 자동 파라미터 바인딩
- **RLS**: Supabase RLS로 읽기 전용. 쓰기는 service_role key (크론잡만 보유).

## 8. 성능

- **ISR (Incremental Static Regeneration)**: 맛집 상세, 유튜버 프로필 페이지 → `revalidate: 3600` (1시간 캐시)
- **클라이언트 캐싱**: API 응답에 `Cache-Control: public, s-maxage=300` (5분)
- **지도 데이터**: 뷰포트 기반 로드 → 이동 시 debounce 300ms 후 재요청
- **이미지**: YouTube 썸네일은 외부 URL 직접 사용 (Next.js Image 컴포넌트 + next.config.js domains 설정)
- **DB 쿼리**: lat/lng 인덱스 + region/category 인덱스로 필터 성능 보장

## 9. 에러 처리 전략

### 프론트엔드

| 에러 유형 | 처리 |
|----------|------|
| API 응답 실패 (5xx) | "서버에 문제가 발생했습니다" 토스트 + 재시도 버튼 |
| 네트워크 에러 | "인터넷 연결을 확인해주세요" 토스트 |
| 404 | 커스텀 404 페이지 ("이 페이지를 찾을 수 없어요") |
| 카카오맵 로딩 실패 | 에러 메시지 + 새로고침 버튼 |
| 빈 데이터 | 각 컴포넌트별 Empty State UI |

### 크론잡

| 에러 유형 | 처리 |
|----------|------|
| 자막 추출 실패 | status='no_transcript' 또는 'api_blocked', retry_count++ |
| Claude API 에러 | status='llm_error', 30초 후 재시도 (최대 2회) |
| 네이버 검색 실패 | 좌표 null 저장, 계속 진행 |
| Supabase 연결 실패 | 크론잡 전체 중단, 에러 로그 |
| 전체 크론잡 실패 | Railway 대시보드에서 로그 확인 |

## 10. 환경 변수

### Vercel (.env.local)

| 변수명 | 용도 | 예시 | 필수 |
|--------|------|------|------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase 프로젝트 URL | https://xxx.supabase.co | ✅ |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase 익명 키 | eyJ... | ✅ |
| NEXT_PUBLIC_KAKAO_APP_KEY | 카카오맵 JS 앱 키 | abc123 | ✅ |

### Railway (.env)

| 변수명 | 용도 | 예시 | 필수 |
|--------|------|------|------|
| SUPABASE_URL | Supabase URL | https://xxx.supabase.co | ✅ |
| SUPABASE_SERVICE_KEY | Supabase service_role 키 | eyJ... | ✅ |
| ANTHROPIC_API_KEY | Claude API 키 | sk-ant-... | ✅ |
| NAVER_SEARCH_CLIENT_ID | 네이버 검색 Client ID | 77cOb... | ✅ |
| NAVER_SEARCH_CLIENT_SECRET | 네이버 검색 Client Secret | n52uH... | ✅ |
| YOUTUBE_API_KEY | YouTube Data API 키 | AIza... | ✅ |

## 11. 디렉토리 구조

```
mukmap/
├── app/
│   ├── layout.tsx                    # 루트 레이아웃 (카카오맵 SDK)
│   ├── page.tsx                      # 메인 지도 페이지
│   ├── globals.css                   # Tailwind
│   ├── not-found.tsx                 # 404 페이지
│   ├── restaurant/[id]/
│   │   └── page.tsx                  # 맛집 상세 (ISR)
│   ├── youtuber/[channelId]/
│   │   └── page.tsx                  # 유튜버 프로필 (ISR)
│   └── api/
│       ├── restaurants/
│       │   └── route.ts              # GET /api/restaurants
│       ├── restaurants/[id]/
│       │   └── route.ts              # GET /api/restaurants/[id]
│       ├── channels/
│       │   └── route.ts              # GET /api/channels
│       └── search/
│           └── route.ts              # GET /api/search
├── components/
│   ├── KakaoMap.tsx                   # 카카오맵 (client component)
│   ├── MapMarker.tsx                  # 마커 + 인포윈도우
│   ├── MarkerCluster.tsx              # 클러스터링
│   ├── ChannelFilter.tsx              # 유튜버 필터
│   ├── RegionCategoryFilter.tsx       # 지역/카테고리 필터
│   ├── SearchBar.tsx                  # 통합 검색
│   ├── RestaurantCard.tsx             # 맛집 카드
│   ├── EmptyState.tsx                 # 빈 상태 UI
│   └── Toast.tsx                      # 토스트 알림
├── lib/
│   ├── supabase.ts                    # Supabase 클라이언트
│   ├── types.ts                       # TypeScript 타입
│   └── constants.ts                   # 상수 (지역 목록, 카테고리 등)
├── worker/
│   ├── main.py                        # 크론잡 엔트리
│   ├── transcript_fetcher.py          # 자막 추출
│   ├── restaurant_extractor.py        # Claude API 추출
│   ├── naver_search.py                # 네이버 좌표 변환
│   ├── supabase_client.py             # Supabase Python
│   ├── requirements.txt
│   └── Dockerfile
├── public/
│   └── images/
│       └── default-avatar.png         # 기본 아바타
├── spec-docs/                         # 기획/기술/디자인 문서
├── .env.local                         # 환경 변수 (gitignore)
├── .env                               # worker 환경 변수 (gitignore)
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 12. 배포

### Vercel (프론트엔드)
- GitHub 연동 → main 브랜치 push 시 자동 배포
- 환경 변수: Vercel 대시보드에서 설정
- 커스텀 도메인: mukmap.kr (추후)

### Railway (크론잡)
- Dockerfile 기반 배포
- 크론 스케줄: `0 */6 * * *` (6시간마다)
- 환경 변수: Railway 대시보드에서 설정

### Dockerfile (worker)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
```
