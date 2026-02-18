-- Migration to Token-Based Auth

-- 1. Drop existing Policy and FK
DROP POLICY IF EXISTS "Users can only see their own sessions" ON study_sessions;
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS study_sessions_user_id_fkey;

-- 2. Modify Column: user_id (uuid) -> token (text)
-- Note: If you have existing data, this might fail unless you cast or clear it.
-- Assuming we are okay with clearing or the user handles migration manually.
-- For safety, let's ADD a token column and drop user_id, or just ALTER if empty.
-- Safest for a "reset":
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS token text;
-- (Optional) Copy data if you had a way to map user_ids to tokens, but we don't.
-- So we just make it required for NEW rows.
-- If you want to keep old rows accessible by a "legacy" token, you could backfill.
-- For now, we'll just make `token` required and drop `user_id`.

UPDATE study_sessions SET token = 'legacy_migration' WHERE token IS NULL; -- Placeholder
ALTER TABLE study_sessions ALTER COLUMN token SET NOT NULL;

-- We can drop user_id now, or keep it nullable. Let's drop for cleanliness.
ALTER TABLE study_sessions DROP COLUMN IF EXISTS user_id;

-- 3. New RLS Policy
-- "Access by token": Anyone can access data if they provide the correct token in the query
-- This policy allows INSERT/SELECT/UPDATE/DELETE if the row's token matches what you are querying?
-- Actually, for `INSERT`, the user provides a token.
-- For `SELECT`, the user filters by `token`.
-- So the policy needs to be permissible.
-- The user prompt said: `CREATE POLICY "Access by token" ON study_sessions FOR ALL USING (true) WITH CHECK (true);`
-- This literally allows ANYONE to read EVERYTHING.
-- But wait, "If someone knows your token, they can see your study hours".
-- The prompt's suggested policy `USING (true)` means NO filtering is enforced by the DB.
-- The filtering happens in the application query `supabase.from(...).select().eq('token', myToken)`.
-- This is insecure if someone just queries `select * from study_sessions`, but the user EXPLICITLY requested this model:
-- "Because the tokens are 'secret,' this is secure enough for a study tracker."

DROP POLICY IF EXISTS "Access by token" ON study_sessions;
CREATE POLICY "Access by token" ON study_sessions
FOR ALL USING (true) WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
