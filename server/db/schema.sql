-- ============================================================
-- Nanupur Abu Sobhan High School Alumni Association & 85th Reunion
-- Complete Portable Database Schema: Supabase (Postgres) & cPanel (MySQL/MariaDB)
-- ============================================================

-- ------------------------------------------------------------
-- 1. SITE SETTINGS & CONFIGURATION
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_settings (
    `key` VARCHAR(191) PRIMARY KEY,
    `value` LONGTEXT NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 2. CMS PAGES (WordPress-like Page Management)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pages (
    `id` VARCHAR(100) PRIMARY KEY,
    `slug` VARCHAR(191) NOT NULL UNIQUE,
    `title_en` VARCHAR(255) NOT NULL,
    `title_bn` VARCHAR(255) NOT NULL,
    `content_en` LONGTEXT,
    `content_bn` LONGTEXT,
    `status` ENUM('published', 'draft', 'scheduled') DEFAULT 'published',
    `featured_image` TEXT,
    `sections` LONGTEXT, -- JSON encoded sections array
    `seo_title_en` VARCHAR(255),
    `seo_title_bn` VARCHAR(255),
    `seo_desc_en` TEXT,
    `seo_desc_bn` TEXT,
    `is_system` BOOLEAN DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 3. PROGRAM SCHEDULE & FESTIVITIES (Admin Toggleable)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS program_schedules (
    `id` VARCHAR(100) PRIMARY KEY,
    `time` VARCHAR(50) NOT NULL,
    `title_en` VARCHAR(255) NOT NULL,
    `title_bn` VARCHAR(255) NOT NULL,
    `description_en` TEXT,
    `description_bn` TEXT,
    `icon` VARCHAR(50) DEFAULT 'gift',
    `order_index` INT DEFAULT 1,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 4. REGISTRATION FORM FIELDS (100% CMS Configurable)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registration_form_fields (
    `id` VARCHAR(100) PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL UNIQUE,
    `label_en` VARCHAR(255) NOT NULL,
    `label_bn` VARCHAR(255) NOT NULL,
    `placeholder_en` VARCHAR(255),
    `placeholder_bn` VARCHAR(255),
    `help_text_en` TEXT,
    `help_text_bn` TEXT,
    `type` VARCHAR(50) DEFAULT 'text',
    `is_required` BOOLEAN DEFAULT FALSE,
    `is_enabled` BOOLEAN DEFAULT TRUE,
    `order_index` INT DEFAULT 1,
    `options` LONGTEXT, -- JSON options array
    `options_bn` LONGTEXT,
    `validation_rule` VARCHAR(255),
    `grid_span` VARCHAR(20) DEFAULT 'half',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 5. REGISTRATIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrations (
    `id` VARCHAR(100) PRIMARY KEY,
    `event_id` VARCHAR(100) NOT NULL,
    `user_id` VARCHAR(100),
    `full_name` VARCHAR(255) NOT NULL,
    `dob` VARCHAR(50) NOT NULL,
    `gender` ENUM('male', 'female', 'other') NOT NULL,
    `blood_group` VARCHAR(10),
    `phone` VARCHAR(50) NOT NULL,
    `email` VARCHAR(191),
    `address` TEXT,
    `occupation` VARCHAR(255),
    `passing_year` INT NOT NULL,
    `batch_id` VARCHAR(100),
    `batch_name` VARCHAR(100),
    `batch_name_bn` VARCHAR(100),
    `fee_amount` DECIMAL(10, 2) NOT NULL DEFAULT 1000.00,
    `currency` VARCHAR(10) DEFAULT 'BDT',
    `payment_status` ENUM('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded') DEFAULT 'pending',
    `payment_method` VARCHAR(50),
    `notes` TEXT,
    `registration_status` ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
    `token_id` VARCHAR(100),
    `token_code` VARCHAR(100),
    `qr_code_svg` LONGTEXT,
    `photo_url` LONGTEXT,
    `checked_in` BOOLEAN DEFAULT FALSE,
    `checked_in_at` TIMESTAMP NULL,
    `custom_fields` LONGTEXT, -- JSON key-value store for additional custom fields
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_phone` (`phone`),
    INDEX `idx_passing_year` (`passing_year`),
    INDEX `idx_payment_status` (`payment_status`),
    UNIQUE KEY `unique_event_phone` (`event_id`, `phone`)
);

-- ------------------------------------------------------------
-- 5.1 GATE CHECK-IN AUDIT LOGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS check_in_logs (
    `id` VARCHAR(100) PRIMARY KEY,
    `token_code` VARCHAR(100) NOT NULL,
    `registration_id` VARCHAR(100) NOT NULL,
    `event_id` VARCHAR(100) NOT NULL,
    `member_name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) NOT NULL,
    `batch_name` VARCHAR(100),
    `checked_in_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `operator_name` VARCHAR(100) NOT NULL,
    `gate_name` VARCHAR(100) NOT NULL,
    `verification_method` VARCHAR(50) NOT NULL,
    `notes` TEXT,
    INDEX `idx_chk_token` (`token_code`),
    INDEX `idx_chk_phone` (`phone`)
);

-- ------------------------------------------------------------
-- 6. PAYMENT TRANSACTIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    `id` VARCHAR(100) PRIMARY KEY,
    `registration_id` VARCHAR(100) NOT NULL,
    `transaction_id` VARCHAR(191) NOT NULL UNIQUE,
    `gateway` VARCHAR(50) NOT NULL,
    `method` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(10) DEFAULT 'BDT',
    `status` ENUM('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded') DEFAULT 'pending',
    `gateway_ref` VARCHAR(255),
    `gateway_response` LONGTEXT,
    `failure_reason` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_reg_id` (`registration_id`)
);

-- ------------------------------------------------------------
-- 7. ENTRY TOKENS (QR Passes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tokens (
    `id` VARCHAR(100) PRIMARY KEY,
    `token_code` VARCHAR(100) NOT NULL UNIQUE,
    `registration_id` VARCHAR(100) NOT NULL UNIQUE,
    `event_id` VARCHAR(100) NOT NULL,
    `member_name` VARCHAR(255) NOT NULL,
    `batch_name` VARCHAR(100),
    `batch_name_bn` VARCHAR(100),
    `status` ENUM('active', 'used', 'cancelled', 'revoked') DEFAULT 'active',
    `qr_code_svg` LONGTEXT,
    `checked_in` BOOLEAN DEFAULT FALSE,
    `checked_in_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 8. NAVIGATION MENUS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menus (
    `id` VARCHAR(100) PRIMARY KEY,
    `label_en` VARCHAR(255) NOT NULL,
    `label_bn` VARCHAR(255) NOT NULL,
    `url` VARCHAR(255) NOT NULL,
    `target` VARCHAR(20) DEFAULT '_self',
    `order_index` INT DEFAULT 1,
    `parent_id` VARCHAR(100) NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `icon` VARCHAR(50) NULL,
    `children` LONGTEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 9. USERS & PROFILES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    `id` VARCHAR(100) PRIMARY KEY,
    `username` VARCHAR(100) UNIQUE,
    `name` VARCHAR(255) NOT NULL,
    `name_bn` VARCHAR(255),
    `email` VARCHAR(191) UNIQUE,
    `phone` VARCHAR(50) UNIQUE,
    `role` VARCHAR(50) DEFAULT 'alumni_member',
    `password_hash` VARCHAR(255),
    `status` ENUM('active', 'pending', 'suspended', 'blocked', 'inactive') DEFAULT 'active',
    `passing_year` INT,
    `batch` VARCHAR(100),
    `gender` ENUM('male', 'female', 'other'),
    `blood_group` VARCHAR(10),
    `dob` VARCHAR(50),
    `photo_url` LONGTEXT,
    `occupation` VARCHAR(255),
    `organization` VARCHAR(255),
    `designation` VARCHAR(255),
    `work_location` VARCHAR(255),
    `business_name` VARCHAR(255),
    `business_type` VARCHAR(255),
    `business_address` TEXT,
    `business_website` VARCHAR(255),
    `address` TEXT,
    `bio` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 10. CHECK-IN AUDIT LOGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS check_in_logs (
    `id` VARCHAR(100) PRIMARY KEY,
    `token_id` VARCHAR(100) NOT NULL,
    `token_code` VARCHAR(100) NOT NULL,
    `registration_id` VARCHAR(100) NOT NULL,
    `event_id` VARCHAR(100) NOT NULL,
    `member_name` VARCHAR(255) NOT NULL,
    `batch_name` VARCHAR(100),
    `checked_in_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `operator_name` VARCHAR(255) DEFAULT 'Gate Officer',
    `gate_name` VARCHAR(100) DEFAULT 'Main Gate',
    `verification_method` VARCHAR(50) DEFAULT 'qr_scan',
    `notes` TEXT,
    INDEX `idx_checkin_token` (`token_code`),
    INDEX `idx_checkin_reg` (`registration_id`)
);

-- ------------------------------------------------------------
-- 11. AUTHORIZED REGISTRATION BOOTHS / CENTERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offline_centers (
    `id` VARCHAR(100) PRIMARY KEY,
    `name_en` VARCHAR(255) NOT NULL,
    `name_bn` VARCHAR(255) NOT NULL,
    `address_en` TEXT,
    `address_bn` TEXT,
    `phone` VARCHAR(50) NOT NULL,
    `contact_person` VARCHAR(255),
    `contact_person_bn` VARCHAR(255),
    `timings` VARCHAR(255),
    `timings_bn` VARCHAR(255),
    `description_en` TEXT,
    `description_bn` TEXT,
    `map_url` TEXT,
    `order_index` INT DEFAULT 1,
    `is_active` BOOLEAN DEFAULT TRUE,
    `is_trashed` BOOLEAN DEFAULT FALSE,
    `deleted_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_booths_order` (`order_index`),
    INDEX `idx_booths_active` (`is_active`, `is_trashed`)
);

