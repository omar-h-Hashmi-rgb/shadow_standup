-- Fix: the hosted `standups` table never received 20260823184201_standups.sql.
-- It still has the legacy shape (id, user_id, repo_name, summary, created_at),
-- so every insert from /api/standup failed with
--   "column standups.owner does not exist"
-- and was silently swallowed (only console.error'd), meaning no standup was
-- ever persisted and History stayed empty.
--
-- The table is empty, so reshaping it is safe. Statements are idempotent.

ALTER TABLE public.standups RENAME COLUMN repo_name TO repo;

ALTER TABLE public.standups ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT '';
ALTER TABLE public.standups ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'main';
ALTER TABLE public.standups ADD COLUMN IF NOT EXISTS author TEXT;
ALTER TABLE public.standups ADD COLUMN IF NOT EXISTS complexity_score INTEGER DEFAULT 0;
ALTER TABLE public.standups ADD COLUMN IF NOT EXISTS code_health TEXT DEFAULT 'Medium';
ALTER TABLE public.standups ADD COLUMN IF NOT EXISTS yesterday_progress TEXT[] DEFAULT '{}';
ALTER TABLE public.standups ADD COLUMN IF NOT EXISTS today_focus TEXT[] DEFAULT '{}';
ALTER TABLE public.standups ADD COLUMN IF NOT EXISTS blockers_and_risks TEXT[] DEFAULT '{}';
ALTER TABLE public.standups ADD COLUMN IF NOT EXISTS code_review JSONB;
ALTER TABLE public.standups ADD COLUMN IF NOT EXISTS platforms_delivered TEXT[] DEFAULT '{}';

-- Row Level Security + policies (mirrors 20260823184201_standups.sql).
ALTER TABLE public.standups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own standups" ON public.standups;
CREATE POLICY "Users can read own standups"
  ON public.standups FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own standups" ON public.standups;
CREATE POLICY "Users can insert own standups"
  ON public.standups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own standups" ON public.standups;
CREATE POLICY "Users can delete own standups"
  ON public.standups FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_standups_user_id ON public.standups(user_id);
CREATE INDEX IF NOT EXISTS idx_standups_created_at ON public.standups(created_at DESC);
