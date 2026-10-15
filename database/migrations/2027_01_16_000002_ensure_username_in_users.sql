-- ====================================================================
-- Nanupur Abu Sobhan High School Alumni Association
-- Migration: Ensure username column exists with unique constraint
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'username'
    ) THEN
        ALTER TABLE users ADD COLUMN username VARCHAR(100);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users (LOWER(username));
    END IF;
END $$;
