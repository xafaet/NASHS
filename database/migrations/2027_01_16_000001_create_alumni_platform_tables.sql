-- ====================================================================
-- Nanupur Abu Sobhan High School Alumni Association
-- Database Schema for Supabase PostgreSQL & Self-Hosted PostgreSQL
-- Version: 1.0.0 (Phase 1: 85th Anniversary & Multi-Phase Foundation)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USERS & ROLES
CREATE TYPE user_role AS ENUM (
    'super_admin',
    'admin',
    'content_manager',
    'event_manager',
    'alumni_member'
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    role user_role DEFAULT 'alumni_member',
    passing_year INT,
    batch VARCHAR(100),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. BATCHES
CREATE TABLE IF NOT EXISTS batches (
    id VARCHAR(50) PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL,
    name_bn VARCHAR(100) NOT NULL,
    passing_year INT UNIQUE NOT NULL,
    batch_number INT NOT NULL,
    representative_name VARCHAR(255),
    representative_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_batches_passing_year ON batches (passing_year);

-- 4. EVENTS
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(100) PRIMARY KEY,
    slug VARCHAR(150) UNIQUE NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    title_bn VARCHAR(255) NOT NULL,
    tagline_en VARCHAR(255),
    tagline_bn VARCHAR(255),
    description_en TEXT,
    description_bn TEXT,
    event_date DATE NOT NULL,
    start_time VARCHAR(50),
    end_time VARCHAR(50),
    venue_en VARCHAR(255) NOT NULL,
    venue_bn VARCHAR(255) NOT NULL,
    registration_fee NUMERIC(10,2) NOT NULL DEFAULT 1000.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
    registration_start DATE,
    registration_end DATE,
    max_capacity INT DEFAULT 5000,
    status VARCHAR(50) DEFAULT 'upcoming',
    banner_image TEXT,
    terms_en TEXT,
    terms_bn TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. EVENT REGISTRATIONS
CREATE TYPE payment_status_type AS ENUM (
    'pending',
    'processing',
    'paid',
    'failed',
    'cancelled',
    'refunded'
);

CREATE TYPE registration_status_type AS ENUM (
    'pending',
    'confirmed',
    'cancelled'
);

CREATE TABLE IF NOT EXISTS event_registrations (
    id VARCHAR(50) PRIMARY KEY, -- e.g. REG-85-1001
    event_id VARCHAR(100) REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    blood_group VARCHAR(10),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    passing_year INT NOT NULL,
    batch_id VARCHAR(50) REFERENCES batches(id),
    batch_name VARCHAR(100) NOT NULL,
    batch_name_bn VARCHAR(100) NOT NULL,
    fee_amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
    payment_status payment_status_type DEFAULT 'pending',
    registration_status registration_status_type DEFAULT 'pending',
    token_id VARCHAR(100),
    token_code VARCHAR(100) UNIQUE,
    checked_in BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_registrations_phone ON event_registrations (phone);
CREATE INDEX idx_registrations_passing_year ON event_registrations (passing_year);
CREATE INDEX idx_registrations_payment_status ON event_registrations (payment_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_event_phone ON event_registrations (event_id, phone);

-- 6. PAYMENT TRANSACTIONS
CREATE TABLE IF NOT EXISTS payment_transactions (
    id VARCHAR(100) PRIMARY KEY,
    registration_id VARCHAR(50) REFERENCES event_registrations(id) ON DELETE CASCADE,
    transaction_id VARCHAR(150) UNIQUE NOT NULL,
    gateway VARCHAR(50) NOT NULL,
    method VARCHAR(100) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
    status payment_status_type NOT NULL,
    gateway_ref VARCHAR(255),
    gateway_response JSONB,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_reg_id ON payment_transactions (registration_id);
CREATE INDEX idx_payments_trx_id ON payment_transactions (transaction_id);

-- 7. ENTRY TOKENS
CREATE TABLE IF NOT EXISTS entry_tokens (
    id VARCHAR(100) PRIMARY KEY,
    token_code VARCHAR(100) UNIQUE NOT NULL, -- NASH-85-2027-XXXXXX
    registration_id VARCHAR(50) UNIQUE REFERENCES event_registrations(id) ON DELETE CASCADE,
    event_id VARCHAR(100) REFERENCES events(id),
    member_name VARCHAR(255) NOT NULL,
    batch_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    qr_code_svg TEXT,
    checked_in BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tokens_code ON entry_tokens (token_code);

-- 8. CMS: NOTICES & NEWS
CREATE TABLE IF NOT EXISTS notices (
    id VARCHAR(50) PRIMARY KEY,
    title_en VARCHAR(255) NOT NULL,
    title_bn VARCHAR(255) NOT NULL,
    content_en TEXT NOT NULL,
    content_bn TEXT NOT NULL,
    publish_date DATE NOT NULL,
    expiry_date DATE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_posts (
    id VARCHAR(50) PRIMARY KEY,
    slug VARCHAR(150) UNIQUE NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    title_bn VARCHAR(255) NOT NULL,
    content_en TEXT NOT NULL,
    content_bn TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    featured_image TEXT,
    author VARCHAR(150) DEFAULT 'Editorial Board',
    publish_date DATE NOT NULL,
    is_published BOOLEAN DEFAULT TRUE,
    views INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. COMMITTEE MEMBERS
CREATE TABLE IF NOT EXISTS committee_members (
    id VARCHAR(50) PRIMARY KEY,
    name_en VARCHAR(255) NOT NULL,
    name_bn VARCHAR(255) NOT NULL,
    designation_en VARCHAR(255) NOT NULL,
    designation_bn VARCHAR(255) NOT NULL,
    batch_year INT,
    photo_url TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    tenure VARCHAR(100) NOT NULL,
    order_index INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    details TEXT,
    ip VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. SITE SETTINGS (KEY-VALUE & JSON CONFIG)
CREATE TABLE IF NOT EXISTS site_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. GATE CHECK-IN AUDIT LOGS
CREATE TABLE IF NOT EXISTS check_in_logs (
    id VARCHAR(100) PRIMARY KEY,
    token_id VARCHAR(100) NOT NULL,
    token_code VARCHAR(100) NOT NULL,
    registration_id VARCHAR(100) NOT NULL,
    event_id VARCHAR(100) NOT NULL,
    member_name VARCHAR(255) NOT NULL,
    batch_name VARCHAR(100),
    checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    operator_name VARCHAR(255) DEFAULT 'Gate Officer',
    gate_name VARCHAR(100) DEFAULT 'Main Gate',
    verification_method VARCHAR(50) DEFAULT 'qr_scan',
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_checkin_token ON check_in_logs (token_code);
CREATE INDEX IF NOT EXISTS idx_checkin_reg ON check_in_logs (registration_id);

-- 13. CMS PAGES (WordPress / Laravel Eloquent Page Management)
CREATE TABLE IF NOT EXISTS pages (
    id VARCHAR(100) PRIMARY KEY,
    slug VARCHAR(191) UNIQUE NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    title_bn VARCHAR(255) NOT NULL,
    content_en TEXT,
    content_bn TEXT,
    sections JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'published',
    featured_image TEXT,
    seo_meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages (slug);
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages (status);

-- 14. ELOQUENT / LARAVEL COMPATIBILITY VIEWS & ALIASES
-- Allows Eloquent models with default convention ($table = 'cms_pages' or $table = 'registrations')
-- to query seamlessly against PostgreSQL backend:
CREATE OR REPLACE VIEW cms_pages AS SELECT * FROM pages;
CREATE OR REPLACE VIEW registrations AS SELECT * FROM event_registrations;

