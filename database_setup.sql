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
-- 1B. APPLICATION SYSTEM SETTINGS (Key-Value CMS Store)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(191) NOT NULL UNIQUE,
    `value` LONGTEXT NULL,
    `group` VARCHAR(100) DEFAULT 'general',
    `type` VARCHAR(50) DEFAULT 'string',
    `description` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO settings (`key`, `value`, `group`, `type`, `description`)
VALUES ('registration_image_max_size', '1.5', 'registration', 'numeric', 'Maximum allowed registration photograph file size in Megabytes (MB). Default: 1.5MB.')
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

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
    `t_shirt_size` VARCHAR(10) DEFAULT NULL,
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
-- 10. AUTHORIZED REGISTRATION BOOTHS / CENTERS
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

-- ------------------------------------------------------------
-- 11. BATCHES (Passing Year Groups)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS batches (
    `id` VARCHAR(100) PRIMARY KEY,
    `name_en` VARCHAR(100) NOT NULL,
    `name_bn` VARCHAR(100),
    `passing_year` INT NOT NULL,
    `batch_number` VARCHAR(50),
    `representative_name` VARCHAR(255),
    `representative_phone` VARCHAR(50),
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 12. EVENTS & REUNIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    `id` VARCHAR(100) PRIMARY KEY,
    `slug` VARCHAR(100) NOT NULL UNIQUE,
    `title_en` VARCHAR(255) NOT NULL,
    `title_bn` VARCHAR(255) NOT NULL,
    `event_date` VARCHAR(50) NOT NULL,
    `venue_en` VARCHAR(255),
    `venue_bn` VARCHAR(255),
    `registration_fee` DECIMAL(10, 2) DEFAULT 1000.00,
    `currency` VARCHAR(10) DEFAULT 'BDT',
    `registration_open` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 13. COMMITTEE MEMBERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS committee_members (
    `id` VARCHAR(100) PRIMARY KEY,
    `committee_id` VARCHAR(100) DEFAULT 'comm-ec-2026',
    `user_id` VARCHAR(100),
    `name_en` VARCHAR(255) NOT NULL,
    `name_bn` VARCHAR(255),
    `designation_en` VARCHAR(255) NOT NULL,
    `designation_bn` VARCHAR(255),
    `batch_year` INT,
    `photo_url` LONGTEXT,
    `phone` VARCHAR(50),
    `email` VARCHAR(191),
    `tenure` VARCHAR(50) DEFAULT '2026-2028',
    `order_index` INT DEFAULT 1,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 14. NOTICES & ANNOUNCEMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notices (
    `id` VARCHAR(100) PRIMARY KEY,
    `title_en` VARCHAR(255) NOT NULL,
    `title_bn` VARCHAR(255) NOT NULL,
    `content_en` LONGTEXT,
    `content_bn` LONGTEXT,
    `publish_date` VARCHAR(50),
    `is_featured` BOOLEAN DEFAULT FALSE,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 15. NEWS & STORIES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news_posts (
    `id` VARCHAR(100) PRIMARY KEY,
    `slug` VARCHAR(191) NOT NULL UNIQUE,
    `title_en` VARCHAR(255) NOT NULL,
    `title_bn` VARCHAR(255) NOT NULL,
    `content_en` LONGTEXT,
    `content_bn` LONGTEXT,
    `category` VARCHAR(100) DEFAULT 'General',
    `publish_date` VARCHAR(50),
    `is_published` BOOLEAN DEFAULT TRUE,
    `views` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 16. AUDIT LOGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    `id` VARCHAR(100) PRIMARY KEY,
    `user_name` VARCHAR(100) NOT NULL,
    `user_email` VARCHAR(191),
    `action` VARCHAR(100) NOT NULL,
    `entity` VARCHAR(100) NOT NULL,
    `details` TEXT,
    `ip` VARCHAR(50),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 17. MEDIA LIBRARY (Registration Photos, Banners & Assets)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_items (
    `id` VARCHAR(100) PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `filename` VARCHAR(255),
    `url` VARCHAR(500) NOT NULL,
    `type` VARCHAR(100) DEFAULT 'image/jpeg',
    `size` VARCHAR(50) DEFAULT '1.0 MB',
    `size_bytes` BIGINT DEFAULT 0,
    `registration_id` VARCHAR(100),
    `user_id` VARCHAR(100),
    `source` VARCHAR(50) DEFAULT 'upload',
    `attendee_name` VARCHAR(191),
    `passing_year` INT,
    `token_code` VARCHAR(100),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_media_reg_id` (`registration_id`),
    INDEX `idx_media_source` (`source`),
    INDEX `idx_media_created` (`created_at`)
);

-- ------------------------------------------------------------
-- 18. DEFAULT SITE SETTINGS (Appearance, Confirmation & Config)
-- ------------------------------------------------------------
INSERT INTO site_settings (`key`, `value`) VALUES
('animations_config', '{"is_enabled":true,"preset":"smooth","duration":0.5,"default_delay":0,"stagger_delay":0.08,"scroll_triggered":true,"hover_effects":true,"play_mode":"once","intensity":"standard","respect_reduced_motion":true,"enable_homepage":true,"enable_header_nav":true,"enable_hero_animations":true,"enable_stats_cards":true,"enable_notices_news":true,"enable_events_schedule":true,"enable_forms_inputs":true,"enable_member_portal":true,"enable_admin_interface":true,"enable_page_transitions":true,"enable_card_reveals":true,"enable_button_hover":true,"enable_counter_animations":true}'),
('registration_confirmation_config', '{"heading_en":"Welcome to the 85th Reunion!","heading_bn":"৮৫তম পুনর্মিলনীতে আপনাকে স্বাগতম!","subheading_en":"85th Anniversary Celebration 2027","subheading_bn":"৮৫তম প্রতিষ্ঠাবার্ষিকী ও পুনর্মিলনী উৎসব ২০২৭","show_return_button":true,"return_button_label_en":"Return to Website","return_button_label_bn":"ওয়েবসাইটে ফিরে যান","return_button_destination":"/home","show_download_slip_button":true,"show_print_button":true,"show_confirm_payment_form":true,"show_manual_payment_accounts":true,"show_info_notes":true,"show_support_contact":true}')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- ------------------------------------------------------------
-- 18. INITIAL EVENT RECORD
-- ------------------------------------------------------------
INSERT INTO events (`id`, `slug`, `title_en`, `title_bn`, `event_date`, `venue_en`, `venue_bn`, `registration_fee`, `currency`, `registration_open`)
VALUES ('event-85th-2027', '85th-anniversary-reunion-2027', '85th Anniversary Celebration & Grand Reunion 2027', '৮৫ বছর পূর্তি উৎসব ও মহা পুনর্মিলনী ২০২৭', '2027-01-16', 'School Premises, Nanupur, Fatikchhari, Chattogram', 'বিদ্যালয় প্রাঙ্গণ, নানুপুর, ফটিকছড়ি, চট্টগ্রাম', 1000.00, 'BDT', 1)
ON DUPLICATE KEY UPDATE `title_en` = VALUES(`title_en`);

-- ------------------------------------------------------------
-- 19. INITIAL SUPER ADMIN ACCOUNT (Credential: super_admin / admin123)
-- ------------------------------------------------------------
INSERT INTO users (`id`, `username`, `name`, `name_bn`, `email`, `phone`, `role`, `password_hash`, `status`)
VALUES ('usr-superadmin-init', 'super_admin', 'Secretariat Admin', 'আহ্বায়ক সচিবালয়', 'admin@nanupuralumni.org', '01819000000', 'super_admin', '$2b$10$zGxicsALJ0pELiOJYNxVcO6ApP2ScXsXixf6cGt2p9eTjkP3DnMIG', 'active')
ON DUPLICATE KEY UPDATE `role` = 'super_admin';

-- ------------------------------------------------------------
-- 20. CORE BATCH SEED DATA (Passing Years)
-- ------------------------------------------------------------
INSERT INTO batches (`id`, `name_en`, `name_bn`, `passing_year`, `batch_number`, `is_active`) VALUES
('batch-1971', 'Batch 1971 (Freedom Fighter Batch)', 'ব্যাচ ১৯৭১ (বীর মুক্তিযোদ্ধা ব্যাচ)', 1971, '30th SSC', 1),
('batch-1985', 'Batch 1985', 'ব্যাচ ১৯৮৫', 1985, '44th SSC', 1),
('batch-1995', 'Batch 1995', 'ব্যাচ ১৯৯৫', 1995, '54th SSC', 1),
('batch-2000', 'Batch 2000 (Millennium Batch)', 'ব্যাচ ২০০০ (সহস্রাব্দ ব্যাচ)', 2000, '59th SSC', 1),
('batch-2005', 'Batch 2005', 'ব্যাচ ২০০৫', 2005, '64th SSC', 1),
('batch-2010', 'Batch 2010', 'ব্যাচ ২০১০', 2010, '69th SSC', 1),
('batch-2015', 'Batch 2015', 'ব্যাচ ২০১৫', 2015, '74th SSC', 1),
('batch-2020', 'Batch 2020', 'ব্যাচ ২০২০', 2020, '79th SSC', 1),
('batch-2024', 'Batch 2024', 'ব্যাচ ২০২৪', 2024, '83rd SSC', 1),
('batch-2025', 'Batch 2025', 'ব্যাচ ২০২৫', 2025, '84th SSC', 1),
('batch-2026', 'Batch 2026', 'ব্যাচ ২০২৬', 2026, '85th SSC', 1)
ON DUPLICATE KEY UPDATE `is_active` = 1;




