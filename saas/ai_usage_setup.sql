-- AI Usage tracking table — server-side daily limit per user
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  calls_today smallint   NOT NULL DEFAULT 0,
  reset_date  date       NOT NULL DEFAULT CURRENT_DATE
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage (for future stats panel)
CREATE POLICY "Users view own ai usage"
  ON public.ai_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (Edge Function) handles all writes — no INSERT/UPDATE policy needed for users
