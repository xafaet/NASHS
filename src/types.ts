export type Role =
  | 'super_admin'
  | 'admin'
  | 'content_manager'
  | 'event_manager'
  | 'finance_manager'
  | 'moderator'
  | 'alumni_member'
  | string;

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  name_bn?: string;
  email: string;
  phone?: string;
  role: Role;
  gender?: 'male' | 'female' | 'other';
  blood_group?: string;
  dob?: string;
  passing_year?: number;
  batch?: string;
  status: 'active' | 'pending' | 'suspended' | 'blocked' | 'inactive';
  avatar?: string;
  photo_url?: string;
  permissions?: string[];
  last_login?: string;
  created_at: string;
  password_hash?: string;
  // Career, Business & Profile Enhancement
  occupation?: string;
  designation?: string;
  organization?: string;
  work_location?: string;
  business_name?: string;
  business_type?: string;
  business_address?: string;
  business_website?: string;
  address?: string;
  bio?: string;
  privacy?: {
    show_phone_publicly: boolean;
    show_email_publicly: boolean;
    show_business_publicly: boolean;
  };
}

export interface BatchOverride {
  passing_year: number;
  override_batch_number: number;
  batch_name_en: string;
  batch_name_bn: string;
  reason: string;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
}

export interface BatchConfig {
  reference_year: number; // 2008
  reference_batch: number; // 65
  formula_description: string;
  naming_format: 'batch_number' | 'passing_year';
  overrides: BatchOverride[];
}

export interface Batch {
  id: string;
  name_en: string;
  name_bn: string;
  passing_year: number;
  batch_number: number;
  representative_name?: string;
  representative_phone?: string;
  registration_count: number;
  is_active: boolean;
}

export interface EventItem {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  tagline_en: string;
  tagline_bn: string;
  description_en: string;
  description_bn: string;
  event_date: string; // '2027-01-16'
  start_time: string;
  end_time: string;
  venue_en: string;
  venue_bn: string;
  registration_fee: number;
  currency: string;
  registration_start: string;
  registration_end: string;
  max_capacity: number;
  status: 'upcoming' | 'ongoing' | 'closed' | 'archived';
  banner_image?: string;
  terms_en?: string;
  terms_bn?: string;
}

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type RegistrationStatus = 'pending' | 'confirmed' | 'cancelled';
export type PaymentGateway = 'bkash' | 'nagad' | 'rocket' | 'sslcommerz' | 'card' | 'bank' | string;

export interface Registration {
  id: string;
  event_id: string;
  user_id?: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female' | 'other';
  blood_group?: string;
  phone: string;
  email?: string;
  address?: string;
  occupation?: string;
  passing_year: number;
  batch_id?: string;
  batch_name: string;
  batch_name_bn: string;
  fee_amount: number;
  currency: string;
  payment_status: PaymentStatus;
  payment_method?: string;
  notes?: string;
  registration_status: RegistrationStatus;
  token_id?: string;
  token_code?: string;
  qr_code_svg?: string;
  photo_url?: string;
  t_shirt_size?: string;
  token_url?: string;
  checked_in: boolean;
  checked_in_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  registration_id: string;
  transaction_id: string;
  gateway: PaymentGateway;
  method: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway_ref?: string;
  gateway_response?: Record<string, any>;
  failure_reason?: string;
  created_at: string;
}

export interface EntryToken {
  id: string;
  token_code: string; // e.g. NASH-85-2027-XXXXXX
  registration_id: string;
  event_id: string;
  member_name: string;
  batch_name: string;
  batch_name_bn?: string;
  status: 'active' | 'used' | 'cancelled' | 'revoked';
  qr_code_svg: string;
  checked_in: boolean;
  checked_in_at?: string;
  created_at: string;
}

export interface CommitteeMember {
  id: string;
  name_en: string;
  name_bn: string;
  designation_en: string;
  designation_bn: string;
  batch_year: number;
  photo_url?: string;
  phone?: string;
  email?: string;
  tenure: string;
  order_index: number;
  is_active: boolean;
}

export type CommitteeType = 'executive' | 'advisory' | 'convening' | 'reunion_committee' | 'sub_committee';

export interface Committee {
  id: string;
  name_en: string;
  name_bn: string;
  committee_type: CommitteeType;
  tenure_start: string;
  tenure_end: string;
  tenure_label: string; // e.g. "2026–2028"
  description_en?: string;
  description_bn?: string;
  is_current: boolean;
  is_active: boolean;
  order_index: number;
  created_at: string;
}

