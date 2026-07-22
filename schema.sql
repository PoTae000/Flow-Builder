CREATE TABLE IF NOT EXISTS users (
  sub TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  plan TEXT DEFAULT 'basic',
  stripe_customer_id TEXT,
  plan_expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS diagrams (
  id TEXT NOT NULL,
  user_sub TEXT NOT NULL REFERENCES users(sub),
  name TEXT NOT NULL DEFAULT '',
  diagram_type TEXT DEFAULT 'er',
  data JSONB,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (user_sub, id)
);

CREATE TABLE IF NOT EXISTS user_state (
  user_sub TEXT PRIMARY KEY REFERENCES users(sub),
  active_diagram_id TEXT,
  version BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INT DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

CREATE TABLE IF NOT EXISTS diagram_versions (
  id SERIAL PRIMARY KEY,
  user_sub TEXT NOT NULL REFERENCES users(sub),
  diagram_id TEXT NOT NULL,
  data JSONB NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  diagram_type TEXT DEFAULT 'er',
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_sub, diagram_id) REFERENCES diagrams(user_sub, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_versions_lookup
  ON diagram_versions(user_sub, diagram_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_sub TEXT NOT NULL REFERENCES users(sub),
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_sub);
