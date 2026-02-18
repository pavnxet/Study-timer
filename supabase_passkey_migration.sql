-- 1. Modify registered_tokens table to include user_id and avatar_url
ALTER TABLE registered_tokens ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE registered_tokens ADD COLUMN IF NOT EXISTS avatar_url TEXT;
CREATE INDEX IF NOT EXISTS registered_tokens_user_id_idx ON registered_tokens (user_id);

-- 2. Modify study_sessions table to include user_id
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS study_sessions_user_id_idx ON study_sessions (user_id);

-- 3. Update RLS for registered_tokens
DROP POLICY IF EXISTS "Allow public registration" ON registered_tokens;
DROP POLICY IF EXISTS "Allow public lookup by token" ON registered_tokens;
DROP POLICY IF EXISTS "Allow public lookup" ON registered_tokens;
DROP POLICY IF EXISTS "Users can update their own registration" ON registered_tokens;
DROP POLICY IF EXISTS "Users can claim legacy tokens" ON registered_tokens;

-- Anyone can register (Legacy or new)
CREATE POLICY "Allow public registration"
ON registered_tokens FOR INSERT
WITH CHECK (true);

-- Users can see their own profile or legacy profiles (Legacy profiles remain semi-public by design for restore)
CREATE POLICY "View profiles"
ON registered_tokens FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own profile
CREATE POLICY "Update own profile"
ON registered_tokens FOR UPDATE
USING (auth.uid() = user_id);

-- Users can claim legacy profiles (must know the token, which is handled by the app's .eq('token', ...) query)
CREATE POLICY "Claim legacy profiles"
ON registered_tokens FOR UPDATE
USING (user_id IS NULL AND auth.uid() IS NOT NULL);

-- 4. Update RLS for study_sessions
DROP POLICY IF EXISTS "Access by token" ON study_sessions;
DROP POLICY IF EXISTS "Unified session access" ON study_sessions;

-- If a session is linked to a user, ONLY that user can access it.
-- If a session is legacy (user_id is NULL), it remains accessible (app must filter by token).
CREATE POLICY "Session access"
ON study_sessions FOR ALL
USING (
  (user_id IS NOT NULL AND auth.uid() = user_id) OR
  (user_id IS NULL)
)
WITH CHECK (
  (user_id IS NOT NULL AND auth.uid() = user_id) OR
  (user_id IS NULL)
);

-- 5. Enable RLS
ALTER TABLE registered_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
