-- 토스 '유튜버 새 맛집 알림'. 토스 동의창에서 동의한 사람의 익명 키(User.getAnonymousKey)만 담는다.
CREATE TABLE IF NOT EXISTS alert_subs (
  anon_key TEXT NOT NULL,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (anon_key, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_alert_subs_channel ON alert_subs(channel_id);

-- 유튜버마다 어디까지 새 가게를 확인해 보냈는지
CREATE TABLE IF NOT EXISTS alert_state (
  channel_id TEXT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 서버(service role)만 읽고 쓴다
ALTER TABLE alert_subs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_state ENABLE ROW LEVEL SECURITY;
