-- ====================================================================
-- Nanupur Abu Sobhan High School Alumni Association
-- Migration: Create settings table and seed registration_image_max_size
-- Version: 1.0.3 (Settings Table & Registration Image Size CMS)
-- Compatible: Supabase PostgreSQL, Self-Hosted PostgreSQL & MySQL / cPanel
-- ====================================================================

-- 1. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(191) NOT NULL UNIQUE,
    value TEXT NULL,
    "group" VARCHAR(100) DEFAULT 'general',
    type VARCHAR(50) DEFAULT 'string',
    description TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings (key);
CREATE INDEX IF NOT EXISTS idx_settings_group ON settings ("group");

-- 2. SEED DEFAULT SETTINGS
-- registration_image_max_size: default 1.5MB (1,572,864 bytes)
INSERT INTO settings (key, value, "group", type, description, created_at, updated_at)
VALUES (
    'registration_image_max_size',
    '1.5',
    'registration',
    'numeric',
    'Maximum allowed registration photograph file size in Megabytes (MB). Default: 1.5MB.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (key) DO UPDATE SET
    updated_at = CURRENT_TIMESTAMP
    WHERE settings.value IS NULL;
