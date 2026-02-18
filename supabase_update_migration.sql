-- Update Migration for Admin and Themes

-- 1. Add is_admin column
ALTER TABLE registered_tokens
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 2. Insert Admin User (Idempotent)
INSERT INTO registered_tokens (token, user_name, is_admin, settings, achievements)
VALUES (
  'admin-key-2024',
  'Admin',
  true,
  '{"theme": "default", "subjects": ["Coding", "Testing", "Everything"]}'::jsonb,
  '["hello_world", "double_digit", "hattrick", "week_warrior", "monthly_master", "deep_work", "night_owl", "early_bird", "polymath", "specialist", "momentum_max", "perfect_week", "socialite", "cloud_bound", "centurion", "marathon", "consistent", "poma_pro", "level_25", "titan"]'::jsonb
)
ON CONFLICT (token) DO UPDATE
SET is_admin = true;

-- 3. Update get_leaderboard to include is_admin (optional, but good for display)
CREATE OR REPLACE FUNCTION get_leaderboard(viewer_token text, period text DEFAULT 'all_time')
RETURNS TABLE (
  rank bigint,
  user_name text,
  avatar_url text,
  total_minutes bigint,
  is_me boolean,
  is_admin boolean
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
      rt.is_admin,
      COALESCE(ut.total_minutes, 0) as total_minutes,
      RANK() OVER (ORDER BY COALESCE(ut.total_minutes, 0) DESC) as rank,
      rt.token
    FROM registered_tokens rt
    LEFT JOIN user_totals ut ON rt.token = ut.token
  )
  SELECT
    r.rank,
    r.user_name,
    r.avatar_url,
    r.total_minutes,
    (r.token = viewer_token) as is_me,
    r.is_admin
  FROM ranked_users r
  ORDER BY r.rank ASC
  LIMIT 50;
END;
$$;
