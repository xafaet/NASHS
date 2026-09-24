import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import {
  Batch,
  CommitteeMember,
  Committee,
  CommitteeMemberItem,
  CommitteeDesignation,
  OfflineRegistrationCenter,
  EventItem,
  Notice,
  NewsPost,
  SchoolInfo,
  AssociationInfo,
  SiteSettings,
  GlobalSettings,
  HeaderConfig,
  TopBarConfig,
  NavigationMenuItem,
  FooterConfig,
  CMSPage,
  FAQItem,
  PaymentGatewayConfig,
  RegistrationConfig,
  TokenFormatConfig,
  BatchConfig,
  CustomRole,
  User,
  Registration,
  PaymentTransaction,
  EntryToken,
  AuditLog,
  MediaItem,
  ProgramScheduleSectionConfig,
  RegistrationFieldConfig,
  GateItem,
  HeroConfig,
} from '../src/types';
import {
  initialBatches,
  initialEvent,
  initialSchoolInfo,
  initialAssociationInfo,
  initialCommittee,
  initialCommittees,
  initialCommitteeMembers,
  initialDesignations,
  initialOfflineCenters,
  initialNotices,
  initialNews,
  initialGlobalSettings,
  initialHeaderConfig,
  initialTopBarConfig,
  initialMenus,
  initialFooterConfig,
  initialPages,
  initialFAQs,
  initialPaymentGateways,
  initialRegistrationConfig,
  initialTokenFormatConfig,
  initialRegistrationFields,
  initialProgramSchedule,
  initialBatchConfig,
  initialRoles,
  initialUsers,
  initialRegistrations,
  initialTokens,
  initialGates,
  initialHeroConfig,
} from './seedData';
import { portableDb } from './db/portableDb';
import { parsePostgresUrl } from './db/config';

export interface DatabaseSchema {
  batches: Batch[];
  events: EventItem[];
  gates: GateItem[];
  school_info: SchoolInfo;
  association_info: AssociationInfo;
  committee: CommitteeMember[];
  committees: Committee[];
  committee_members: CommitteeMemberItem[];
  committee_designations: CommitteeDesignation[];
  offline_centers: OfflineRegistrationCenter[];
  notices: Notice[];
  news: NewsPost[];
  media: MediaItem[];
  settings: SiteSettings;
  global_settings: GlobalSettings;
  header_config: HeaderConfig;
  top_bar_config: TopBarConfig;
  menus: NavigationMenuItem[];
  footer_config: FooterConfig;
  pages: CMSPage[];
  faqs: FAQItem[];
  payment_gateways: PaymentGatewayConfig[];
  registration_config: RegistrationConfig;
  token_format_config: TokenFormatConfig;
  batch_config: BatchConfig;
  roles: CustomRole[];
  users: (User & { password_hash?: string })[];
  registrations: Registration[];
  payments: PaymentTransaction[];
  tokens: EntryToken[];
  audit_logs: AuditLog[];
  program_schedule: ProgramScheduleSectionConfig;
  registration_form_fields: RegistrationFieldConfig[];
  hero_config: HeroConfig;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

class DatabaseEngine {
  private data: DatabaseSchema;
  private pool: Pool | null = null;
  private isSupabaseConnected: boolean = false;

  constructor() {
    this.data = this.loadInitialData();
    this.initSupabasePool();
  }

  private parsePostgresConfig(rawUrl?: string) {
    if (!rawUrl) return null;
    try {
      const prefix = 'postgresql://';
      if (!rawUrl.startsWith(prefix)) return null;
      const rest = rawUrl.slice(prefix.length);
      const lastAt = rest.lastIndexOf('@');
      if (lastAt === -1) return null;
      const userPass = rest.slice(0, lastAt);
      const hostPart = rest.slice(lastAt + 1);
      const firstColon = userPass.indexOf(':');
      const user = userPass.slice(0, firstColon);
      const password = userPass.slice(firstColon + 1);
      const [hostPort, dbName] = hostPart.split('/');
      const [host, port] = hostPort.split(':');

      return {
        user,
        password,
        host,
        port: parseInt(port || '5432', 10),
        database: dbName || 'postgres',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
        max: 10,
      };
    } catch (e) {
      console.warn('Could not parse DATABASE_URL:', e);
      return null;
    }
  }

  private async initSupabasePool() {
    const rawUrl = process.env.DATABASE_URL;
    const config = parsePostgresUrl(rawUrl);
    if (!config) {
      console.log('No PostgreSQL/Supabase DATABASE_URL configured. Using local JSON store.');
      return;
    }

    try {
      this.pool = new Pool({
        user: config.user,
        password: config.password,
        host: config.host,
        port: config.port,
        database: config.database,
        ssl: config.ssl,
        connectionTimeoutMillis: 8000,
        max: 10,
      });
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      console.log('Connected to Supabase PostgreSQL database successfully.');
      this.isSupabaseConnected = true;
      client.release();

      // Hydrate from Supabase or seed to Supabase
      await this.syncWithSupabase();
    } catch (err: any) {
      console.warn('Supabase initial connection note (operating on memory & file cache):', err.message);
    }
  }

