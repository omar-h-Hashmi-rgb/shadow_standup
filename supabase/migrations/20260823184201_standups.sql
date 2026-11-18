CREATE TABLE IF NOT EXISTS standups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  author TEXT,
  summary TEXT,
  complexity_score INTEGER DEFAULT 0,
  code_health TEXT DEFAULT 'Medium',
  yesterday_progress TEXT[] DEFAULT '{}',
  today_focus TEXT[] DEFAULT '{}',
  blockers_and_risks TEXT[] DEFAULT '{}',
  code_review JSONB,
  platforms_delivered TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE standups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own standups"
  ON standups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own standups"
  ON standups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own standups"
  ON standups FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_standups_user_id ON standups(user_id);
CREATE INDEX IF NOT EXISTS idx_standups_created_at ON standups(created_at DESC);
