import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
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
  initialRegistrationFields,
  initialProgramSchedule,
  initialBatchConfig,
  initialRoles,
  initialUsers,
  initialRegistrations,
  initialTokens,
  initialGates,
} from './seedData';
import { portableDb } from './db/portableDb';

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
  batch_config: BatchConfig;
  roles: CustomRole[];
  users: (User & { password_hash?: string })[];
  registrations: Registration[];
  payments: PaymentTransaction[];
  tokens: EntryToken[];
  audit_logs: AuditLog[];
  program_schedule: ProgramScheduleSectionConfig;
  registration_form_fields: RegistrationFieldConfig[];
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
    const config = this.parsePostgresConfig(process.env.DATABASE_URL);
    if (!config) {
      console.log('No PostgreSQL/Supabase DATABASE_URL configured. Using local JSON store.');
      return;
    }

    try {
      this.pool = new Pool(config);
      const client = await this.pool.connect();
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
      // 1. Check site_settings table
      const res = await this.pool.query('SELECT key, value FROM site_settings');
      if (res.rows && res.rows.length > 0) {
        console.log(`Loaded ${res.rows.length} configuration settings from Supabase.`);
        for (const row of res.rows) {
          if (row.key && row.value !== undefined) {
            (this.data as any)[row.key] = row.value;
          }
        }
        // Update local file cache
        this.saveData();
      } else {
        console.log('Seeding initial dataset into Supabase site_settings...');
        for (const key of Object.keys(this.data) as Array<keyof DatabaseSchema>) {
          await this.persistKeyToSupabase(key, this.data[key]);
        }
      }
    } catch (err: any) {
      console.warn('Error syncing with Supabase:', err.message);
    }
  }

  public async persistKeyToSupabase(key: string, value: any) {
    if (!this.pool || !this.isSupabaseConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO site_settings (key, value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) 
         DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );

      // Dedicated sync for menus
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

      // Dedicated sync for pages
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
          users: (parsed.users || initialUsers).map(u => ({ ...u, status: u.status || 'active' })),
          registrations: parsed.registrations || initialRegistrations,
          payments: parsed.payments || [],
          tokens: parsed.tokens || initialTokens,
          audit_logs: parsed.audit_logs || [],
          program_schedule: parsed.program_schedule || initialProgramSchedule,
          registration_form_fields: parsed.registration_form_fields || initialRegistrationFields,
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
    return this.data[key];
  }

  public set<K extends keyof DatabaseSchema>(key: K, value: DatabaseSchema[K]) {
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
}

export const db = new DatabaseEngine();
export { portableDb } from './db/portableDb';