export interface CommitteeMemberItem {
  id: string;
  committee_id: string;
  user_id?: string; // Reference to existing alumni user
  custom_name_en?: string;
  custom_name_bn?: string;
  designation_id?: string;
  designation_en: string;
  designation_bn: string;
  batch_year?: number;
  batch_name?: string;
  phone?: string;
  email?: string;
  photo_url?: string;
  bio?: string;
  order_index: number;
  is_active: boolean;
  joined_date?: string;
  remarks?: string;
}

export interface CommitteeDesignation {
  id: string;
  title_en: string;
  title_bn: string;
  default_order: number;
}

export interface OfflineRegistrationCenter {
  id: string;
  name_en: string;
  name_bn: string;
  address_en: string;
  address_bn: string;
  phone: string;
  contact_person?: string;
  timings?: string;
  map_url?: string;
  order_index: number;
  is_active: boolean;
}

export interface SchoolSection {
  id: string;
  key: string;
  title_en: string;
  title_bn: string;
  is_enabled: boolean;
  order: number;
}

export interface SchoolMilestone {
  id: string;
  year: string;
  title_en: string;
  title_bn: string;
  description_en: string;
  description_bn: string;
  image_url?: string;
  order: number;
}

export interface HeadmasterRecord {
  id: string;
  name_en: string;
  name_bn: string;
  photo_url?: string;
  designation_en: string;
  designation_bn: string;
  joining_date?: string;
  end_date?: string;
  tenure_en: string; // e.g. "1972 – 1988"
  tenure_bn: string;
  biography_en?: string;
  biography_bn?: string;
  achievements_en?: string;
  achievements_bn?: string;
  is_current: boolean;
  order: number;
}

export interface SscResultRecord {
  id: string;
  academic_year: number; // e.g. 2024
  exam_year: number;     // e.g. 2024
  candidates: number;
  passed: number;
  failed: number;
  pass_rate: number;     // e.g. 96.5
  gpa5_count: number;
  highest_gpa: number;   // e.g. 5.00
  notable_achievements_en?: string;
  notable_achievements_bn?: string;
  notes_en?: string;
  notes_bn?: string;
  status: 'published' | 'draft';
}

export type HeadmasterHistoryItem = HeadmasterRecord;
export type SchoolFacilityItem = SchoolFacility;

export interface SchoolFacility {
  id: string;
  title_en: string;
  title_bn: string;
  description_en: string;
  description_bn: string;
  icon?: string;
  order: number;
}

export interface SchoolInfo {
  name_en: string;
  name_bn: string;
  established_year: number;
  eiin_number?: string;
  eiin?: string;
  school_code?: string;
  website?: string;
  history_en: string;
  history_bn: string;
  location_en?: string;
  location_bn?: string;
  vision_en?: string;
  vision_bn?: string;
  mission_en?: string;
  mission_bn?: string;
  objectives_en?: string[];
  objectives_bn?: string[];
  headmaster_name_en?: string;
  headmaster_name_bn?: string;
  headmaster_name?: string;
  headmaster_message_en?: string;
  headmaster_message_bn?: string;
  headmaster_photo?: string;
  former_headmasters?: Array<{
    name_en: string;
    name_bn: string;
    period: string;
  }>;
  headmaster_history?: HeadmasterRecord[];
  ssc_results?: SscResultRecord[];
  milestones?: any[];
  facility_items?: SchoolFacility[];
  sections?: SchoolSection[];
  address_en: string;
  address_bn: string;
  phone: string;
  email: string;
  facilities?: any[];
  images?: string[];
}

export interface AssociationInfo {
  name_en: string;
  name_bn: string;
  established_year: number;
  intro_en: string;
  intro_bn: string;
  mission_en: string;
  mission_bn: string;
  vision_en: string;
  vision_bn: string;
  objectives_en: string[];
  objectives_bn: string[];
  contact_phone: string;
  contact_email: string;
  address_en: string;
  address_bn: string;
}

export interface Notice {
  id: string;
  title_en: string;
  title_bn: string;
  content_en: string;
  content_bn: string;
  publish_date: string;
  expiry_date?: string;
  is_featured: boolean;
  is_active: boolean;
  attachment_name?: string;
  attachment_url?: string;
  category?: string;
}

