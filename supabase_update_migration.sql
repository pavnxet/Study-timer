-- Update Migration for New Features

-- 1. Add new columns to registered_tokens
ALTER TABLE registered_tokens
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS achievements jsonb DEFAULT '[]'::jsonb;

-- 2. Create Leaderboard Function
-- Usage: supabase.rpc('get_leaderboard', { viewer_token: '...', period: 'weekly' })

CREATE OR REPLACE FUNCTION get_leaderboard(viewer_token text, period text DEFAULT 'all_time')
RETURNS TABLE (
  rank bigint,
  user_name text,
  avatar_url text,
  total_minutes bigint,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_totals AS (
    SELECT
      s.token,
      SUM(s.duration_minutes) as total_minutes
    FROM study_sessions s
    WHERE
      CASE
        WHEN period = 'weekly' THEN s.created_at >= date_trunc('week', now())
        ELSE true
      END
    GROUP BY s.token
  ),
  ranked_users AS (
    SELECT
      rt.user_name,
      rt.avatar_url,
      COALESCE(ut.total_minutes, 0) as total_minutes,
      RANK() OVER (ORDER BY COALESCE(ut.total_minutes, 0) DESC) as rank,
      rt.token
    FROM registered_tokens rt
    JOIN user_totals ut ON rt.token = ut.token
  )
  SELECT
    r.rank,
    r.user_name,
    r.avatar_url,
    r.total_minutes,
    (r.token = viewer_token) as is_me
  FROM ranked_users r
  ORDER BY r.rank ASC
  LIMIT 50;
END;
$$;