  private async syncWithSupabase() {
    if (!this.pool || !this.isSupabaseConnected) return;
    try {
      // 1. Hydrate Site Settings
      try {
        const res = await this.pool.query('SELECT key, value FROM site_settings');
        if (res.rows && res.rows.length > 0) {
          console.log(`Loaded ${res.rows.length} configuration settings from Supabase.`);
          for (const row of res.rows) {
            if (row.key && row.value !== undefined) {
              try {
                (this.data as any)[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
              } catch {
                (this.data as any)[row.key] = row.value;
              }
            }
          }
        }
      } catch (sErr: any) {
        console.warn('Site settings sync note:', sErr.message);
      }

      // 2. Hydrate Batches
      try {
        const bRes = await this.pool.query('SELECT * FROM batches ORDER BY passing_year DESC');
        if (bRes.rows && bRes.rows.length > 0) {
          this.data.batches = bRes.rows.map(b => ({
            id: b.id,
            name_en: b.name_en,
            name_bn: b.name_bn,
            passing_year: b.passing_year,
            batch_number: b.batch_number,
            representative_name: b.representative_name,
            representative_phone: b.representative_phone,
            registration_count: Number(b.registration_count) || 0,
            is_active: b.is_active !== false,
          }));
        } else if (this.data.batches && this.data.batches.length > 0) {
          await this.persistKeyToSupabase('batches', this.data.batches);
        }
      } catch (bErr: any) {
        console.warn('Batches sync note:', bErr.message);
      }

      // 3. Hydrate Events
      try {
        const evRes = await this.pool.query('SELECT * FROM events');
        if (evRes.rows && evRes.rows.length > 0) {
          this.data.events = evRes.rows.map(e => ({
            id: e.id,
            slug: e.slug || '85th-anniversary',
            title_en: e.title_en,
            title_bn: e.title_bn,
            tagline_en: e.tagline_en || '',
            tagline_bn: e.tagline_bn || '',
            description_en: e.description_en || '',
            description_bn: e.description_bn || '',
            event_date: e.event_date ? new Date(e.event_date).toISOString().split('T')[0] : '2027-01-16',
            start_time: e.start_time || '09:00 AM',
            end_time: e.end_time || '06:00 PM',
            registration_start: e.registration_start || '2026-01-01',
            registration_end: e.registration_end || '2026-12-31',
            max_capacity: Number(e.max_capacity) || 5000,
            venue_en: e.venue_en || 'School Grounds',
            venue_bn: e.venue_bn || 'বিদ্যালয় প্রাঙ্গণ',
            registration_fee: Number(e.registration_fee) || 1000,
            currency: e.currency || 'BDT',
            status: e.status || 'upcoming',
          }));
        } else if (this.data.events && this.data.events.length > 0) {
          await this.persistKeyToSupabase('events', this.data.events);
        }
      } catch (evErr: any) {
        console.warn('Events sync note:', evErr.message);
      }

      // 4. Hydrate Users
      try {
        const uRes = await this.pool.query('SELECT * FROM users ORDER BY created_at ASC');
        if (uRes.rows && uRes.rows.length > 0) {
          console.log(`Loaded ${uRes.rows.length} users from Supabase.`);
          let remoteUsers: (User & { password_hash?: string })[] = uRes.rows.map(r => ({
            id: r.id,
            username: r.username || (r.email ? r.email.split('@')[0] : 'user'),
            name: r.name,
            name_bn: r.name_bn || undefined,
            email: r.email,
            phone: r.phone,
            password_hash: r.password_hash,
            role: r.role || 'alumni_member',
            status: r.status || (r.is_active ? 'active' : 'inactive'),
            passing_year: r.passing_year,
            batch: r.batch,
            dob: r.dob,
            gender: r.gender,
            blood_group: r.blood_group,
            photo_url: r.photo_url || r.avatar_url,
            occupation: r.occupation,
            organization: r.organization,
            designation: r.designation,
            work_location: r.work_location,
            address: r.address,
            bio: r.bio,
            created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          }));

          // Purge any legacy dummy accounts to adhere strictly to requirement:
          // Retain ONLY the primary super admin account (super_admin / admin@nanupuralumni.org)
          const dummyUsernames = ['exec', 'content', 'event', 'finance', 'contentmanager', 'eventmanager', 'financemanager', 'farhan', 'rahim', 'test'];
          const dummyEmails = ['exec@nanupuralumni.org', 'content@nanupuralumni.org', 'event@nanupuralumni.org', 'finance@nanupuralumni.org', 'farhan@example.com', 'rahim@example.com', 'test@gmail.com', 'admin@dizency.com'];

          remoteUsers = remoteUsers.filter(u => 
            !dummyUsernames.includes((u.username || '').toLowerCase()) &&
            !dummyEmails.includes((u.email || '').toLowerCase())
          );

          if (this.pool && this.isSupabaseConnected) {
            try {
              await this.pool.query(
                `DELETE FROM public.users WHERE LOWER(username) = ANY($1) OR LOWER(email) = ANY($2)`,
                [dummyUsernames, dummyEmails]
              );
            } catch (pErr: any) {
              console.warn('Database dummy purge note:', pErr.message);
            }
          }

          // Ensure super_admin has the correct username
          remoteUsers = remoteUsers.map(u => {
            if (u.role === 'super_admin' && (u.username === 'admin' || u.username === 'superadmin')) {
              return { ...u, username: 'super_admin' };
            }
            return u;
          });

          // Merge initialUsers if missing from database
          let addedNew = false;
          for (const iu of initialUsers) {
            const foundIdx = remoteUsers.findIndex(ru => ru.role === 'super_admin' || ru.email?.toLowerCase() === iu.email?.toLowerCase() || ru.username?.toLowerCase() === iu.username?.toLowerCase());
            if (foundIdx === -1) {
              remoteUsers.push({
                ...iu,
                password_hash: iu.password_hash || bcrypt.hashSync('admin123', 10),
              });
              addedNew = true;
            } else {
              // Ensure canonical super_admin username and password hash
              remoteUsers[foundIdx].username = 'super_admin';
              if (!remoteUsers[foundIdx].password_hash) {
                remoteUsers[foundIdx].password_hash = bcrypt.hashSync('admin123', 10);
              }
            }
          }

          this.data.users = remoteUsers;
          this.saveData();
          if (addedNew) {
            await this.persistKeyToSupabase('users', this.data.users);
          }
        } else if (this.data.users && this.data.users.length > 0) {
          console.log('Seeding users to Supabase...');
          await this.persistKeyToSupabase('users', this.data.users);
        }
      } catch (uErr: any) {
        console.warn('Users sync note:', uErr.message);
      }

      // 5. Hydrate Registrations
      try {
        const regRes = await this.pool.query('SELECT * FROM event_registrations ORDER BY created_at DESC');
        if (regRes.rows && regRes.rows.length > 0) {
          console.log(`Loaded ${regRes.rows.length} registrations from Supabase.`);
          this.data.registrations = regRes.rows.map(r => ({
            id: r.id,
            event_id: r.event_id || 'event-85th-anniversary',
            full_name: r.full_name,
            dob: r.dob,
            gender: r.gender,
            blood_group: r.blood_group,
            t_shirt_size: r.t_shirt_size,
            phone: r.phone,
            email: r.email,
            passing_year: r.passing_year,
            batch_id: r.batch_id,
            batch_name: r.batch_name,
            batch_name_bn: r.batch_name_bn,
            fee_amount: Number(r.fee_amount) || 1000,
            currency: r.currency || 'BDT',
            payment_status: r.payment_status || 'pending',
            registration_status: r.registration_status || 'pending',
            payment_method: r.payment_method,
            token_id: r.token_id,
            token_code: r.token_code,
            checked_in: r.checked_in || false,
            checked_in_at: r.checked_in_at,
            created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
            updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : (r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()),
          }));
        } else if (this.data.registrations && this.data.registrations.length > 0) {
          await this.persistKeyToSupabase('registrations', this.data.registrations);
        }
      } catch (regErr: any) {
        console.warn('Registrations sync note:', regErr.message);
      }

      // 6. Hydrate Tokens
      try {
        const tokRes = await this.pool.query('SELECT * FROM entry_tokens');
        if (tokRes.rows && tokRes.rows.length > 0) {
          this.data.tokens = tokRes.rows.map(t => ({
            id: t.id,
            token_code: t.token_code,
            registration_id: t.registration_id,
            event_id: t.event_id || 'event-85th-anniversary',
            member_name: t.member_name,
            batch_name: t.batch_name,
            batch_name_bn: t.batch_name_bn,
            qr_code_svg: t.qr_code_svg || '',
            status: t.status || 'active',
            checked_in: t.checked_in || false,
            checked_in_at: t.checked_in_at,
            created_at: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
          }));
        } else if (this.data.tokens && this.data.tokens.length > 0) {
          await this.persistKeyToSupabase('tokens', this.data.tokens);
        }
      } catch (tErr: any) {
        console.warn('Tokens sync note:', tErr.message);
      }

      // 7. Hydrate Notices
      try {
        const nRes = await this.pool.query('SELECT * FROM notices ORDER BY publish_date DESC');
        if (nRes.rows && nRes.rows.length > 0) {
          this.data.notices = nRes.rows.map(n => ({
            id: n.id,
            title_en: n.title_en,
            title_bn: n.title_bn,
            content_en: n.content_en,
            content_bn: n.content_bn,
            publish_date: n.publish_date ? new Date(n.publish_date).toISOString().split('T')[0] : '2026-01-01',
            is_featured: n.is_featured || false,
            is_active: n.is_active !== false,
          }));
        } else if (this.data.notices && this.data.notices.length > 0) {
          await this.persistKeyToSupabase('notices', this.data.notices);
        }
      } catch (nErr: any) {
        console.warn('Notices sync note:', nErr.message);
      }

      // 8. Hydrate News
      try {
        const nwRes = await this.pool.query('SELECT * FROM news_posts ORDER BY publish_date DESC');
        if (nwRes.rows && nwRes.rows.length > 0) {
          this.data.news = nwRes.rows.map(nw => ({
            id: nw.id,
            slug: nw.slug,
            title_en: nw.title_en,
            title_bn: nw.title_bn,
            content_en: nw.content_en,
            content_bn: nw.content_bn,
            category: nw.category || 'General',
            author: nw.author || 'Alumni Secretariat',
            publish_date: nw.publish_date ? new Date(nw.publish_date).toISOString().split('T')[0] : '2026-01-01',
            is_published: nw.is_published !== false,
            views: nw.views || 0,
          }));
        } else if (this.data.news && this.data.news.length > 0) {
          await this.persistKeyToSupabase('news', this.data.news);
        }
      } catch (nwErr: any) {
        console.warn('News sync note:', nwErr.message);
      }

      // Update local file cache
      this.saveData();
    } catch (err: any) {
      console.warn('Error syncing with Supabase:', err.message);
    }
  }

  public async persistKeyToSupabase(key: string, value: any) {
    if (!this.pool || !this.isSupabaseConnected) return;
    try {
      // 1. General Site Settings table entry
      await this.pool.query(
        `INSERT INTO site_settings (key, value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) 
         DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );

      // 2. Real table synchronization for users
      if (key === 'users' && Array.isArray(value)) {
        for (const u of value) {
          try {
            await this.pool.query(
              `INSERT INTO users (id, name, name_bn, email, phone, password_hash, role, status, passing_year, batch, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
               ON CONFLICT (id) DO UPDATE
               SET name = $2, name_bn = $3, email = $4, phone = $5, password_hash = $6, role = $7, status = $8, passing_year = $9, batch = $10, updated_at = NOW()`,
              [u.id, u.name, u.name_bn || '', u.email, u.phone, u.password_hash || '', u.role, u.status || 'active', u.passing_year || null, u.batch || '']
            );
          } catch (uErr: any) {
            console.warn(`User row sync error (${u.email}):`, uErr.message);
          }
        }
      }

      // 3. Real table synchronization for registrations
      if (key === 'registrations' && Array.isArray(value)) {
        for (const r of value) {
          try {
            await this.pool.query(
              `INSERT INTO event_registrations (id, event_id, user_id, full_name, dob, gender, blood_group, t_shirt_size, phone, email, passing_year, batch_id, batch_name, batch_name_bn, fee_amount, currency, payment_status, registration_status, payment_method, token_id, token_code, checked_in, checked_in_at, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
               ON CONFLICT (id) DO UPDATE
               SET full_name = $4, t_shirt_size = $8, phone = $9, email = $10, fee_amount = $15, payment_status = $17, registration_status = $18, payment_method = $19, token_id = $20, token_code = $21, checked_in = $22, checked_in_at = $23, updated_at = NOW()`,
              [
                r.id,
                r.event_id || 'event-85th-anniversary',
                null,
                r.full_name,
                r.dob || '1990-01-01',
                r.gender || 'male',
                r.blood_group || 'B+',
                r.t_shirt_size || 'L',
                r.phone,
                r.email || '',
                r.passing_year || 2008,
                r.batch_id || 'batch-2008',
                r.batch_name || '',
                r.batch_name_bn || '',
                r.fee_amount || 1000,
                r.currency || 'BDT',
                r.payment_status || 'pending',
                r.registration_status || 'pending',
                r.payment_method || 'bKash',
                r.token_id || '',
                r.token_code || '',
                r.checked_in || false,
                r.checked_in_at || null,
              ]
            );
          } catch (rErr: any) {
            console.warn(`Registration row sync error (${r.id}):`, rErr.message);
          }
        }
      }

      // 4. Real table synchronization for batches
      if (key === 'batches' && Array.isArray(value)) {
        for (const b of value) {
          try {
            await this.pool.query(
              `INSERT INTO batches (id, name_en, name_bn, passing_year, batch_number, representative_name, representative_phone, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO UPDATE
               SET name_en = $2, name_bn = $3, passing_year = $4, batch_number = $5, representative_name = $6, representative_phone = $7, is_active = $8`,
              [b.id, b.name_en, b.name_bn, b.passing_year, b.batch_number, b.representative_name, b.representative_phone, b.is_active]
            );
          } catch (bErr: any) {
            console.warn(`Batch row sync error (${b.id}):`, bErr.message);
          }
        }
      }

      // 5. Real table synchronization for tokens
      if (key === 'tokens' && Array.isArray(value)) {
        for (const t of value) {
          try {
            await this.pool.query(
              `INSERT INTO entry_tokens (id, token_code, registration_id, event_id, member_name, batch_name, status, checked_in, checked_in_at, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
               ON CONFLICT (id) DO UPDATE
               SET token_code = $2, member_name = $5, batch_name = $6, status = $7, checked_in = $8, checked_in_at = $9`,
              [t.id, t.token_code, t.registration_id, t.event_id || 'event-85th-anniversary', t.member_name, t.batch_name, t.status || 'active', t.checked_in || false, t.checked_in_at || null]
            );
          } catch (tErr: any) {
            console.warn(`Token row sync error (${t.id}):`, tErr.message);
          }
        }
      }

      // 6. Dedicated sync for notices
      if (key === 'notices' && Array.isArray(value)) {
        for (const n of value) {
          try {
            await this.pool.query(
              `INSERT INTO notices (id, title_en, title_bn, content_en, content_bn, publish_date, is_featured, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO UPDATE
               SET title_en = $2, title_bn = $3, content_en = $4, content_bn = $5, is_featured = $7, is_active = $8`,
              [n.id, n.title_en, n.title_bn, n.content_en, n.content_bn, n.publish_date || '2026-01-01', n.is_featured || false, n.is_active !== false]
            );
          } catch (nErr: any) {
            console.warn(`Notice row sync error (${n.id}):`, nErr.message);
          }
        }
      }

      // 7. Dedicated sync for news
      if (key === 'news' && Array.isArray(value)) {
        for (const nw of value) {
          try {
            await this.pool.query(
              `INSERT INTO news_posts (id, slug, title_en, title_bn, content_en, content_bn, category, publish_date, is_published, views)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (id) DO UPDATE
               SET slug = $2, title_en = $3, title_bn = $4, content_en = $5, content_bn = $6, is_published = $9, views = $10`,
              [nw.id, nw.slug, nw.title_en, nw.title_bn, nw.content_en, nw.content_bn, nw.category || 'General', nw.publish_date || '2026-01-01', nw.is_published !== false, nw.views || 0]
            );
          } catch (nwErr: any) {
            console.warn(`News row sync error (${nw.id}):`, nwErr.message);
          }
        }
      }

      // 8. Dedicated sync for audit logs
      if (key === 'audit_logs' && Array.isArray(value)) {
        const recentLogs = value.slice(-20);
        for (const l of recentLogs) {
          try {
            await this.pool.query(
              `INSERT INTO audit_logs (id, user_name, user_email, action, entity, details, ip, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (id) DO NOTHING`,
              [l.id, l.user_name || 'Admin', l.user_email || 'admin@nanupuralumni.org', l.action, l.entity || 'System', l.details || '', l.ip || null, l.created_at || new Date().toISOString()]
            );
          } catch {}
        }
      }

      // 9. Dedicated sync for menus
      if (key === 'menus' && Array.isArray(value)) {
        try {
          await this.pool.query('DELETE FROM menus');
          for (const m of value) {
            await this.pool.query(
              `INSERT INTO menus (id, label_en, label_bn, url, target, order_index, parent_id, is_active, children, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
              [
                m.id,
                m.label_en || '',
                m.label_bn || '',
                m.url || '',
                m.target || '_self',
                m.order || 1,
                m.parent_id || null,
                m.is_active !== false,
                JSON.stringify(m.children || []),
              ]
            );
          }
        } catch (mErr: any) {
          // Table sync note
        }
      }

      // 10. Dedicated sync for pages
      if (key === 'pages' && Array.isArray(value)) {
        try {
          for (const p of value) {
            await this.pool.query(
              `INSERT INTO pages (id, slug, title_en, title_bn, status, sections, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())
               ON CONFLICT (id) DO UPDATE 
               SET slug = $2, title_en = $3, title_bn = $4, status = $5, sections = $6, updated_at = NOW()`,
              [
                p.id,
                p.slug,
                p.title_en || '',
                p.title_bn || '',
                p.status || 'published',
                JSON.stringify(p.sections || []),
              ]
            );
          }
        } catch (pErr: any) {
          // Table sync note
        }
      }
    } catch (err: any) {
      console.warn(`Supabase background persistence note for key ${key}:`, err.message);
    }
  }

  public async deleteRecord(table: string, id: string): Promise<void> {
    if (!this.pool || !this.isSupabaseConnected) return;
    try {
      let targetTable = table;
      if (table === 'registrations') targetTable = 'event_registrations';
      if (table === 'tokens') targetTable = 'entry_tokens';
      if (table === 'news') targetTable = 'news_posts';

      await this.pool.query(`DELETE FROM public.${targetTable} WHERE id = $1`, [id]);
    } catch (err: any) {
      console.warn(`Delete record error (${table} ${id}):`, err.message);
    }
  }

  private loadInitialData(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        const resolved: DatabaseSchema = {
          batches: parsed.batches || initialBatches,
          events: parsed.events || [initialEvent],
          gates: parsed.gates || initialGates,
          school_info: parsed.school_info || initialSchoolInfo,
          association_info: parsed.association_info || initialAssociationInfo,
          committee: parsed.committee || initialCommittee,
          committees: parsed.committees || initialCommittees,
          committee_members: parsed.committee_members || initialCommitteeMembers,
          committee_designations: parsed.committee_designations || initialDesignations,
          offline_centers: parsed.offline_centers || initialOfflineCenters,
          notices: parsed.notices || initialNotices,
          news: parsed.news || initialNews,
          media: parsed.media || [
            {
              id: 'med-1',
              name: 'nash-school-building.jpg',
              url: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80',
              type: 'image',
              size: '1.2 MB',
              created_at: new Date().toISOString(),
            },
          ],
          global_settings: parsed.global_settings || initialGlobalSettings,
          header_config: parsed.header_config || initialHeaderConfig,
          top_bar_config: parsed.top_bar_config || initialTopBarConfig,
          menus: parsed.menus || initialMenus,
          footer_config: parsed.footer_config || initialFooterConfig,
          pages: parsed.pages || initialPages,
          faqs: parsed.faqs || initialFAQs,
          payment_gateways: parsed.payment_gateways || initialPaymentGateways,
          registration_config: parsed.registration_config || initialRegistrationConfig,
          token_format_config: parsed.token_format_config || initialTokenFormatConfig,
          batch_config: parsed.batch_config || initialBatchConfig,
          roles: parsed.roles || initialRoles,
          settings: parsed.settings || {
            ...initialGlobalSettings,
            registration_fee: parsed.registration_config?.fee_amount || 1000,
            currency: 'BDT',
            registration_open: true,
            registration_deadline: '2026-12-31',
            current_event_id: 'event-85th-anniversary',
            batch_calc_rule: '2008_base_65',
            batch_base_year: 2008,
            payment_test_mode: true,
            payment_bkash_enabled: true,
            payment_nagad_enabled: true,
            payment_sslcommerz_enabled: true,
          },
          users: (() => {
            const existing = parsed.users || [];
            const dummyUsernames = ['exec', 'content', 'event', 'finance', 'contentmanager', 'eventmanager', 'financemanager', 'farhan', 'rahim', 'test'];
            const dummyEmails = ['exec@nanupuralumni.org', 'content@nanupuralumni.org', 'event@nanupuralumni.org', 'finance@nanupuralumni.org', 'farhan@example.com', 'rahim@example.com', 'test@gmail.com', 'admin@dizency.com'];

            let filtered = existing.filter((u: any) => 
              !dummyUsernames.includes((u.username || '').toLowerCase()) &&
              !dummyEmails.includes((u.email || '').toLowerCase()) &&
              !(u.email || '').endsWith('@example.com')
            );

            // Ensure super_admin canonical user exists
            const superAdmin = initialUsers[0];
            const hasSuperAdmin = filtered.some((u: any) => u.role === 'super_admin');
            if (!hasSuperAdmin) {
              filtered.unshift({
                ...superAdmin,
                password_hash: bcrypt.hashSync('admin123', 10),
              });
            } else {
              filtered = filtered.map((u: any) => {
                if (u.role === 'super_admin') {
                  return {
                    ...u,
                    username: 'super_admin',
                    password_hash: u.password_hash || bcrypt.hashSync('admin123', 10),
                  };
                }
                return u;
              });
            }

            return filtered;
          })(),
          registrations: parsed.registrations || initialRegistrations,
          payments: parsed.payments || [],
          tokens: parsed.tokens || initialTokens,
          audit_logs: parsed.audit_logs || [],
          program_schedule: parsed.program_schedule || initialProgramSchedule,
          registration_form_fields: parsed.registration_form_fields || initialRegistrationFields,
          hero_config: parsed.hero_config || initialHeroConfig,
        };
        this.saveData(resolved);
        return resolved;
      }
    } catch (e) {
      console.error('Error loading db.json, using defaults:', e);
    }

    const initial: DatabaseSchema = {
      batches: initialBatches,
      events: [initialEvent],
      gates: initialGates,
      school_info: initialSchoolInfo,
      association_info: initialAssociationInfo,
      committee: initialCommittee,
      committees: initialCommittees,
      committee_members: initialCommitteeMembers,
      committee_designations: initialDesignations,
      offline_centers: initialOfflineCenters,
      notices: initialNotices,
      news: initialNews,
      media: [
        {
          id: 'med-1',
          name: 'nash-school-building.jpg',
          url: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=80',
          type: 'image',
          size: '1.2 MB',
          created_at: new Date().toISOString(),
        },
        {
          id: 'med-2',
          name: '85th-anniversary-poster.jpg',
          url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1600&q=80',
          type: 'image',
          size: '2.4 MB',
          created_at: new Date().toISOString(),
        },
      ],
      global_settings: initialGlobalSettings,
      header_config: initialHeaderConfig,
      top_bar_config: initialTopBarConfig,
      menus: initialMenus,
      footer_config: initialFooterConfig,
      pages: initialPages,
      faqs: initialFAQs,
      payment_gateways: initialPaymentGateways,
      registration_config: initialRegistrationConfig,
      token_format_config: initialTokenFormatConfig,
      batch_config: initialBatchConfig,
      roles: initialRoles,
      settings: {
        ...initialGlobalSettings,
        registration_fee: 1000,
        currency: 'BDT',
        registration_open: true,
        registration_deadline: '2026-12-31',
        current_event_id: 'event-85th-anniversary',
        batch_calc_rule: '2008_base_65',
        batch_base_year: 2008,
        payment_test_mode: true,
        payment_bkash_enabled: true,
        payment_nagad_enabled: true,
        payment_sslcommerz_enabled: true,
      },
      users: initialUsers,
      registrations: initialRegistrations,
      payments: [
        {
          id: 'pay-1001',
          registration_id: 'REG-85-1001',
          transaction_id: 'TRX-BKASH-891234',
          gateway: 'bkash',
          method: 'bKash Mobile App',
          amount: 1000,
          currency: 'BDT',
          status: 'paid',
          gateway_ref: 'BKASH_REF_981721',
          created_at: '2026-03-01T10:18:00Z',
        },
        {
          id: 'pay-1002',
          registration_id: 'REG-85-1002',
          transaction_id: 'TRX-NAGAD-441209',
          gateway: 'nagad',
          method: 'Nagad Gateway',
          amount: 1000,
          currency: 'BDT',
          status: 'paid',
          gateway_ref: 'NAGAD_REF_110292',
          created_at: '2026-03-02T14:25:00Z',
        },
      ],
      tokens: initialTokens,
      audit_logs: [
        {
          id: 'log-1',
          user_name: 'Chief Admin (NASH IT)',
          user_email: 'admin@nanupuralumni.org',
          action: 'INITIALIZE_SYSTEM',
          entity: 'System',
          details: 'Initialized 85th Anniversary CMS Platform with database-driven WordPress-style architecture and 2008=65th batch baseline.',
          ip: '127.0.0.1',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      program_schedule: initialProgramSchedule,
      registration_form_fields: initialRegistrationFields,
      hero_config: initialHeroConfig,
    };

    this.saveData(initial);
    return initial;
  }

  private saveData(snapshot?: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const toWrite = snapshot || this.data;
      fs.writeFileSync(DB_FILE, JSON.stringify(toWrite, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving db.json:', e);
    }
  }

  public get<K extends keyof DatabaseSchema>(key: K): DatabaseSchema[K] {
    if (key === 'users') {
      const dummyUsernames = ['exec', 'content', 'event', 'finance', 'contentmanager', 'eventmanager', 'financemanager', 'farhan', 'rahim', 'test'];
      const dummyEmails = ['exec@nanupuralumni.org', 'content@nanupuralumni.org', 'event@nanupuralumni.org', 'finance@nanupuralumni.org', 'farhan@example.com', 'rahim@example.com', 'test@gmail.com', 'admin@dizency.com'];
      return (this.data.users || []).filter(u =>
        !dummyUsernames.includes((u.username || '').toLowerCase()) &&
        !dummyEmails.includes((u.email || '').toLowerCase()) &&
        !(u.email || '').endsWith('@example.com')
      ).map(u => {
        if (u.role === 'super_admin' && u.username !== 'super_admin') {
          return { ...u, username: 'super_admin' };
        }
        return u;
      }) as DatabaseSchema[K];
    }
    return this.data[key];
  }

  public set<K extends keyof DatabaseSchema>(key: K, value: DatabaseSchema[K]) {
    if (key === 'users' && Array.isArray(value)) {
      const dummyUsernames = ['exec', 'content', 'event', 'finance', 'contentmanager', 'eventmanager', 'financemanager', 'farhan', 'rahim', 'test'];
      const dummyEmails = ['exec@nanupuralumni.org', 'content@nanupuralumni.org', 'event@nanupuralumni.org', 'finance@nanupuralumni.org', 'farhan@example.com', 'rahim@example.com', 'test@gmail.com', 'admin@dizency.com'];
      value = (value as any[]).filter(u =>
        !dummyUsernames.includes((u.username || '').toLowerCase()) &&
        !dummyEmails.includes((u.email || '').toLowerCase()) &&
        !(u.email || '').endsWith('@example.com')
      ) as DatabaseSchema[K];
    }
    this.data[key] = value;
    this.saveData();
    this.persistKeyToSupabase(key as string, value);
    portableDb.saveSetting(key as string, value).catch(() => {});
  }

  public logAudit(
    user_name: string,
    user_email: string,
    action: string,
    entity: string,
    details: string,
    ip: string = '127.0.0.1'
  ) {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_name,
      user_email,
      action,
      entity,
      details,
      ip,
      created_at: new Date().toISOString(),
    };
    if (!this.data.audit_logs) {
      this.data.audit_logs = [];
    }
    this.data.audit_logs.unshift(log);
    if (this.data.audit_logs.length > 300) {
      this.data.audit_logs = this.data.audit_logs.slice(0, 300);
    }
    this.saveData();
    this.persistKeyToSupabase('audit_logs', this.data.audit_logs);
  }

  public getTableStats(): Record<string, number> {
    return {
      users: (this.data.users || []).length,
      registrations: (this.data.registrations || []).length,
      batches: (this.data.batches || []).length,
      events: (this.data.events || []).length,
      tokens: (this.data.tokens || []).length,
      notices: (this.data.notices || []).length,
      news: (this.data.news || []).length,
      committee: (this.data.committee || []).length,
      audit_logs: (this.data.audit_logs || []).length,
    };
  }

  public async getUserByCredential(credential: string): Promise<User | null> {
    if (!credential) return null;
    const clean = credential.trim().toLowerCase();

    // 1. Check in-memory store first
    const users = this.data.users || [];
    const memoryMatch = users.find(u =>
      (u.email && u.email.toLowerCase() === clean) ||
      (u.username && u.username.toLowerCase() === clean) ||
      ((clean === 'admin' || clean === 'super_admin') && u.role === 'super_admin') ||
      (u.phone && u.phone.trim() === credential.trim())
    );
    if (memoryMatch) return memoryMatch;

    // 2. Query Supabase directly if connected
    if (this.pool && this.isSupabaseConnected) {
      try {
        const res = await this.pool.query(
          'SELECT * FROM public.users WHERE LOWER(email) = $1 OR LOWER(username) = $1 OR phone = $2 LIMIT 1',
          [clean, credential.trim()]
        );
        if (res.rows && res.rows.length > 0) {
          const r = res.rows[0];
          const fetchedUser: User = {
            id: r.id,
            username: r.username || (r.email ? r.email.split('@')[0] : 'user'),
            name: r.name,
            name_bn: r.name_bn || undefined,
            email: r.email,
            phone: r.phone,
            password_hash: r.password_hash,
            role: r.role || 'alumni_member',
            status: r.status || (r.is_active ? 'active' : 'inactive'),
            passing_year: r.passing_year,
            batch: r.batch,
            dob: r.dob,
            gender: r.gender,
            blood_group: r.blood_group,
            photo_url: r.photo_url || r.avatar_url,
            occupation: r.occupation,
            organization: r.organization,
            designation: r.designation,
            work_location: r.work_location,
            address: r.address,
            bio: r.bio,
            created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          };
          this.data.users.push(fetchedUser);
          return fetchedUser;
        }
      } catch (err: any) {
        console.warn('Direct user lookup warning:', err.message);
      }
    }

    // 3. Fallback to initialUsers
    const initialMatch = initialUsers.find(u =>
      (u.email && u.email.toLowerCase() === clean) ||
      (u.username && u.username.toLowerCase() === clean) ||
      (u.phone && u.phone.trim() === credential.trim())
    );
    if (initialMatch) {
      const ensuredUser: User & { password_hash?: string } = {
        ...initialMatch,
        password_hash: initialMatch.password_hash || bcrypt.hashSync(initialMatch.role === 'super_admin' ? 'admin123' : 'password', 10),
      };
      if (!this.data.users.some(u => u.id === ensuredUser.id)) {
        this.data.users.push(ensuredUser);
        this.saveData();
      }
      return ensuredUser;
    }

    return null;
  }

  public async updateUserPassword(userId: string, newHash: string): Promise<boolean> {
    const users = this.data.users || [];
    const uIndex = users.findIndex(u => u.id === userId);
    if (uIndex !== -1) {
      users[uIndex].password_hash = newHash;
      this.set('users', users);
    }
    if (this.pool && this.isSupabaseConnected) {
      try {
        await this.pool.query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
        return true;
      } catch (err: any) {
        console.warn('Update password in Supabase error:', err.message);
      }
    }
    return true;
  }

  public exportAsJSON(): string {
    return JSON.stringify(
      {
        metadata: {
          system: 'Nanupur Abu Sobhan High School Alumni Portal',
          celebration: 'Historic 85th Anniversary Celebration & Grand Reunion 2027',
          exported_at: new Date().toISOString(),
          version: '2.0.0',
          environment: process.env.NODE_ENV || 'production',
          table_counts: this.getTableStats(),
        },
        data: this.data,
      },
      null,
      2
    );
  }

  public exportRegistrationsCSV(): string {
    const registrations = this.data.registrations || [];
    const headers = [
      'Registration ID',
      'Full Name',
      'Passing Year',
      'Batch',
      'T-Shirt Size',
      'Phone',
      'Email',
      'Gender',
      'Blood Group',
      'Fee Amount',
      'Currency',
      'Payment Status',
      'Payment Method',
      'Registration Status',
      'Token Code',
      'Checked In',
      'Checked In At',
      'Registered At',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = registrations.map(r => [
      escapeCsv(r.id),
      escapeCsv(r.full_name),
      escapeCsv(r.passing_year),
      escapeCsv(r.batch_name || `Batch ${r.passing_year}`),
      escapeCsv(r.t_shirt_size || 'L'),
      escapeCsv(r.phone),
      escapeCsv(r.email || ''),
      escapeCsv(r.gender || ''),
      escapeCsv(r.blood_group || ''),
      escapeCsv(r.fee_amount || 1000),
      escapeCsv(r.currency || 'BDT'),
      escapeCsv(r.payment_status || 'pending'),
      escapeCsv(r.payment_method || ''),
      escapeCsv(r.registration_status || 'pending'),
      escapeCsv(r.token_code || ''),
      escapeCsv(r.checked_in ? 'YES' : 'NO'),
      escapeCsv(r.checked_in_at || ''),
      escapeCsv(r.created_at || ''),
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  }

  public exportAsSQL(dialect: 'postgres' | 'mysql' = 'postgres'): string {
    const timestamp = new Date().toISOString();
    const isMySQL = dialect === 'mysql';
    const sqlEscape = (v: any): string => {
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'boolean') return isMySQL ? (v ? '1' : '0') : (v ? 'TRUE' : 'FALSE');
      if (typeof v === 'number') return isNaN(v) ? 'NULL' : v.toString();
      if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
      return `'${String(v).replace(/'/g, "''")}'`;
    };

    const lines: string[] = [];
    lines.push(`-- ============================================================`);
    lines.push(`-- Nanupur Abu Sobhan High School Alumni Portal Database Dump`);
    lines.push(`-- 85th Anniversary Celebration & Grand Reunion 2027`);
    lines.push(`-- Dump Generated: ${timestamp}`);
    lines.push(`-- Target Engine: ${isMySQL ? 'MySQL 5.7+ / 8.0+ / MariaDB (cPanel phpMyAdmin)' : 'PostgreSQL 14+ / Supabase / Cloud SQL'}`);
    lines.push(`-- ============================================================\n`);

    if (isMySQL) {
      lines.push(`SET FOREIGN_KEY_CHECKS=0;`);
      lines.push(`SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";`);
      lines.push(`SET time_zone = "+00:00";`);
      lines.push(`/*!40101 SET NAMES utf8mb4 */;\n`);
    }

    // 1. TABLE: site_settings
    lines.push(`-- ------------------------------------------------------------`);
    lines.push(`-- 1. TABLE: site_settings`);
    lines.push(`-- ------------------------------------------------------------`);
    if (isMySQL) {
      lines.push(`CREATE TABLE IF NOT EXISTS \`site_settings\` (`);
      lines.push(`  \`id\` VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  \`key\` VARCHAR(100) UNIQUE NOT NULL,`);
      lines.push(`  \`value\` LONGTEXT NOT NULL,`);
      lines.push(`  \`description\` TEXT,`);
      lines.push(`  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
      lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);
    } else {
      lines.push(`CREATE TABLE IF NOT EXISTS site_settings (`);
      lines.push(`  id VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  key VARCHAR(100) UNIQUE NOT NULL,`);
      lines.push(`  value JSONB NOT NULL,`);
      lines.push(`  description TEXT,`);
      lines.push(`  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      lines.push(`);\n`);
    }

    const globalSettings = this.data.global_settings;
    if (globalSettings) {
      if (isMySQL) {
        lines.push(
          `INSERT INTO \`site_settings\` (\`id\`, \`key\`, \`value\`, \`description\`, \`updated_at\`) VALUES ('set-global', 'global_settings', ${sqlEscape(globalSettings)}, 'Global application settings', CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`);`
        );
      } else {
        lines.push(
          `INSERT INTO site_settings (id, key, value, description, updated_at) VALUES ('set-global', 'global_settings', ${sqlEscape(globalSettings)}, 'Global application settings', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`
        );
      }
    }
    const regConfig = this.data.registration_config;
    if (regConfig) {
      if (isMySQL) {
        lines.push(
          `INSERT INTO \`site_settings\` (\`id\`, \`key\`, \`value\`, \`description\`, \`updated_at\`) VALUES ('set-reg', 'registration_config', ${sqlEscape(regConfig)}, 'Registration rules and fee tiers', CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`);`
        );
      } else {
        lines.push(
          `INSERT INTO site_settings (id, key, value, description, updated_at) VALUES ('set-reg', 'registration_config', ${sqlEscape(regConfig)}, 'Registration rules and fee tiers', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`
        );
      }
    }
    lines.push('\n');

    // 2. TABLE: users
    lines.push(`-- ------------------------------------------------------------`);
    lines.push(`-- 2. TABLE: users`);
    lines.push(`-- ------------------------------------------------------------`);
    if (isMySQL) {
      lines.push(`CREATE TABLE IF NOT EXISTS \`users\` (`);
      lines.push(`  \`id\` VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  \`username\` VARCHAR(100) UNIQUE,`);
      lines.push(`  \`name\` VARCHAR(255) NOT NULL,`);
      lines.push(`  \`name_bn\` VARCHAR(255),`);
      lines.push(`  \`email\` VARCHAR(255) UNIQUE,`);
      lines.push(`  \`phone\` VARCHAR(50) UNIQUE,`);
      lines.push(`  \`password_hash\` VARCHAR(255),`);
      lines.push(`  \`role\` VARCHAR(50) DEFAULT 'alumni_member',`);
      lines.push(`  \`status\` VARCHAR(50) DEFAULT 'active',`);
      lines.push(`  \`passing_year\` INT,`);
      lines.push(`  \`batch\` VARCHAR(100),`);
      lines.push(`  \`dob\` VARCHAR(50),`);
      lines.push(`  \`gender\` VARCHAR(20),`);
      lines.push(`  \`blood_group\` VARCHAR(10),`);
      lines.push(`  \`photo_url\` TEXT,`);
      lines.push(`  \`occupation\` VARCHAR(255),`);
      lines.push(`  \`organization\` VARCHAR(255),`);
      lines.push(`  \`designation\` VARCHAR(255),`);
      lines.push(`  \`work_location\` VARCHAR(255),`);
      lines.push(`  \`address\` TEXT,`);
      lines.push(`  \`bio\` TEXT,`);
      lines.push(`  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);
    } else {
      lines.push(`CREATE TABLE IF NOT EXISTS users (`);
      lines.push(`  id VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  username VARCHAR(100) UNIQUE,`);
      lines.push(`  name VARCHAR(255) NOT NULL,`);
      lines.push(`  name_bn VARCHAR(255),`);
      lines.push(`  email VARCHAR(255) UNIQUE,`);
      lines.push(`  phone VARCHAR(50) UNIQUE,`);
      lines.push(`  password_hash VARCHAR(255),`);
      lines.push(`  role VARCHAR(50) DEFAULT 'alumni_member',`);
      lines.push(`  status VARCHAR(50) DEFAULT 'active',`);
      lines.push(`  passing_year INT,`);
      lines.push(`  batch VARCHAR(100),`);
      lines.push(`  dob VARCHAR(50),`);
      lines.push(`  gender VARCHAR(20),`);
      lines.push(`  blood_group VARCHAR(10),`);
      lines.push(`  photo_url TEXT,`);
      lines.push(`  occupation VARCHAR(255),`);
      lines.push(`  organization VARCHAR(255),`);
      lines.push(`  designation VARCHAR(255),`);
      lines.push(`  work_location VARCHAR(255),`);
      lines.push(`  address TEXT,`);
      lines.push(`  bio TEXT,`);
      lines.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      lines.push(`);\n`);
    }

    const users = (this.get('users') || []);
    for (const u of users) {
      if (isMySQL) {
        lines.push(
          `INSERT INTO \`users\` (\`id\`, \`username\`, \`name\`, \`name_bn\`, \`email\`, \`phone\`, \`password_hash\`, \`role\`, \`status\`, \`passing_year\`, \`batch\`, \`dob\`, \`gender\`, \`blood_group\`, \`photo_url\`, \`occupation\`, \`organization\`, \`designation\`, \`work_location\`, \`address\`, \`bio\`, \`created_at\`) VALUES (${sqlEscape(u.id)}, ${sqlEscape(u.username)}, ${sqlEscape(u.name)}, ${sqlEscape(u.name_bn)}, ${sqlEscape(u.email)}, ${sqlEscape(u.phone)}, ${sqlEscape(u.password_hash)}, ${sqlEscape(u.role || 'alumni_member')}, ${sqlEscape(u.status || 'active')}, ${sqlEscape(u.passing_year)}, ${sqlEscape(u.batch)}, ${sqlEscape(u.dob)}, ${sqlEscape(u.gender)}, ${sqlEscape(u.blood_group)}, ${sqlEscape(u.photo_url)}, ${sqlEscape(u.occupation)}, ${sqlEscape(u.organization)}, ${sqlEscape(u.designation)}, ${sqlEscape(u.work_location)}, ${sqlEscape(u.address)}, ${sqlEscape(u.bio)}, ${sqlEscape(u.created_at || timestamp)}) ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`);`
        );
      } else {
        lines.push(
          `INSERT INTO users (id, username, name, name_bn, email, phone, password_hash, role, status, passing_year, batch, dob, gender, blood_group, photo_url, occupation, organization, designation, work_location, address, bio, created_at) VALUES (${sqlEscape(u.id)}, ${sqlEscape(u.username)}, ${sqlEscape(u.name)}, ${sqlEscape(u.name_bn)}, ${sqlEscape(u.email)}, ${sqlEscape(u.phone)}, ${sqlEscape(u.password_hash)}, ${sqlEscape(u.role || 'alumni_member')}, ${sqlEscape(u.status || 'active')}, ${sqlEscape(u.passing_year)}, ${sqlEscape(u.batch)}, ${sqlEscape(u.dob)}, ${sqlEscape(u.gender)}, ${sqlEscape(u.blood_group)}, ${sqlEscape(u.photo_url)}, ${sqlEscape(u.occupation)}, ${sqlEscape(u.organization)}, ${sqlEscape(u.designation)}, ${sqlEscape(u.work_location)}, ${sqlEscape(u.address)}, ${sqlEscape(u.bio)}, ${sqlEscape(u.created_at || timestamp)}) ON CONFLICT (id) DO NOTHING;`
        );
      }
    }
    lines.push('\n');

    // 3. TABLE: batches
    lines.push(`-- ------------------------------------------------------------`);
    lines.push(`-- 3. TABLE: batches`);
    lines.push(`-- ------------------------------------------------------------`);
    if (isMySQL) {
      lines.push(`CREATE TABLE IF NOT EXISTS \`batches\` (`);
      lines.push(`  \`id\` VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  \`name_en\` VARCHAR(255) NOT NULL,`);
      lines.push(`  \`name_bn\` VARCHAR(255) NOT NULL,`);
      lines.push(`  \`passing_year\` INT UNIQUE NOT NULL,`);
      lines.push(`  \`batch_number\` INT,`);
      lines.push(`  \`representative_name\` VARCHAR(255),`);
      lines.push(`  \`representative_phone\` VARCHAR(50),`);
      lines.push(`  \`is_active\` BOOLEAN DEFAULT TRUE,`);
      lines.push(`  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);
    } else {
      lines.push(`CREATE TABLE IF NOT EXISTS batches (`);
      lines.push(`  id VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  name_en VARCHAR(255) NOT NULL,`);
      lines.push(`  name_bn VARCHAR(255) NOT NULL,`);
      lines.push(`  passing_year INT UNIQUE NOT NULL,`);
      lines.push(`  batch_number INT,`);
      lines.push(`  representative_name VARCHAR(255),`);
      lines.push(`  representative_phone VARCHAR(50),`);
      lines.push(`  is_active BOOLEAN DEFAULT TRUE,`);
      lines.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      lines.push(`);\n`);
    }

    const batches = this.data.batches || [];
    for (const b of batches) {
      if (isMySQL) {
        lines.push(
          `INSERT INTO \`batches\` (\`id\`, \`name_en\`, \`name_bn\`, \`passing_year\`, \`batch_number\`, \`representative_name\`, \`representative_phone\`, \`is_active\`) VALUES (${sqlEscape(b.id)}, ${sqlEscape(b.name_en)}, ${sqlEscape(b.name_bn)}, ${sqlEscape(b.passing_year)}, ${sqlEscape(b.batch_number)}, ${sqlEscape(b.representative_name)}, ${sqlEscape(b.representative_phone)}, ${sqlEscape(b.is_active !== false)}) ON DUPLICATE KEY UPDATE \`name_en\` = VALUES(\`name_en\`);`
        );
      } else {
        lines.push(
          `INSERT INTO batches (id, name_en, name_bn, passing_year, batch_number, representative_name, representative_phone, is_active) VALUES (${sqlEscape(b.id)}, ${sqlEscape(b.name_en)}, ${sqlEscape(b.name_bn)}, ${sqlEscape(b.passing_year)}, ${sqlEscape(b.batch_number)}, ${sqlEscape(b.representative_name)}, ${sqlEscape(b.representative_phone)}, ${sqlEscape(b.is_active !== false)}) ON CONFLICT (id) DO NOTHING;`
        );
      }
    }
    lines.push('\n');

    // 4. TABLE: events
    lines.push(`-- ------------------------------------------------------------`);
    lines.push(`-- 4. TABLE: events`);
    lines.push(`-- ------------------------------------------------------------`);
    if (isMySQL) {
      lines.push(`CREATE TABLE IF NOT EXISTS \`events\` (`);
      lines.push(`  \`id\` VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  \`slug\` VARCHAR(255) UNIQUE NOT NULL,`);
      lines.push(`  \`title_en\` VARCHAR(255) NOT NULL,`);
      lines.push(`  \`title_bn\` VARCHAR(255) NOT NULL,`);
      lines.push(`  \`tagline_en\` TEXT,`);
      lines.push(`  \`tagline_bn\` TEXT,`);
      lines.push(`  \`description_en\` TEXT,`);
      lines.push(`  \`description_bn\` TEXT,`);
      lines.push(`  \`event_date\` DATE NOT NULL,`);
      lines.push(`  \`venue_en\` VARCHAR(255),`);
      lines.push(`  \`venue_bn\` VARCHAR(255),`);
      lines.push(`  \`registration_deadline\` DATE,`);
      lines.push(`  \`registration_fee\` NUMERIC(10, 2) DEFAULT 1000.00,`);
      lines.push(`  \`max_capacity\` INT DEFAULT 5000,`);
      lines.push(`  \`status\` VARCHAR(50) DEFAULT 'published'`);
      lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);
    } else {
      lines.push(`CREATE TABLE IF NOT EXISTS events (`);
      lines.push(`  id VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  slug VARCHAR(255) UNIQUE NOT NULL,`);
      lines.push(`  title_en VARCHAR(255) NOT NULL,`);
      lines.push(`  title_bn VARCHAR(255) NOT NULL,`);
      lines.push(`  tagline_en TEXT,`);
      lines.push(`  tagline_bn TEXT,`);
      lines.push(`  description_en TEXT,`);
      lines.push(`  description_bn TEXT,`);
      lines.push(`  event_date DATE NOT NULL,`);
      lines.push(`  venue_en VARCHAR(255),`);
      lines.push(`  venue_bn VARCHAR(255),`);
      lines.push(`  registration_deadline DATE,`);
      lines.push(`  registration_fee NUMERIC(10, 2) DEFAULT 1000.00,`);
      lines.push(`  max_capacity INT DEFAULT 5000,`);
      lines.push(`  status VARCHAR(50) DEFAULT 'published'`);
      lines.push(`);\n`);
    }

    const events = this.data.events || [];
    for (const e of events) {
      if (isMySQL) {
        lines.push(
          `INSERT INTO \`events\` (\`id\`, \`slug\`, \`title_en\`, \`title_bn\`, \`tagline_en\`, \`tagline_bn\`, \`description_en\`, \`description_bn\`, \`event_date\`, \`venue_en\`, \`venue_bn\`, \`registration_deadline\`, \`registration_fee\`, \`max_capacity\`, \`status\`) VALUES (${sqlEscape(e.id)}, ${sqlEscape(e.slug || '85th-anniversary')}, ${sqlEscape(e.title_en)}, ${sqlEscape(e.title_bn)}, ${sqlEscape(e.tagline_en)}, ${sqlEscape(e.tagline_bn)}, ${sqlEscape(e.description_en)}, ${sqlEscape(e.description_bn)}, ${sqlEscape(e.event_date || '2027-01-16')}, ${sqlEscape(e.venue_en)}, ${sqlEscape(e.venue_bn)}, ${sqlEscape((e as any).registration_deadline || e.registration_end || '2026-12-31')}, ${sqlEscape(e.registration_fee || 1000)}, ${sqlEscape(e.max_capacity || 5000)}, ${sqlEscape(e.status || 'published')}) ON DUPLICATE KEY UPDATE \`title_en\` = VALUES(\`title_en\`);`
        );
      } else {
        lines.push(
          `INSERT INTO events (id, slug, title_en, title_bn, tagline_en, tagline_bn, description_en, description_bn, event_date, venue_en, venue_bn, registration_deadline, registration_fee, max_capacity, status) VALUES (${sqlEscape(e.id)}, ${sqlEscape(e.slug || '85th-anniversary')}, ${sqlEscape(e.title_en)}, ${sqlEscape(e.title_bn)}, ${sqlEscape(e.tagline_en)}, ${sqlEscape(e.tagline_bn)}, ${sqlEscape(e.description_en)}, ${sqlEscape(e.description_bn)}, ${sqlEscape(e.event_date || '2027-01-16')}, ${sqlEscape(e.venue_en)}, ${sqlEscape(e.venue_bn)}, ${sqlEscape((e as any).registration_deadline || e.registration_end || '2026-12-31')}, ${sqlEscape(e.registration_fee || 1000)}, ${sqlEscape(e.max_capacity || 5000)}, ${sqlEscape(e.status || 'published')}) ON CONFLICT (id) DO NOTHING;`
        );
      }
    }
    lines.push('\n');

    // 5. TABLE: event_registrations
    lines.push(`-- ------------------------------------------------------------`);
    lines.push(`-- 5. TABLE: event_registrations`);
    lines.push(`-- ------------------------------------------------------------`);
    if (isMySQL) {
      lines.push(`CREATE TABLE IF NOT EXISTS \`event_registrations\` (`);
      lines.push(`  \`id\` VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  \`event_id\` VARCHAR(100),`);
      lines.push(`  \`full_name\` VARCHAR(255) NOT NULL,`);
      lines.push(`  \`dob\` VARCHAR(50),`);
      lines.push(`  \`gender\` VARCHAR(20),`);
      lines.push(`  \`blood_group\` VARCHAR(10),`);
      lines.push(`  \`t_shirt_size\` VARCHAR(10),`);
      lines.push(`  \`phone\` VARCHAR(50) NOT NULL,`);
      lines.push(`  \`email\` VARCHAR(255),`);
      lines.push(`  \`passing_year\` INT NOT NULL,`);
      lines.push(`  \`batch_id\` VARCHAR(100),`);
      lines.push(`  \`batch_name\` VARCHAR(100),`);
      lines.push(`  \`batch_name_bn\` VARCHAR(100),`);
      lines.push(`  \`fee_amount\` NUMERIC(10, 2) DEFAULT 1000.00,`);
      lines.push(`  \`currency\` VARCHAR(10) DEFAULT 'BDT',`);
      lines.push(`  \`payment_status\` VARCHAR(50) DEFAULT 'pending',`);
      lines.push(`  \`registration_status\` VARCHAR(50) DEFAULT 'pending',`);
      lines.push(`  \`payment_method\` VARCHAR(50),`);
      lines.push(`  \`token_id\` VARCHAR(100),`);
      lines.push(`  \`token_code\` VARCHAR(100),`);
      lines.push(`  \`checked_in\` BOOLEAN DEFAULT FALSE,`);
      lines.push(`  \`checked_in_at\` TIMESTAMP NULL,`);
      lines.push(`  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);
    } else {
      lines.push(`CREATE TABLE IF NOT EXISTS event_registrations (`);
      lines.push(`  id VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  event_id VARCHAR(100),`);
      lines.push(`  full_name VARCHAR(255) NOT NULL,`);
      lines.push(`  dob VARCHAR(50),`);
      lines.push(`  gender VARCHAR(20),`);
      lines.push(`  blood_group VARCHAR(10),`);
      lines.push(`  t_shirt_size VARCHAR(10),`);
      lines.push(`  phone VARCHAR(50) NOT NULL,`);
      lines.push(`  email VARCHAR(255),`);
      lines.push(`  passing_year INT NOT NULL,`);
      lines.push(`  batch_id VARCHAR(100),`);
      lines.push(`  batch_name VARCHAR(100),`);
      lines.push(`  batch_name_bn VARCHAR(100),`);
      lines.push(`  fee_amount NUMERIC(10, 2) DEFAULT 1000.00,`);
      lines.push(`  currency VARCHAR(10) DEFAULT 'BDT',`);
      lines.push(`  payment_status VARCHAR(50) DEFAULT 'pending',`);
      lines.push(`  registration_status VARCHAR(50) DEFAULT 'pending',`);
      lines.push(`  payment_method VARCHAR(50),`);
      lines.push(`  token_id VARCHAR(100),`);
      lines.push(`  token_code VARCHAR(100),`);
      lines.push(`  checked_in BOOLEAN DEFAULT FALSE,`);
      lines.push(`  checked_in_at TIMESTAMP,`);
      lines.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      lines.push(`);\n`);
    }

    const registrations = this.data.registrations || [];
    for (const r of registrations) {
      if (isMySQL) {
        lines.push(
          `INSERT INTO \`event_registrations\` (\`id\`, \`event_id\`, \`full_name\`, \`dob\`, \`gender\`, \`blood_group\`, \`t_shirt_size\`, \`phone\`, \`email\`, \`passing_year\`, \`batch_id\`, \`batch_name\`, \`batch_name_bn\`, \`fee_amount\`, \`currency\`, \`payment_status\`, \`registration_status\`, \`payment_method\`, \`token_id\`, \`token_code\`, \`checked_in\`, \`checked_in_at\`, \`created_at\`) VALUES (${sqlEscape(r.id)}, ${sqlEscape(r.event_id || 'event-85th-anniversary')}, ${sqlEscape(r.full_name)}, ${sqlEscape(r.dob)}, ${sqlEscape(r.gender)}, ${sqlEscape(r.blood_group)}, ${sqlEscape(r.t_shirt_size || 'L')}, ${sqlEscape(r.phone)}, ${sqlEscape(r.email)}, ${sqlEscape(r.passing_year)}, ${sqlEscape(r.batch_id)}, ${sqlEscape(r.batch_name)}, ${sqlEscape(r.batch_name_bn)}, ${sqlEscape(r.fee_amount || 1000)}, ${sqlEscape(r.currency || 'BDT')}, ${sqlEscape(r.payment_status || 'pending')}, ${sqlEscape(r.registration_status || 'pending')}, ${sqlEscape(r.payment_method)}, ${sqlEscape(r.token_id)}, ${sqlEscape(r.token_code)}, ${sqlEscape(r.checked_in || false)}, ${sqlEscape(r.checked_in_at)}, ${sqlEscape(r.created_at || timestamp)}) ON DUPLICATE KEY UPDATE \`payment_status\` = VALUES(\`payment_status\`);`
        );
      } else {
        lines.push(
          `INSERT INTO event_registrations (id, event_id, full_name, dob, gender, blood_group, t_shirt_size, phone, email, passing_year, batch_id, batch_name, batch_name_bn, fee_amount, currency, payment_status, registration_status, payment_method, token_id, token_code, checked_in, checked_in_at, created_at) VALUES (${sqlEscape(r.id)}, ${sqlEscape(r.event_id || 'event-85th-anniversary')}, ${sqlEscape(r.full_name)}, ${sqlEscape(r.dob)}, ${sqlEscape(r.gender)}, ${sqlEscape(r.blood_group)}, ${sqlEscape(r.t_shirt_size || 'L')}, ${sqlEscape(r.phone)}, ${sqlEscape(r.email)}, ${sqlEscape(r.passing_year)}, ${sqlEscape(r.batch_id)}, ${sqlEscape(r.batch_name)}, ${sqlEscape(r.batch_name_bn)}, ${sqlEscape(r.fee_amount || 1000)}, ${sqlEscape(r.currency || 'BDT')}, ${sqlEscape(r.payment_status || 'pending')}, ${sqlEscape(r.registration_status || 'pending')}, ${sqlEscape(r.payment_method)}, ${sqlEscape(r.token_id)}, ${sqlEscape(r.token_code)}, ${sqlEscape(r.checked_in || false)}, ${sqlEscape(r.checked_in_at)}, ${sqlEscape(r.created_at || timestamp)}) ON CONFLICT (id) DO NOTHING;`
        );
      }
    }
    lines.push('\n');

    // 6. TABLE: entry_tokens
    lines.push(`-- ------------------------------------------------------------`);
    lines.push(`-- 6. TABLE: entry_tokens`);
    lines.push(`-- ------------------------------------------------------------`);
    if (isMySQL) {
      lines.push(`CREATE TABLE IF NOT EXISTS \`entry_tokens\` (`);
      lines.push(`  \`id\` VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  \`token_code\` VARCHAR(100) UNIQUE NOT NULL,`);
      lines.push(`  \`registration_id\` VARCHAR(100),`);
      lines.push(`  \`event_id\` VARCHAR(100),`);
      lines.push(`  \`member_name\` VARCHAR(255) NOT NULL,`);
      lines.push(`  \`batch_name\` VARCHAR(100),`);
      lines.push(`  \`batch_name_bn\` VARCHAR(100),`);
      lines.push(`  \`status\` VARCHAR(50) DEFAULT 'active',`);
      lines.push(`  \`checked_in\` BOOLEAN DEFAULT FALSE,`);
      lines.push(`  \`checked_in_at\` TIMESTAMP NULL,`);
      lines.push(`  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);
    } else {
      lines.push(`CREATE TABLE IF NOT EXISTS entry_tokens (`);
      lines.push(`  id VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  token_code VARCHAR(100) UNIQUE NOT NULL,`);
      lines.push(`  registration_id VARCHAR(100),`);
      lines.push(`  event_id VARCHAR(100),`);
      lines.push(`  member_name VARCHAR(255) NOT NULL,`);
      lines.push(`  batch_name VARCHAR(100),`);
      lines.push(`  batch_name_bn VARCHAR(100),`);
      lines.push(`  status VARCHAR(50) DEFAULT 'active',`);
      lines.push(`  checked_in BOOLEAN DEFAULT FALSE,`);
      lines.push(`  checked_in_at TIMESTAMP,`);
      lines.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      lines.push(`);\n`);
    }

    const tokens = this.data.tokens || [];
    for (const t of tokens) {
      if (isMySQL) {
        lines.push(
          `INSERT INTO \`entry_tokens\` (\`id\`, \`token_code\`, \`registration_id\`, \`event_id\`, \`member_name\`, \`batch_name\`, \`batch_name_bn\`, \`status\`, \`checked_in\`, \`checked_in_at\`, \`created_at\`) VALUES (${sqlEscape(t.id)}, ${sqlEscape(t.token_code)}, ${sqlEscape(t.registration_id)}, ${sqlEscape(t.event_id || 'event-85th-anniversary')}, ${sqlEscape(t.member_name)}, ${sqlEscape(t.batch_name)}, ${sqlEscape(t.batch_name_bn)}, ${sqlEscape(t.status || 'active')}, ${sqlEscape(t.checked_in || false)}, ${sqlEscape(t.checked_in_at)}, ${sqlEscape(t.created_at || timestamp)}) ON DUPLICATE KEY UPDATE \`status\` = VALUES(\`status\`);`
        );
      } else {
        lines.push(
          `INSERT INTO entry_tokens (id, token_code, registration_id, event_id, member_name, batch_name, batch_name_bn, status, checked_in, checked_in_at, created_at) VALUES (${sqlEscape(t.id)}, ${sqlEscape(t.token_code)}, ${sqlEscape(t.registration_id)}, ${sqlEscape(t.event_id || 'event-85th-anniversary')}, ${sqlEscape(t.member_name)}, ${sqlEscape(t.batch_name)}, ${sqlEscape(t.batch_name_bn)}, ${sqlEscape(t.status || 'active')}, ${sqlEscape(t.checked_in || false)}, ${sqlEscape(t.checked_in_at)}, ${sqlEscape(t.created_at || timestamp)}) ON CONFLICT (id) DO NOTHING;`
        );
      }
    }
    lines.push('\n');

    // 7. TABLE: offline_centers (Authorized Registration Booths)
    lines.push(`-- ------------------------------------------------------------`);
    lines.push(`-- 7. TABLE: offline_centers (Authorized Registration Booths)`);
    lines.push(`-- ------------------------------------------------------------`);
    if (isMySQL) {
      lines.push(`CREATE TABLE IF NOT EXISTS \`offline_centers\` (`);
      lines.push(`  \`id\` VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  \`name_en\` VARCHAR(255) NOT NULL,`);
      lines.push(`  \`name_bn\` VARCHAR(255) NOT NULL,`);
      lines.push(`  \`address_en\` TEXT,`);
      lines.push(`  \`address_bn\` TEXT,`);
      lines.push(`  \`phone\` VARCHAR(50) NOT NULL,`);
      lines.push(`  \`contact_person\` VARCHAR(255),`);
      lines.push(`  \`timings\` VARCHAR(255),`);
      lines.push(`  \`map_url\` TEXT,`);
      lines.push(`  \`order_index\` INT DEFAULT 1,`);
      lines.push(`  \`is_active\` BOOLEAN DEFAULT TRUE,`);
      lines.push(`  \`is_trashed\` BOOLEAN DEFAULT FALSE,`);
      lines.push(`  \`deleted_at\` TIMESTAMP NULL,`);
      lines.push(`  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);
    } else {
      lines.push(`CREATE TABLE IF NOT EXISTS offline_centers (`);
      lines.push(`  id VARCHAR(100) PRIMARY KEY,`);
      lines.push(`  name_en VARCHAR(255) NOT NULL,`);
      lines.push(`  name_bn VARCHAR(255) NOT NULL,`);
      lines.push(`  address_en TEXT,`);
      lines.push(`  address_bn TEXT,`);
      lines.push(`  phone VARCHAR(50) NOT NULL,`);
      lines.push(`  contact_person VARCHAR(255),`);
      lines.push(`  timings VARCHAR(255),`);
      lines.push(`  map_url TEXT,`);
      lines.push(`  order_index INT DEFAULT 1,`);
      lines.push(`  is_active BOOLEAN DEFAULT TRUE,`);
      lines.push(`  is_trashed BOOLEAN DEFAULT FALSE,`);
      lines.push(`  deleted_at TIMESTAMP NULL,`);
      lines.push(`  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      lines.push(`);\n`);
    }

    const booths = this.data.offline_centers || [];
    for (const b of booths) {
      if (isMySQL) {
        lines.push(
          `INSERT INTO \`offline_centers\` (\`id\`, \`name_en\`, \`name_bn\`, \`address_en\`, \`address_bn\`, \`phone\`, \`contact_person\`, \`timings\`, \`map_url\`, \`order_index\`, \`is_active\`, \`is_trashed\`) VALUES (${sqlEscape(b.id)}, ${sqlEscape(b.name_en)}, ${sqlEscape(b.name_bn)}, ${sqlEscape(b.address_en)}, ${sqlEscape(b.address_bn)}, ${sqlEscape(b.phone)}, ${sqlEscape(b.contact_person)}, ${sqlEscape(b.timings)}, ${sqlEscape(b.map_url)}, ${b.order_index || 1}, ${b.is_active !== false}, ${b.is_trashed === true}) ON DUPLICATE KEY UPDATE \`name_en\` = VALUES(\`name_en\`);`
        );
      } else {
        lines.push(
          `INSERT INTO offline_centers (id, name_en, name_bn, address_en, address_bn, phone, contact_person, timings, map_url, order_index, is_active, is_trashed) VALUES (${sqlEscape(b.id)}, ${sqlEscape(b.name_en)}, ${sqlEscape(b.name_bn)}, ${sqlEscape(b.address_en)}, ${sqlEscape(b.address_bn)}, ${sqlEscape(b.phone)}, ${sqlEscape(b.contact_person)}, ${sqlEscape(b.timings)}, ${sqlEscape(b.map_url)}, ${b.order_index || 1}, ${b.is_active !== false}, ${b.is_trashed === true}) ON CONFLICT (id) DO NOTHING;`
        );
      }
    }
    lines.push('\n');

    if (isMySQL) {
      lines.push(`SET FOREIGN_KEY_CHECKS=1;`);
    }
    lines.push(`-- End of Backup Dump (${isMySQL ? 'cPanel MySQL' : 'Cloud SQL / PostgreSQL'})`);
    return lines.join('\n');
  }
}

export const db = new DatabaseEngine();
export { portableDb } from './db/portableDb';

