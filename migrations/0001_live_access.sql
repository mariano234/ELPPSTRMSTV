CREATE TABLE live_logins (
  id TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL,
  verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX live_logins_expiry ON live_logins (expires_at);

CREATE TABLE live_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  checked_until INTEGER NOT NULL,
  check_lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX live_sessions_expiry ON live_sessions (expires_at);
CREATE INDEX live_sessions_user ON live_sessions (user_id);

CREATE TABLE live_grants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('normal', 'premium')),
  receiver TEXT NOT NULL CHECK (receiver IN ('browser', 'cast')),
  expires_at INTEGER NOT NULL
);
CREATE INDEX live_grants_session ON live_grants (session_id);
CREATE INDEX live_grants_expiry ON live_grants (expires_at);

CREATE TABLE live_streams (
  stream_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  sealed_token TEXT,
  renew_at INTEGER NOT NULL DEFAULT 0,
  lease_id TEXT,
  retry_at INTEGER NOT NULL DEFAULT 0,
  last_failure INTEGER
);
CREATE INDEX live_streams_session ON live_streams (session_id);

CREATE TABLE live_limits (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX live_limits_expiry ON live_limits (expires_at);
