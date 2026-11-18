-- Security hardening.
--
-- 1. user_tokens and history are used by the app but had no migration. They are
--    created here if missing (no-op when they already exist).
-- 2. user_tokens holds GitHub tokens: it is only ever accessed server-side with
--    the service-role key, so RLS is enabled with NO policies and all
--    anon/authenticated privileges are revoked.
-- 3. history gets row-level policies matching the other tables.

CREATE TABLE IF NOT EXISTS user_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_token TEXT,
  provider_refresh_token TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_tokens FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  content TEXT,
  commits_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own history" ON history;
DROP POLICY IF EXISTS "Users can insert own history" ON history;
DROP POLICY IF EXISTS "Users can delete own history" ON history;

CREATE POLICY "Users can read own history" ON history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own history" ON history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own history" ON history FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);
