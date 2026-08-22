CREATE TABLE IF NOT EXISTS code_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  commit_shas TEXT[] NOT NULL,
  risk_level TEXT NOT NULL,
  approved BOOLEAN DEFAULT false,
  findings_count INTEGER DEFAULT 0,
  summary TEXT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE code_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reviews"
  ON code_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reviews"
  ON code_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON code_reviews FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_code_reviews_user_id ON code_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_code_reviews_created_at ON code_reviews(created_at DESC);
