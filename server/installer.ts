import fs from 'fs';
import path from 'path';
import { Pool as PgPool } from 'pg';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { portableDb } from './db/portableDb';
import { updateDatabaseConfig, getDatabaseConfig, DatabaseConfiguration } from './db/config';
import { User, SiteSettings, PaymentGatewayConfig } from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const INSTALLED_FILE = path.join(DATA_DIR, 'installed.json');

export interface InstallPayload {
  // Database Configuration
  database: {
    driver: 'supabase' | 'mysql' | 'local';
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    connectionString?: string;
  };
  // Super Admin Account
  admin: {
    name: string;
    email: string;
    phone: string;
    password: string;
  };
  // Website Information
  site: {
    site_name: string;
    site_url: string;
    site_email: string;
    default_language: 'en' | 'bn';
    event_title?: string;
    event_date?: string;
    venue?: string;
    fee_amount?: number;
    currency?: string;
  };
  // Manual bKash / Nagad Configuration
  payments?: {
    bkash_enabled: boolean;
    bkash_number: string;
    bkash_type: string;
    nagad_enabled: boolean;
    nagad_number: string;
    nagad_type: string;
    instructions_en?: string;
    instructions_bn?: string;
  };
}

export class InstallerService {
  /**
   * Check if the platform is installed and if database connection is valid
   */
  static getStatus(): {
    is_installed: boolean;
    database_connected: boolean;
    driver: string;
    site_name: string;
    site_url: string;
    installed_at?: string;
    db_error?: string;
  } {
    let isInstalled = false;
    let installedData: any = {};

    if (fs.existsSync(INSTALLED_FILE)) {
      try {
        const raw = fs.readFileSync(INSTALLED_FILE, 'utf-8');
        installedData = JSON.parse(raw);
        isInstalled = installedData.is_installed === true;
      } catch (err) {
        isInstalled = false;
      }
    }

    const portableStatus = portableDb.getStatus();
    const siteSettings = (db.get('settings') || db.get('global_settings') || {}) as any;

    // Permanent installation recovery: Check if already configured via DB or super_admin
    if (!isInstalled) {
      const users = db.get('users') || [];
      const hasSuperAdmin = users.some(u => u.role === 'super_admin');
      const hasConfiguredDb = Boolean(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_DATABASE));

      if (hasSuperAdmin || (hasConfiguredDb && portableStatus.isConnected)) {
        isInstalled = true;
        installedData = {
          is_installed: true,
          installed_at: new Date().toISOString(),
          driver: portableStatus.driver,
          site_name: siteSettings?.site_name_en || 'Nanupur Abu Sobhan High School Alumni Association',
          site_url: siteSettings?.site_url || 'https://nanupuralumni.org',
          admin_email: users.find(u => u.role === 'super_admin')?.email || 'admin@nanupuralumni.org',
          version: '2.0.0-PROD',
        };

        try {
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
          }
          fs.writeFileSync(INSTALLED_FILE, JSON.stringify(installedData, null, 2), 'utf-8');
        } catch (fErr) {
          console.warn('Could not write installed.json recovery file:', fErr);
        }
      }
    }

    return {
      is_installed: isInstalled,
      database_connected: portableStatus.isConnected,
      driver: portableStatus.driver,
      site_name: siteSettings?.association_name_en || siteSettings?.site_name_en || installedData?.site_name || 'Nanupur Abu Sobhan High School Alumni Association',
      site_url: siteSettings?.site_url || installedData?.site_url || 'https://nanupuralumni.org',
      installed_at: installedData?.installed_at,
      db_error: portableStatus.lastError || undefined,
    };
  }

  /**
   * Test database connectivity before installation
   */
  static async testConnection(dbConfig: {
    driver: 'supabase' | 'mysql' | 'local';
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    connectionString?: string;
  }): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    if (dbConfig.driver === 'local') {
      return {
        success: true,
        message: 'Resilient high-performance local database store is verified and ready.',
        details: { type: 'Local JSON / Embedded Database Engine' },
      };
    }

    if (dbConfig.driver === 'mysql') {
      try {
        const host = dbConfig.host || 'localhost';
        const port = Number(dbConfig.port) || 3306;
        const database = dbConfig.database || 'alumni_platform';
        const user = dbConfig.username || 'root';
        const password = dbConfig.password || '';

        const conn = await mysql.createConnection({
          host,
          port,
          user,
          password,
          database,
          connectTimeout: 5000,
        });

        const [rows]: any = await conn.query('SELECT 1 as test_val, VERSION() as version, DATABASE() as db_name');
        await conn.end();

        return {
          success: true,
          message: `Successfully connected to MySQL/MariaDB database "${database}" on ${host}:${port}`,
          details: {
            server_version: rows[0]?.version || 'MySQL 8.0+',
            database: rows[0]?.db_name || database,
            host: `${host}:${port}`,
          },
        };
      } catch (err: any) {
        return {
          success: false,
          message: `cPanel MySQL connection failed: ${err.message}`,
        };
      }
    }

    if (dbConfig.driver === 'supabase') {
      try {
        let connString = dbConfig.connectionString;
        if (!connString && dbConfig.host) {
          const user = encodeURIComponent(dbConfig.username || 'postgres');
          const pass = encodeURIComponent(dbConfig.password || '');
          const host = dbConfig.host;
          const port = dbConfig.port || 5432;
          const dbName = dbConfig.database || 'postgres';
          connString = `postgresql://${user}:${pass}@${host}:${port}/${dbName}`;
        }

        if (!connString) {
          return {
            success: false,
            message: 'Supabase/PostgreSQL connection string or host details are required.',
          };
        }

        const pool = new PgPool({
          connectionString: connString,
          ssl: dbConfig.ssl !== false ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 6000,
        });

        const client = await pool.connect();
        const res = await client.query('SELECT 1 as test_val, version() as version, current_database() as db_name');
        client.release();
        await pool.end();

        return {
          success: true,
          message: `Successfully connected to Supabase PostgreSQL database "${res.rows[0]?.db_name || 'postgres'}".`,
          details: {
            server_version: res.rows[0]?.version?.split(' ')?.[0] || 'PostgreSQL 15+',
            database: res.rows[0]?.db_name,
          },
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Supabase PostgreSQL connection failed: ${err.message}`,
        };
      }
    }

    return {
      success: false,
      message: `Unsupported database driver: ${dbConfig.driver}`,
    };
  }

  /**
   * Execute the installation wizard process
   */
  static async install(payload: InstallPayload): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    // 1. Verify connection first
    const testResult = await this.testConnection(payload.database);
    if (!testResult.success) {
      throw new Error(`Database connection check failed: ${testResult.message}`);
    }

    // 2. Configure and save database configuration
    const dbConfigUpdate: DatabaseConfiguration = {
      driver: payload.database.driver,
    };

    if (payload.database.driver === 'mysql') {
      dbConfigUpdate.mysql = {
        host: payload.database.host || 'localhost',
        port: Number(payload.database.port) || 3306,
        database: payload.database.database || 'alumni_platform',
        user: payload.database.username || 'root',
        password: payload.database.password || '',
        charset: 'utf8mb4',
      };
    } else if (payload.database.driver === 'supabase') {
      let connString = payload.database.connectionString;
      if (!connString && payload.database.host) {
        const user = encodeURIComponent(payload.database.username || 'postgres');
        const pass = encodeURIComponent(payload.database.password || '');
        const host = payload.database.host;
        const port = payload.database.port || 5432;
        const dbName = payload.database.database || 'postgres';
        connString = `postgresql://${user}:${pass}@${host}:${port}/${dbName}`;
      }
      dbConfigUpdate.postgres = {
        connectionString: connString || '',
      };
    }

    updateDatabaseConfig(dbConfigUpdate);

    // 3. Create or update Super Admin Account
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(payload.admin.password, salt);

    const users = db.get('users') || [];
    const existingAdminIndex = users.findIndex(u => u.role === 'super_admin' || u.email === payload.admin.email);

    const adminUser: User & { password_hash: string } = {
      id: existingAdminIndex !== -1 ? users[existingAdminIndex].id : `usr-superadmin-${Date.now()}`,
      username: (payload.admin.email || '').split('@')[0].toLowerCase() || 'superadmin',
      name: payload.admin.name || 'Super Administrator',
      email: payload.admin.email,
      phone: payload.admin.phone || '01819123456',
      role: 'super_admin',
      status: 'active',
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
    };

    if (existingAdminIndex !== -1) {
      users[existingAdminIndex] = adminUser;
    } else {
      users.unshift(adminUser);
    }
    db.set('users', users);

    // 4. Update Site Settings & Information
    const currentSettings = db.get('settings') || ({} as any);
    const updatedSettings: SiteSettings = {
      ...currentSettings,
      site_name_en: payload.site.site_name || 'Nanupur Abu Sobhan High School Alumni Platform',
      site_name_bn: 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাক্তন ছাত্র-ছাত্রী সমিতি',
      contact_email: payload.site.site_email || 'info@nashalumni.org',
      registration_fee: Number(payload.site.fee_amount) || 1000,
      currency: payload.site.currency || 'BDT',
      registration_open: true,
      registration_deadline: '2026-12-31',
      default_language: payload.site.default_language || 'en',
    };
    db.set('settings', updatedSettings);

    // Update global settings as well
    const globalSettings = db.get('global_settings') || ({} as any);
    db.set('global_settings', {
      ...globalSettings,
      site_title_en: payload.site.site_name,
      contact_email: payload.site.site_email,
      default_language: payload.site.default_language || 'en',
    });

    // Update registration fee in registration_config
    const regConfig = db.get('registration_config') || ({} as any);
    regConfig.fee_amount = Number(payload.site.fee_amount) || 1000;
    regConfig.currency = payload.site.currency || 'BDT';
    db.set('registration_config', regConfig);

    // 5. Configure Manual bKash & Nagad Payments
    if (payload.payments) {
      const gateways = db.get('payment_gateways') || [];
      
      // Update bKash gateway
      const bkashIdx = gateways.findIndex(g => g.code === 'bkash');
      const bkashConfig: PaymentGatewayConfig = {
        id: bkashIdx !== -1 ? gateways[bkashIdx].id : 'gw-bkash-manual',
        code: 'bkash',
        name: 'bKash Manual Send Money',
        display_name_en: 'bKash (Manual Transfer / Send Money)',
        display_name_bn: 'বিকাশ (সেন্ড মানি / একাউন্ট পেমেন্ট)',
        is_enabled: payload.payments.bkash_enabled !== false,
        is_test_mode: false,
        currency: payload.site.currency || 'BDT',
        transaction_prefix: 'BK',
        sort_order: 1,
        merchant_id: payload.payments.bkash_number || '01819123456',
        instructions_en: payload.payments.instructions_en || `1. Go to your bKash app or dial *247#\n2. Select 'Send Money' or 'Make Payment'\n3. Enter recipient account: ${payload.payments.bkash_number} (${payload.payments.bkash_type || 'Personal'})\n4. Enter Amount: ৳${payload.site.fee_amount}\n5. Enter Reference: Your Registered Mobile Number\n6. Copy the TrxID and enter it in the confirmation box below.`,
        instructions_bn: payload.payments.instructions_bn || `১. বিকাশ অ্যাপে প্রবেশ করুন অথবা *২৪৭# ডায়াল করুন\n২. 'Send Money' অথবা 'Payment' অপশন নির্বাচন করুন\n৩. প্রাপকের নম্বর দিন: ${payload.payments.bkash_number} (${payload.payments.bkash_type === 'merchant' ? 'মার্চেন্ট' : 'ব্যক্তিগত'})\n৪. টাকার পরিমাণ দিন: ৳${payload.site.fee_amount}\n৫. রেফারেন্সে আপনার মোবাইল নম্বর দিন\n৬. সফল পেমেন্টের পর প্রাপ্ত TrxID টি নিচের বক্সে লিখে নিশ্চিত করুন।`,
        credentials: {
          merchant_number: payload.payments.bkash_number,
          account_type: payload.payments.bkash_type || 'personal',
          manual_mode: true,
        },
      };

      if (bkashIdx !== -1) {
        gateways[bkashIdx] = { ...gateways[bkashIdx], ...bkashConfig };
      } else {
        gateways.push(bkashConfig);
      }

      // Update Nagad gateway
      const nagadIdx = gateways.findIndex(g => g.code === 'nagad');
      const nagadConfig: PaymentGatewayConfig = {
        id: nagadIdx !== -1 ? gateways[nagadIdx].id : 'gw-nagad-manual',
        code: 'nagad',
        name: 'Nagad Manual Send Money',
        display_name_en: 'Nagad (Manual Transfer / Send Money)',
        display_name_bn: 'নগদ (সেন্ড মানি / একাউন্ট পেমেন্ট)',
        is_enabled: payload.payments.nagad_enabled !== false,
        is_test_mode: false,
        currency: payload.site.currency || 'BDT',
        transaction_prefix: 'NG',
        sort_order: 2,
        merchant_id: payload.payments.nagad_number || '01712345678',
        instructions_en: payload.payments.instructions_en || `1. Go to your Nagad app or dial *167#\n2. Select 'Send Money' or 'Payment'\n3. Enter recipient account: ${payload.payments.nagad_number} (${payload.payments.nagad_type || 'Personal'})\n4. Enter Amount: ৳${payload.site.fee_amount}\n5. Enter Reference: Your Registered Mobile Number\n6. Copy the TrxID and enter it in the confirmation box below.`,
        instructions_bn: payload.payments.instructions_bn || `১. নগদ অ্যাপে প্রবেশ করুন অথবা *১৬৭# ডায়াল করুন\n২. 'Send Money' অথবা 'Payment' অপশন নির্বাচন করুন\n৩. প্রাপকের নম্বর দিন: ${payload.payments.nagad_number} (${payload.payments.nagad_type === 'merchant' ? 'মার্চেন্ট' : 'ব্যক্তিগত'})\n৪. টাকার পরিমাণ দিন: ৳${payload.site.fee_amount}\n৫. রেফারেন্সে আপনার মোবাইল নম্বর দিন\n৬. সফল পেমেন্টের পর প্রাপ্ত TrxID টি নিচের বক্সে লিখে নিশ্চিত করুন।`,
        credentials: {
          merchant_number: payload.payments.nagad_number,
          account_type: payload.payments.nagad_type || 'personal',
          manual_mode: true,
        },
      };

      if (nagadIdx !== -1) {
        gateways[nagadIdx] = { ...gateways[nagadIdx], ...nagadConfig };
      } else {
        gateways.push(nagadConfig);
      }

      db.set('payment_gateways', gateways);
    }

    // 6. Record Audit Log
    db.logAudit(
      payload.admin.name || 'Super Admin',
      payload.admin.email,
      'SETUP_WIZARD_COMPLETED',
      'System',
      `First-time installation completed. Database driver: ${payload.database.driver}. Super Admin created. Website configured.`
    );

    // 7. Write installed flag file safely
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const installationInfo = {
      is_installed: true,
      installed_at: new Date().toISOString(),
      driver: payload.database.driver,
      site_name: payload.site.site_name,
      site_url: payload.site.site_url,
      admin_email: payload.admin.email,
      version: '2.0.0-PROD',
    };

    fs.writeFileSync(INSTALLED_FILE, JSON.stringify(installationInfo, null, 2), 'utf-8');

    // Also persist installation flag to persistent database storage
    try {
      await portableDb.saveSetting('app_installed', installationInfo);
      await portableDb.saveSetting('installation_info', installationInfo);
      await db.persistKeyToSupabase('app_installed', installationInfo);
    } catch (dbErr) {
      console.warn('Could not persist app_installed to database setting:', dbErr);
    }

    return {
      success: true,
      message: 'Nanupur Abu Sobhan High School Alumni Platform has been installed and configured successfully!',
      details: {
        admin_email: payload.admin.email,
        driver: payload.database.driver,
      },
    };
  }
}
