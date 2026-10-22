-- 토스 '찜한 곳 근처 새 맛집 알림'. 동의한 사람의 익명 키와 그 사람이 찜한 가게만 담는다(위치는 받지 않는다)
CREATE TABLE IF NOT EXISTS alert_near (
  anon_key TEXT NOT NULL,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (anon_key, restaurant_id)
);

-- 사람마다 어디까지 확인했고 마지막으로 언제 보냈는지
CREATE TABLE IF NOT EXISTS alert_near_state (
  anon_key TEXT PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

ALTER TABLE alert_near ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_near_state ENABLE ROW LEVEL SECURITY;