export interface NewsPost {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  excerpt_en?: string;
  excerpt_bn?: string;
  content_en: string;
  content_bn: string;
  category: string;
  featured_image?: string;
  author: string;
  publish_date: string;
  is_published: boolean;
  is_featured?: boolean;
  status?: 'published' | 'draft';
  views: number;
  seo_title?: string;
  seo_description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GateItem {
  id: string;
  gate_name: string;
  gate_code: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FAQItem {
  id: string;
  category: string;
  question_en: string;
  question_bn: string;
  answer_en: string;
  answer_bn: string;
  order: number;
  is_active: boolean;
}

export interface NavigationMenuItem {
  id: string;
  label_en: string;
  label_bn: string;
  url: string;
  target: '_self' | '_blank';
  order: number;
  parent_id?: string | null;
  is_active: boolean;
  icon?: string;
  children?: NavigationMenuItem[];
}

export interface TopBarConfig {
  is_enabled: boolean;
  announcement_en: string;
  announcement_bn: string;
  show_notice_indicator: boolean;
  show_contact_info: boolean;
  contact_phone: string;
  contact_email: string;
  show_login_link: boolean;
  show_registration_link: boolean;
  show_language_selector: boolean;
  show_social_icons: boolean;
  custom_cta_text_en?: string;
  custom_cta_text_bn?: string;
  custom_cta_url?: string;
}

export interface HeaderConfig {
  logo_url: string;
  mobile_logo_url?: string;
  logo_link: string;
  show_search: boolean;
  show_cta_button: boolean;
  cta_text_en: string;
  cta_text_bn: string;
  cta_url: string;
  show_language_switcher: boolean;
  show_user_menu: boolean;
}

export interface FooterColumnLink {
  id: string;
  label_en: string;
  label_bn: string;
  url: string;
  target: '_self' | '_blank';
  order: number;
  is_active: boolean;
}

export interface FooterColumn {
  id: string;
  title_en: string;
  title_bn: string;
  order: number;
  is_active: boolean;
  links: FooterColumnLink[];
}

export interface FooterConfig {
  logo_url: string;
  description_en: string;
  description_bn: string;
  address_en: string;
  address_bn: string;
  phone: string;
  email: string;
  copyright_en: string;
  copyright_bn: string;
  columns: FooterColumn[];
  social_links: {
    facebook?: string;
    youtube?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
}

export type PageSectionType =
  | 'hero'
  | 'text'
  | 'image'
  | 'gallery'
  | 'stats'
  | 'committee'
  | 'timeline'
  | 'faq'
  | 'cta'
  | 'custom';

export interface PageSection {
  id: string;
  type: PageSectionType;
  order: number;
  is_active: boolean;
  title_en?: string;
  title_bn?: string;
  subtitle_en?: string;
  subtitle_bn?: string;
  content_en?: string;
  content_bn?: string;
  image_url?: string;
  images?: string[];
  button_text_en?: string;
  button_text_bn?: string;
  button_url?: string;
  meta?: Record<string, any>;
}

export interface CMSPage {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  content_en?: string;
  content_bn?: string;
  status: 'published' | 'draft' | 'scheduled';
  featured_image?: string;
  sections: PageSection[];
  seo_title_en?: string;
  seo_title_bn?: string;
  seo_desc_en?: string;
  seo_desc_bn?: string;
  is_system?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentGatewayConfig {
  id: string;
  code: string; // 'bkash' | 'nagad' | 'rocket' | 'sslcommerz' | 'card' | custom
  name: string;
  display_name_en: string;
  display_name_bn: string;
  is_enabled: boolean;
  is_test_mode: boolean;
  payment_mode?: 'manual' | 'automatic';
  account_type?: 'Merchant' | 'Personal' | 'Agent';
  merchant_id?: string;
  merchant_number?: string;
  username?: string;
  password?: string;
  base_url?: string;
  store_id?: string;
  store_passwd?: string;
  api_key?: string;
  secret_key?: string;
  app_key?: string;
  app_secret?: string;
  public_key?: string;
  private_key?: string;
  callback_url?: string;
  webhook_url?: string;
  currency: string;
  transaction_prefix: string;
  sort_order: number;
  icon_url?: string;
  instructions_en?: string;
  instructions_bn?: string;
  credentials?: {
    merchant_number?: string;
    merchant_id?: string;
    store_id?: string;
    store_passwd?: string;
    app_key?: string;
    app_secret?: string;
    api_key?: string;
    secret_key?: string;
    [key: string]: any;
  };
}

export interface ProgramScheduleItem {
  id: string;
  time: string;
  title_en: string;
  title_bn: string;
  description_en: string;
  description_bn: string;
  icon?: string;
  order: number;
  is_active: boolean;
}

export interface ProgramScheduleSectionConfig {
  is_enabled: boolean;
  badge_en: string;
  badge_bn: string;
  title_en: string;
  title_bn: string;
  subtitle_en: string;
  subtitle_bn: string;
  items: ProgramScheduleItem[];
}

export interface RegistrationFieldConfig {
  id?: string;
  name: string;
  label_en: string;
  label_bn: string;
  type: 'text' | 'number' | 'date' | 'select' | 'tel' | 'email' | 'textarea' | 'file';
  placeholder_en?: string;
  placeholder_bn?: string;
  help_text_en?: string;
  help_text_bn?: string;
  is_required?: boolean;
  is_enabled?: boolean;
  required?: boolean;
  enabled?: boolean;
  order: number;
  options?: any[];
  options_bn?: string[];
  validation_rule?: string;
  grid_span?: 'full' | 'half';
}

export type RegistrationFormFieldConfig = RegistrationFieldConfig;

export interface RegistrationConfig {
  is_enabled: boolean;
  start_date: string;
  end_date: string;
  fee_amount: number;
  currency: string;
  event_id: string;
  max_capacity: number;
  terms_en: string;
  terms_bn: string;
  instructions_en: string;
  instructions_bn: string;
  success_message_en: string;
  success_message_bn: string;
  fields: RegistrationFieldConfig[];
}

export interface TokenFormatConfig {
  prefix: string; // e.g. "NASHS"
  separator: string; // e.g. "-"
  use_batch_number: boolean; // whether to include batch number / passing year
  batch_placeholder: string; // e.g. "[Batch Number]"
  serial_placeholder: string; // e.g. "[Registration Serial]"
  starting_number: number; // e.g. 1
  padding_length: number; // e.g. 4 => "0001"
  reset_per_batch: boolean; // true = reset serial for each batch, false = global continuous serial
  is_active: boolean; // true / false
  format_pattern?: string; // e.g. "NASHS-[Batch Number]-[Registration Serial]"
}

export interface GlobalSettings {
  site_name_en: string;
  site_name_bn: string;
  site_tagline_en: string;
  site_tagline_bn: string;
  site_description_en: string;
  site_description_bn: string;
  logo_url: string;
  mobile_logo_url: string;
  favicon_url: string;
  default_language: 'bn' | 'en';
  available_languages: string[];
  copyright_en: string;
  copyright_bn: string;
  address_en: string;
  address_bn: string;
  contact_phone: string;
  contact_email: string;
  google_maps_url: string;
  office_hours_en: string;
  office_hours_bn: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  font_family: string;
  seo_default_title: string;
  seo_meta_description: string;
  seo_og_image: string;
  search_engine_indexing: boolean;
  robots_txt: string;
  social_links: {
    facebook: string;
    youtube: string;
    twitter: string;
    linkedin: string;
    instagram: string;
  };
}

// Backwards-compatible alias
export type SiteSettings = GlobalSettings & {
  registration_fee?: number;
  currency?: string;
  registration_open?: boolean;
  registration_deadline?: string;
  facebook_url?: string;
  youtube_url?: string;
  current_event_id?: string;
  batch_calc_rule?: string;
  batch_base_year?: number;
  payment_test_mode?: boolean;
  payment_bkash_enabled?: boolean;
  payment_nagad_enabled?: boolean;
  payment_sslcommerz_enabled?: boolean;
};

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'document';
  size: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_name: string;
  user_email: string;
  action: string;
  entity: string;
  details: string;
  ip: string;
  created_at: string;
}

export interface DashboardStats {
  total_registrations: number;
  paid_registrations: number;
  pending_payments: number;
  failed_payments: number;
  total_revenue: number;
  active_batches: number;
  tokens_generated: number;
  checked_in_count: number;
  remaining_capacity: number;
  recent_registrations: Registration[];
  batch_distribution: Array<{ batch: string; count: number; paid: number }>;
}
