import { getDatabaseConfig, DatabaseConfiguration, parsePostgresUrl, ParsedPostgresConfig } from './config';
import { Pool as PgPool } from 'pg';
import mysql from 'mysql2/promise';

export interface DatabaseDriverAdapter {
  type: string;
  isConnected: () => boolean;
  query: (sql: string, params?: any[]) => Promise<any[]>;
  saveSetting: (key: string, value: any) => Promise<void>;
  loadSettings: () => Promise<Record<string, any>>;
  close?: () => Promise<void>;
}

export class PortableDatabaseManager {
  private config: DatabaseConfiguration;
  private pgPool: PgPool | null = null;
  private mysqlPool: mysql.Pool | null = null;
  private activeDriverType: string = 'local';
  private connected: boolean = false;
  private lastError: string | null = null;
  private lastConnectedAt: string | null = null;
  private lastLatencyMs: number | null = null;

  constructor() {
    this.config = getDatabaseConfig();
    this.init();
  }

  public async init() {
    this.config = getDatabaseConfig();

    // 1. MySQL / MariaDB (e.g. cPanel)
    if (this.config.driver === 'mysql' && this.config.mysql) {
      try {
        const start = Date.now();
        this.mysqlPool = mysql.createPool({
          host: this.config.mysql.host,
          port: this.config.mysql.port,
          database: this.config.mysql.database,
          user: this.config.mysql.user,
          password: this.config.mysql.password,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
        });

        const conn = await this.mysqlPool.getConnection();
        await conn.query('SELECT 1');
        conn.release();
        this.lastLatencyMs = Date.now() - start;
        this.activeDriverType = 'mysql';
        this.connected = true;
        this.lastError = null;
        this.lastConnectedAt = new Date().toISOString();
        console.log(`[Database] Connected to cPanel MySQL/MariaDB database "${this.config.mysql.database}" on ${this.config.mysql.host}:${this.config.mysql.port} (${this.lastLatencyMs}ms)`);
        return;
      } catch (err: any) {
        this.lastError = err.message;
        console.warn(`[Database] MySQL connection error (${err.message}).`);
      }
    }

    // 2. Supabase / PostgreSQL
    const connStr = this.config.postgres?.connectionString || process.env.DATABASE_URL;
    if ((this.config.driver === 'supabase' || this.config.driver === 'postgres' || connStr) && connStr) {
      try {
        const start = Date.now();
        const parsed = parsePostgresUrl(connStr);
        if (parsed) {
          this.pgPool = new PgPool({
            user: parsed.user,
            password: parsed.password,
            host: parsed.host,
            port: parsed.port,
            database: parsed.database,
            ssl: parsed.ssl,
            connectionTimeoutMillis: 8000,
            max: 10,
          });
        } else {
          this.pgPool = new PgPool({
            connectionString: connStr,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 8000,
            max: 10,
          });
        }

        const client = await this.pgPool.connect();
        await client.query('SELECT 1');
        client.release();
        this.lastLatencyMs = Date.now() - start;
        this.activeDriverType = 'supabase';
        this.connected = true;
        this.lastError = null;
        this.lastConnectedAt = new Date().toISOString();
        console.log(`[Database] Connected to Supabase PostgreSQL database successfully (${this.lastLatencyMs}ms).`);
        return;
      } catch (err: any) {
        this.lastError = err.message;
        console.warn(`[Database] Supabase PostgreSQL connection error (${err.message}).`);
      }
    }

    // Do NOT silently fall back to local if a remote database was explicitly configured
    if (this.config.driver === 'mysql' || this.config.driver === 'supabase' || this.config.driver === 'postgres') {
      this.activeDriverType = this.config.driver;
      this.connected = false;
      return;
    }

    this.activeDriverType = 'local';
    this.connected = true;
  }

  public async reconnect(): Promise<void> {
    if (this.pgPool) {
      try { await this.pgPool.end(); } catch {}
      this.pgPool = null;
    }
    if (this.mysqlPool) {
      try { await this.mysqlPool.end(); } catch {}
      this.mysqlPool = null;
    }
    this.connected = false;
    await this.init();
  }

  public getStatus() {
    return {
      driver: this.activeDriverType,
      isConnected: this.connected,
      configuredDriver: this.config.driver,
      lastError: this.lastError,
      lastConnectedAt: this.lastConnectedAt,
      latencyMs: this.lastLatencyMs,
      timestamp: new Date().toISOString(),
    };
  }

  public getDiagnosticInfo() {
    const connStr = this.config.postgres?.connectionString || process.env.DATABASE_URL;
    let maskedHost = 'local';
    let dbName = 'local';

    if (this.config.driver === 'mysql' && this.config.mysql) {
      maskedHost = `${this.config.mysql.host}:${this.config.mysql.port}`;
      dbName = this.config.mysql.database;
    } else if (connStr) {
      const parsed = parsePostgresUrl(connStr);
      if (parsed) {
        const hostParts = parsed.host.split('.');
        if (hostParts.length > 2) {
          maskedHost = `${hostParts[0].slice(0, 5)}****.${hostParts.slice(1).join('.')}:${parsed.port}`;
        } else {
          maskedHost = `${parsed.host}:${parsed.port}`;
        }
        dbName = parsed.database;
      }
    }

    return {
      driver: this.activeDriverType,
      configured_driver: this.config.driver,
      is_connected: this.connected && this.activeDriverType !== 'local',
      host: maskedHost,
      database: dbName,
      last_connected_at: this.lastConnectedAt,
      latency_ms: this.lastLatencyMs,
      error: this.lastError,
      ssl_enabled: this.activeDriverType === 'supabase',
    };
  }

  public async testLiveConnection(): Promise<{
    success: boolean;
    driver: string;
    latency_ms?: number;
    error?: string;
    tables?: Record<string, number>;
    server_version?: string;
  }> {
    const start = Date.now();
    try {
      if (this.activeDriverType === 'supabase' && this.pgPool) {
        const client = await this.pgPool.connect();
        const verRes = await client.query('SELECT version()');
        
        // Count rows in main tables
        const tables = ['users', 'batches', 'events', 'event_registrations', 'site_settings', 'notices', 'news_posts'];
        const counts: Record<string, number> = {};
        for (const tbl of tables) {
          try {
            const countRes = await client.query(`SELECT count(*) FROM public.${tbl}`);
            counts[tbl] = parseInt(countRes.rows[0].count, 10);
          } catch {
            counts[tbl] = 0;
          }
        }
        client.release();
        const latency = Date.now() - start;
        this.lastLatencyMs = latency;
        this.lastConnectedAt = new Date().toISOString();
        this.connected = true;
        this.lastError = null;

        return {
          success: true,
          driver: 'supabase',
          latency_ms: latency,
          server_version: verRes.rows[0]?.version ? verRes.rows[0].version.split(' ')[0] + ' ' + verRes.rows[0].version.split(' ')[1] : 'PostgreSQL',
          tables: counts,
        };
      }

      if (this.activeDriverType === 'mysql' && this.mysqlPool) {
        const conn = await this.mysqlPool.getConnection();
        const [verRes]: any = await conn.query('SELECT VERSION() as version');
        const tables = ['users', 'batches', 'events', 'event_registrations', 'site_settings'];
        const counts: Record<string, number> = {};
        for (const tbl of tables) {
          try {
            const [cRes]: any = await conn.query(`SELECT count(*) as c FROM ${tbl}`);
            counts[tbl] = cRes[0]?.c || 0;
          } catch {
            counts[tbl] = 0;
          }
        }
        conn.release();
        const latency = Date.now() - start;
        this.lastLatencyMs = latency;
        this.lastConnectedAt = new Date().toISOString();
        this.connected = true;
        this.lastError = null;

        return {
          success: true,
          driver: 'mysql',
          latency_ms: latency,
          server_version: verRes[0]?.version || 'MySQL',
          tables: counts,
        };
      }

      return {
        success: true,
        driver: 'local',
        latency_ms: 0,
        server_version: 'Embedded Storage Engine',
        tables: {},
      };
    } catch (err: any) {
      this.lastError = err.message;
      return {
        success: false,
        driver: this.activeDriverType,
        latency_ms: Date.now() - start,
        error: err.message,
      };
    }
  }

  public async query(sql: string, params: any[] = []): Promise<any[]> {
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      const [rows] = await this.mysqlPool.execute(sql, params);
      return Array.isArray(rows) ? rows : [];
    }

    if (this.activeDriverType === 'supabase' && this.pgPool) {
      const res = await this.pgPool.query(sql, params);
      return res.rows || [];
    }

    return [];
  }

  public async saveSetting(key: string, value: any): Promise<void> {
    const valString = typeof value === 'string' ? value : JSON.stringify(value);

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      try {
        await this.mysqlPool.execute(
          `INSERT INTO site_settings (\`key\`, \`value\`, \`updated_at\`)
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), \`updated_at\` = NOW()`,
          [key, valString]
        );
      } catch (e: any) {
        console.warn(`[Database] MySQL saveSetting note (${key}):`, e.message);
      }

      // Also persist to settings table
      try {
        await this.mysqlPool.execute(
          `INSERT INTO settings (\`key\`, \`value\`, \`group\`, \`type\`, \`updated_at\`)
           VALUES (?, ?, 'general', 'string', NOW())
           ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), \`updated_at\` = NOW()`,
          [key, valString]
        );
      } catch (e: any) {
        // Ignored if settings table is optional or in progress
      }
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO site_settings (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key)
           DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, valString]
        );
      } catch (e: any) {
        console.warn(`[Database] Supabase saveSetting note (${key}):`, e.message);
      }

      // Also persist to settings table
      try {
        await this.pgPool.query(
          `INSERT INTO settings (key, value, "group", type, updated_at)
           VALUES ($1, $2, 'general', 'string', NOW())
           ON CONFLICT (key)
           DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, valString]
        );
      } catch (e: any) {
        // Ignored if settings table is optional or in progress
      }
    }
  }

  public async saveSettingRecord(
    key: string,
    value: string,
    group: string = 'general',
    type: string = 'string',
    description?: string
  ): Promise<void> {
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      try {
        await this.mysqlPool.execute(
          `INSERT INTO settings (\`key\`, \`value\`, \`group\`, \`type\`, \`description\`, \`updated_at\`)
           VALUES (?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE 
             \`value\` = VALUES(\`value\`),
             \`group\` = VALUES(\`group\`),
             \`type\` = VALUES(\`type\`),
             \`description\` = COALESCE(VALUES(\`description\`), \`description\`),
             \`updated_at\` = NOW()`,
          [key, value, group, type, description || null]
        );
      } catch (e: any) {
        console.warn(`[Database] MySQL saveSettingRecord error (${key}):`, e.message);
      }
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO settings (key, value, "group", type, description, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (key)
           DO UPDATE SET 
             value = $2,
             "group" = $3,
             type = $4,
             description = COALESCE($5, settings.description),
             updated_at = NOW()`,
          [key, value, group, type, description || null]
        );
      } catch (e: any) {
        console.warn(`[Database] Supabase saveSettingRecord error (${key}):`, e.message);
      }
    }
  }

  public async loadSettingsRecords(): Promise<any[]> {
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      try {
        const [rows]: any = await this.mysqlPool.execute(
          'SELECT id, `key`, `value`, `group`, `type`, `description`, created_at, updated_at FROM settings ORDER BY id ASC'
        );
        return rows || [];
      } catch (e: any) {
        console.warn('[Database] MySQL loadSettingsRecords error:', e.message);
      }
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      try {
        const res = await this.pgPool.query(
          'SELECT id, key, value, "group", type, description, created_at, updated_at FROM settings ORDER BY id ASC'
        );
        return res.rows || [];
      } catch (e: any) {
        console.warn('[Database] Supabase loadSettingsRecords error:', e.message);
      }
    }
    return [];
  }


  public async loadSettings(): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      try {
        const [rows]: any = await this.mysqlPool.execute('SELECT `key`, `value` FROM site_settings');
        for (const r of rows) {
          try {
            result[r.key] = JSON.parse(r.value);
          } catch {
            result[r.key] = r.value;
          }
        }
      } catch (e: any) {
        console.warn('[Database] MySQL loadSettings note:', e.message);
      }
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT key, value FROM site_settings');
        for (const r of res.rows) {
          try {
            result[r.key] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
          } catch {
            result[r.key] = r.value;
          }
        }
      } catch (e: any) {
        console.warn('[Database] Supabase loadSettings note:', e.message);
      }
    }

    return result;
  }

  // =========================================================================
  // ENTITY CRUD PERSISTENCE METHODS (SINGLE AUTHORITATIVE SOURCE OF TRUTH)
  // =========================================================================

  /**
   * Persist User to configured database
   */
  public async saveUser(u: any): Promise<void> {
    if (!u || !u.id) return;

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute(
        `INSERT INTO users (
          id, username, name, name_bn, email, phone, password_hash, role, status,
          passing_year, batch, dob, gender, blood_group, photo_url,
          occupation, organization, designation, work_location,
          business_name, business_type, business_address, business_website,
          address, bio, privacy, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          username = VALUES(username), name = VALUES(name), name_bn = VALUES(name_bn),
          email = VALUES(email), phone = VALUES(phone),
          password_hash = COALESCE(NULLIF(VALUES(password_hash), ''), password_hash),
          role = VALUES(role), status = VALUES(status), passing_year = VALUES(passing_year),
          batch = VALUES(batch), dob = VALUES(dob), gender = VALUES(gender),
          blood_group = VALUES(blood_group), photo_url = VALUES(photo_url),
          occupation = VALUES(occupation), organization = VALUES(organization),
          designation = VALUES(designation), work_location = VALUES(work_location),
          business_name = VALUES(business_name), business_type = VALUES(business_type),
          business_address = VALUES(business_address), business_website = VALUES(business_website),
          address = VALUES(address), bio = VALUES(bio), privacy = VALUES(privacy),
          updated_at = NOW()`,
        [
          u.id, u.username || '', u.name, u.name_bn || '', u.email || '', u.phone || '',
          u.password_hash || '', u.role || 'alumni_member', u.status || 'active',
          u.passing_year || null, u.batch || '', u.dob || '', u.gender || '',
          u.blood_group || '', u.photo_url || '', u.occupation || '', u.organization || '',
          u.designation || '', u.work_location || '', u.business_name || '', u.business_type || '',
          u.business_address || '', u.business_website || '', u.address || '', u.bio || '',
          u.privacy ? JSON.stringify(u.privacy) : null,
        ]
      );
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO users (
          id, username, name, name_bn, email, phone, password_hash, role, status,
          passing_year, batch, dob, gender, blood_group, photo_url,
          occupation, organization, designation, work_location,
          business_name, business_type, business_address, business_website,
          address, bio, privacy, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username, name = EXCLUDED.name, name_bn = EXCLUDED.name_bn,
          email = EXCLUDED.email, phone = EXCLUDED.phone,
          password_hash = COALESCE(NULLIF(EXCLUDED.password_hash, ''), users.password_hash),
          role = EXCLUDED.role, status = EXCLUDED.status, passing_year = EXCLUDED.passing_year,
          batch = EXCLUDED.batch, dob = EXCLUDED.dob, gender = EXCLUDED.gender,
          blood_group = EXCLUDED.blood_group, photo_url = EXCLUDED.photo_url,
          occupation = EXCLUDED.occupation, organization = EXCLUDED.organization,
          designation = EXCLUDED.designation, work_location = EXCLUDED.work_location,
          business_name = EXCLUDED.business_name, business_type = EXCLUDED.business_type,
          business_address = EXCLUDED.business_address, business_website = EXCLUDED.business_website,
          address = EXCLUDED.address, bio = EXCLUDED.bio, privacy = EXCLUDED.privacy,
          updated_at = NOW()`,
        [
          u.id, u.username || '', u.name, u.name_bn || '', u.email || '', u.phone || '',
          u.password_hash || '', u.role || 'alumni_member', u.status || 'active',
          u.passing_year || null, u.batch || '', u.dob || '', u.gender || '',
          u.blood_group || '', u.photo_url || '', u.occupation || '', u.organization || '',
          u.designation || '', u.work_location || '', u.business_name || '', u.business_type || '',
          u.business_address || '', u.business_website || '', u.address || '', u.bio || '',
          u.privacy ? JSON.stringify(u.privacy) : null,
        ]
      );
    }
  }

  /**
   * Delete User from configured database
   */
  public async deleteUser(id: string): Promise<void> {
    if (!id) return;
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute('DELETE FROM users WHERE id = ?', [id]);
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query('DELETE FROM users WHERE id = $1', [id]);
    }
  }

  /**
   * Persist Registration to configured database
   */
  public async saveRegistration(r: any): Promise<void> {
    if (!r || !r.id) return;

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute(
        `INSERT INTO registrations (
          id, event_id, user_id, full_name, dob, gender, blood_group, t_shirt_size,
          phone, email, address, occupation, passing_year, batch_id, batch_name, batch_name_bn,
          fee_amount, currency, payment_status, payment_method, notes, registration_status,
          token_id, token_code, qr_code_svg, photo_url, checked_in, checked_in_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          event_id = VALUES(event_id), user_id = VALUES(user_id),
          full_name = VALUES(full_name), dob = VALUES(dob), gender = VALUES(gender),
          blood_group = VALUES(blood_group), t_shirt_size = VALUES(t_shirt_size),
          phone = VALUES(phone), email = VALUES(email), address = VALUES(address),
          occupation = VALUES(occupation), passing_year = VALUES(passing_year),
          batch_id = VALUES(batch_id), batch_name = VALUES(batch_name), batch_name_bn = VALUES(batch_name_bn),
          fee_amount = VALUES(fee_amount), currency = VALUES(currency),
          payment_status = VALUES(payment_status), payment_method = VALUES(payment_method),
          notes = VALUES(notes), registration_status = VALUES(registration_status),
          token_id = VALUES(token_id), token_code = VALUES(token_code),
          qr_code_svg = VALUES(qr_code_svg), photo_url = VALUES(photo_url),
          checked_in = VALUES(checked_in), checked_in_at = VALUES(checked_in_at),
          updated_at = NOW()`,
        [
          r.id, r.event_id || 'event-85th-anniversary', r.user_id || null, r.full_name,
          r.dob || '1990-01-01', r.gender || 'male', r.blood_group || null, r.t_shirt_size || null,
          r.phone, r.email || null, r.address || null, r.occupation || null,
          r.passing_year || 2008, r.batch_id || null, r.batch_name || '', r.batch_name_bn || '',
          r.fee_amount || 1000, r.currency || 'BDT', r.payment_status || 'pending',
          r.payment_method || 'bKash', r.notes || null, r.registration_status || 'pending',
          r.token_id || null, r.token_code || null, r.qr_code_svg || null, r.photo_url || null,
          r.checked_in ? 1 : 0, r.checked_in_at || null,
        ]
      );
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO event_registrations (
          id, event_id, user_id, full_name, dob, gender, blood_group, t_shirt_size,
          phone, email, address, occupation, passing_year, batch_id, batch_name, batch_name_bn,
          fee_amount, currency, payment_status, payment_method, notes, registration_status,
          token_id, token_code, qr_code_svg, photo_url, checked_in, checked_in_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          event_id = EXCLUDED.event_id, user_id = EXCLUDED.user_id,
          full_name = EXCLUDED.full_name, dob = EXCLUDED.dob, gender = EXCLUDED.gender,
          blood_group = EXCLUDED.blood_group, t_shirt_size = EXCLUDED.t_shirt_size,
          phone = EXCLUDED.phone, email = EXCLUDED.email, address = EXCLUDED.address,
          occupation = EXCLUDED.occupation, passing_year = EXCLUDED.passing_year,
          batch_id = EXCLUDED.batch_id, batch_name = EXCLUDED.batch_name, batch_name_bn = EXCLUDED.batch_name_bn,
          fee_amount = EXCLUDED.fee_amount, currency = EXCLUDED.currency,
          payment_status = EXCLUDED.payment_status, payment_method = EXCLUDED.payment_method,
          notes = EXCLUDED.notes, registration_status = EXCLUDED.registration_status,
          token_id = EXCLUDED.token_id, token_code = EXCLUDED.token_code,
          qr_code_svg = EXCLUDED.qr_code_svg, photo_url = EXCLUDED.photo_url,
          checked_in = EXCLUDED.checked_in, checked_in_at = EXCLUDED.checked_in_at,
          updated_at = NOW()`,
        [
          r.id, r.event_id || 'event-85th-anniversary', r.user_id || null, r.full_name,
          r.dob || '1990-01-01', r.gender || 'male', r.blood_group || null, r.t_shirt_size || null,
          r.phone, r.email || null, r.address || null, r.occupation || null,
          r.passing_year || 2008, r.batch_id || null, r.batch_name || '', r.batch_name_bn || '',
          r.fee_amount || 1000, r.currency || 'BDT', r.payment_status || 'pending',
          r.payment_method || 'bKash', r.notes || null, r.registration_status || 'pending',
          r.token_id || null, r.token_code || null, r.qr_code_svg || null, r.photo_url || null,
          Boolean(r.checked_in), r.checked_in_at || null,
        ]
      );
    }
  }

  /**
   * Delete Registration from configured database
   */
  public async deleteRegistration(id: string): Promise<void> {
    if (!id) return;
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute('DELETE FROM payments WHERE registration_id = ?', [id]).catch(() => {});
      await this.mysqlPool.execute('DELETE FROM tokens WHERE registration_id = ?', [id]).catch(() => {});
      await this.mysqlPool.execute('DELETE FROM registrations WHERE id = ?', [id]);
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query('DELETE FROM payment_transactions WHERE registration_id = $1', [id]).catch(() => {});
      await this.pgPool.query('DELETE FROM entry_tokens WHERE registration_id = $1', [id]).catch(() => {});
      await this.pgPool.query('DELETE FROM event_registrations WHERE id = $1', [id]);
    }
  }

  /**
   * Persist Payment to configured database
   */
  public async savePayment(p: any): Promise<void> {
    if (!p || !p.id) return;

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute(
        `INSERT INTO payments (
          id, registration_id, transaction_id, gateway, method, amount, currency, status,
          gateway_ref, gateway_response, failure_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          registration_id = VALUES(registration_id), transaction_id = VALUES(transaction_id),
          gateway = VALUES(gateway), method = VALUES(method), amount = VALUES(amount),
          currency = VALUES(currency), status = VALUES(status), gateway_ref = VALUES(gateway_ref),
          gateway_response = VALUES(gateway_response), failure_reason = VALUES(failure_reason)`,
        [
          p.id, p.registration_id, p.transaction_id || `TRX-${Date.now()}`, p.gateway || 'bkash',
          p.method || 'Manual Payment', Number(p.amount) || 1000, p.currency || 'BDT',
          p.status || 'pending', p.gateway_ref || null,
          p.gateway_response ? JSON.stringify(p.gateway_response) : null,
          p.failure_reason || null,
        ]
      );
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO payment_transactions (
          id, registration_id, transaction_id, gateway, method, amount, currency, status,
          sender_mobile, token_code, verified_by, notes, verified_at,
          gateway_ref, gateway_response, failure_reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        ON CONFLICT (id) DO UPDATE SET
          registration_id = EXCLUDED.registration_id, transaction_id = EXCLUDED.transaction_id,
          gateway = EXCLUDED.gateway, method = EXCLUDED.method, amount = EXCLUDED.amount,
          currency = EXCLUDED.currency, status = EXCLUDED.status,
          sender_mobile = EXCLUDED.sender_mobile, token_code = EXCLUDED.token_code,
          verified_by = EXCLUDED.verified_by, notes = EXCLUDED.notes, verified_at = EXCLUDED.verified_at,
          gateway_ref = EXCLUDED.gateway_ref, gateway_response = EXCLUDED.gateway_response,
          failure_reason = EXCLUDED.failure_reason`,
        [
          p.id, p.registration_id, p.transaction_id || `TRX-${Date.now()}`, p.gateway || 'bkash',
          p.method || 'Manual Payment', Number(p.amount) || 1000, p.currency || 'BDT',
          p.status || 'pending', p.sender_mobile || null, p.token_code || null,
          p.verified_by || null, p.notes || null,
          p.verified_at ? new Date(p.verified_at).toISOString() : null,
          p.gateway_ref || null, p.gateway_response ? JSON.stringify(p.gateway_response) : null,
          p.failure_reason || null,
        ]
      );
    }
  }

  /**
   * Delete Payment from configured database
   */
  public async deletePayment(id: string): Promise<void> {
    if (!id) return;
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute('DELETE FROM payments WHERE id = ?', [id]);
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query('DELETE FROM payment_transactions WHERE id = $1', [id]);
    }
  }

  /**
   * Persist Entry Token to configured database
   */
  public async saveToken(t: any): Promise<void> {
    if (!t || !t.id) return;

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute(
        `INSERT INTO tokens (
          id, token_code, registration_id, event_id, member_name, batch_name, batch_name_bn,
          status, qr_code_svg, checked_in, checked_in_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          token_code = VALUES(token_code), registration_id = VALUES(registration_id),
          member_name = VALUES(member_name), batch_name = VALUES(batch_name),
          batch_name_bn = VALUES(batch_name_bn), status = VALUES(status),
          qr_code_svg = VALUES(qr_code_svg), checked_in = VALUES(checked_in),
          checked_in_at = VALUES(checked_in_at)`,
        [
          t.id, t.token_code, t.registration_id, t.event_id || 'event-85th-anniversary',
          t.member_name, t.batch_name, t.batch_name_bn || null, t.status || 'active',
          t.qr_code_svg || '', t.checked_in ? 1 : 0, t.checked_in_at || null,
        ]
      );
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO entry_tokens (
          id, token_code, registration_id, event_id, member_name, batch_name, batch_name_bn,
          status, qr_code_svg, checked_in, checked_in_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (id) DO UPDATE SET
          token_code = EXCLUDED.token_code, registration_id = EXCLUDED.registration_id,
          member_name = EXCLUDED.member_name, batch_name = EXCLUDED.batch_name,
          batch_name_bn = EXCLUDED.batch_name_bn, status = EXCLUDED.status,
          qr_code_svg = EXCLUDED.qr_code_svg, checked_in = EXCLUDED.checked_in,
          checked_in_at = EXCLUDED.checked_in_at`,
        [
          t.id, t.token_code, t.registration_id, t.event_id || 'event-85th-anniversary',
          t.member_name, t.batch_name, t.batch_name_bn || null, t.status || 'active',
          t.qr_code_svg || '', Boolean(t.checked_in), t.checked_in_at || null,
        ]
      );
    }
  }

  /**
   * Delete Token from configured database
   */
  public async deleteToken(id: string): Promise<void> {
    if (!id) return;
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute('DELETE FROM tokens WHERE id = ? OR token_code = ?', [id, id]);
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query('DELETE FROM entry_tokens WHERE id = $1 OR token_code = $1', [id]);
    }
  }

  /**
   * Persist CMS Page to configured database
   */
  public async savePage(p: any): Promise<void> {
    if (!p || !p.id) return;

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute(
        `INSERT INTO pages (
          id, slug, title_en, title_bn, content_en, content_bn, status,
          sections, featured_image, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          slug = VALUES(slug), title_en = VALUES(title_en), title_bn = VALUES(title_bn),
          content_en = VALUES(content_en), content_bn = VALUES(content_bn),
          status = VALUES(status), sections = VALUES(sections),
          featured_image = VALUES(featured_image), updated_at = NOW()`,
        [
          p.id, p.slug, p.title_en || '', p.title_bn || '', p.content_en || null,
          p.content_bn || null, p.status || 'published',
          p.sections ? JSON.stringify(p.sections) : null,
          p.featured_image || null,
        ]
      );
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO pages (
          id, slug, title_en, title_bn, content_en, content_bn, status,
          sections, featured_image, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug, title_en = EXCLUDED.title_en, title_bn = EXCLUDED.title_bn,
          content_en = EXCLUDED.content_en, content_bn = EXCLUDED.content_bn,
          status = EXCLUDED.status, sections = EXCLUDED.sections,
          featured_image = EXCLUDED.featured_image, updated_at = NOW()`,
        [
          p.id, p.slug, p.title_en || '', p.title_bn || '', p.content_en || null,
          p.content_bn || null, p.status || 'published',
          p.sections ? JSON.stringify(p.sections) : null,
          p.featured_image || null,
        ]
      );
    }
  }

  /**
   * Delete CMS Page from configured database
   */
  public async deletePage(id: string): Promise<void> {
    if (!id) return;
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute('DELETE FROM pages WHERE id = ? OR slug = ?', [id, id]);
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query('DELETE FROM pages WHERE id = $1 OR slug = $1', [id]);
    }
  }

  /**
   * Persist News Post to configured database
   */
  public async saveNews(nw: any): Promise<void> {
    if (!nw || !nw.id) return;

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute(
        `INSERT INTO news_posts (
          id, slug, title_en, title_bn, content_en, content_bn, category,
          featured_image, author, publish_date, is_published, views, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          slug = VALUES(slug), title_en = VALUES(title_en), title_bn = VALUES(title_bn),
          content_en = VALUES(content_en), content_bn = VALUES(content_bn),
          category = VALUES(category), featured_image = VALUES(featured_image),
          author = VALUES(author), publish_date = VALUES(publish_date),
          is_published = VALUES(is_published), views = VALUES(views)`,
        [
          nw.id, nw.slug, nw.title_en, nw.title_bn, nw.content_en, nw.content_bn,
          nw.category || 'General', nw.featured_image || null, nw.author || null,
          nw.publish_date || '2026-01-01', nw.is_published !== false ? 1 : 0, nw.views || 0,
        ]
      );
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO news_posts (
          id, slug, title_en, title_bn, content_en, content_bn, category,
          featured_image, author, publish_date, is_published, views, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug, title_en = EXCLUDED.title_en, title_bn = EXCLUDED.title_bn,
          content_en = EXCLUDED.content_en, content_bn = EXCLUDED.content_bn,
          category = EXCLUDED.category, featured_image = EXCLUDED.featured_image,
          author = EXCLUDED.author, publish_date = EXCLUDED.publish_date,
          is_published = EXCLUDED.is_published, views = EXCLUDED.views`,
        [
          nw.id, nw.slug, nw.title_en, nw.title_bn, nw.content_en, nw.content_bn,
          nw.category || 'General', nw.featured_image || null, nw.author || null,
          nw.publish_date || '2026-01-01', nw.is_published !== false, nw.views || 0,
        ]
      );
    }
  }

  /**
   * Delete News Post from configured database
   */
  public async deleteNews(id: string): Promise<void> {
    if (!id) return;
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute('DELETE FROM news_posts WHERE id = ? OR slug = ?', [id, id]);
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query('DELETE FROM news_posts WHERE id = $1 OR slug = $1', [id]);
    }
  }

  /**
   * Persist Notice to configured database
   */
  public async saveNotice(n: any): Promise<void> {
    if (!n || !n.id) return;

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute(
        `INSERT INTO notices (
          id, title_en, title_bn, content_en, content_bn, publish_date,
          expiry_date, is_featured, is_active, attachment_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          title_en = VALUES(title_en), title_bn = VALUES(title_bn),
          content_en = VALUES(content_en), content_bn = VALUES(content_bn),
          publish_date = VALUES(publish_date), expiry_date = VALUES(expiry_date),
          is_featured = VALUES(is_featured), is_active = VALUES(is_active),
          attachment_url = VALUES(attachment_url)`,
        [
          n.id, n.title_en, n.title_bn, n.content_en, n.content_bn,
          n.publish_date || '2026-01-01', n.expiry_date || null,
          n.is_featured ? 1 : 0, n.is_active !== false ? 1 : 0,
          n.attachment_url || null,
        ]
      );
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO notices (
          id, title_en, title_bn, content_en, content_bn, publish_date,
          expiry_date, is_featured, is_active, attachment_url, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title_en = EXCLUDED.title_en, title_bn = EXCLUDED.title_bn,
          content_en = EXCLUDED.content_en, content_bn = EXCLUDED.content_bn,
          publish_date = EXCLUDED.publish_date, expiry_date = EXCLUDED.expiry_date,
          is_featured = EXCLUDED.is_featured, is_active = EXCLUDED.is_active,
          attachment_url = EXCLUDED.attachment_url`,
        [
          n.id, n.title_en, n.title_bn, n.content_en, n.content_bn,
          n.publish_date || '2026-01-01', n.expiry_date || null,
          Boolean(n.is_featured), n.is_active !== false,
          n.attachment_url || null,
        ]
      );
    }
  }

  /**
   * Delete Notice from configured database
   */
  public async deleteNotice(id: string): Promise<void> {
    if (!id) return;
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute('DELETE FROM notices WHERE id = ?', [id]);
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query('DELETE FROM notices WHERE id = $1', [id]);
    }
  }

  /**
   * Persist Committee Member to configured database
   */
  public async saveCommitteeMember(cm: any): Promise<void> {
    if (!cm || !cm.id) return;

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute(
        `INSERT INTO committee_members (
          id, committee_id, user_id, name_en, name_bn, designation_en, designation_bn,
          batch_year, photo_url, phone, email, tenure, order_index, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          committee_id = VALUES(committee_id), user_id = VALUES(user_id),
          name_en = VALUES(name_en), name_bn = VALUES(name_bn),
          designation_en = VALUES(designation_en), designation_bn = VALUES(designation_bn),
          batch_year = VALUES(batch_year), photo_url = VALUES(photo_url),
          phone = VALUES(phone), email = VALUES(email), tenure = VALUES(tenure),
          order_index = VALUES(order_index), is_active = VALUES(is_active)`,
        [
          cm.id, cm.committee_id || 'comm-ec-2026', cm.user_id || null,
          cm.custom_name_en || cm.name_en || cm.name || 'Member',
          cm.custom_name_bn || cm.name_bn || cm.name_en || 'সদস্য',
          cm.designation_en || 'Member', cm.designation_bn || 'সদস্য',
          cm.batch_year || null, cm.photo_url || null, cm.phone || null,
          cm.email || null, cm.tenure || '2026-2028', cm.order_index || 1,
          cm.is_active !== false ? 1 : 0,
        ]
      );
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO committee_members (
          id, committee_id, user_id, name_en, name_bn, designation_en, designation_bn,
          batch_year, photo_url, phone, email, tenure, order_index, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        ON CONFLICT (id) DO UPDATE SET
          committee_id = EXCLUDED.committee_id, user_id = EXCLUDED.user_id,
          name_en = EXCLUDED.name_en, name_bn = EXCLUDED.name_bn,
          designation_en = EXCLUDED.designation_en, designation_bn = EXCLUDED.designation_bn,
          batch_year = EXCLUDED.batch_year, photo_url = EXCLUDED.photo_url,
          phone = EXCLUDED.phone, email = EXCLUDED.email, tenure = EXCLUDED.tenure,
          order_index = EXCLUDED.order_index, is_active = EXCLUDED.is_active`,
        [
          cm.id, cm.committee_id || 'comm-ec-2026', cm.user_id || null,
          cm.custom_name_en || cm.name_en || cm.name || 'Member',
          cm.custom_name_bn || cm.name_bn || cm.name_en || 'সদস্য',
          cm.designation_en || 'Member', cm.designation_bn || 'সদস্য',
          cm.batch_year || null, cm.photo_url || null, cm.phone || null,
          cm.email || null, cm.tenure || '2026-2028', cm.order_index || 1,
          cm.is_active !== false,
        ]
      );
    }
  }

  /**
   * Delete Committee Member from configured database
   */
  public async deleteCommitteeMember(id: string): Promise<void> {
    if (!id) return;
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute('DELETE FROM committee_members WHERE id = ?', [id]);
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query('DELETE FROM committee_members WHERE id = $1', [id]);
    }
  }

  /**
   * Persist Batch to configured database
   */
  public async saveBatch(b: any): Promise<void> {
    if (!b || !b.id) return;

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute(
        `INSERT INTO batches (
          id, name_en, name_bn, passing_year, batch_number,
          representative_name, representative_phone, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name_en = VALUES(name_en), name_bn = VALUES(name_bn),
          passing_year = VALUES(passing_year), batch_number = VALUES(batch_number),
          representative_name = VALUES(representative_name),
          representative_phone = VALUES(representative_phone),
          is_active = VALUES(is_active)`,
        [
          b.id, b.name_en, b.name_bn, b.passing_year, b.batch_number || b.passing_year,
          b.representative_name || null, b.representative_phone || null,
          b.is_active !== false ? 1 : 0,
        ]
      );
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO batches (
          id, name_en, name_bn, passing_year, batch_number,
          representative_name, representative_phone, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          name_en = EXCLUDED.name_en, name_bn = EXCLUDED.name_bn,
          passing_year = EXCLUDED.passing_year, batch_number = EXCLUDED.batch_number,
          representative_name = EXCLUDED.representative_name,
          representative_phone = EXCLUDED.representative_phone,
          is_active = EXCLUDED.is_active`,
        [
          b.id, b.name_en, b.name_bn, b.passing_year, b.batch_number || b.passing_year,
          b.representative_name || null, b.representative_phone || null,
          b.is_active !== false,
        ]
      );
    }
  }

  /**
   * Delete Batch from configured database
   */
  public async deleteBatch(id: string): Promise<void> {
    if (!id) return;
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute('DELETE FROM batches WHERE id = ?', [id]);
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query('DELETE FROM batches WHERE id = $1', [id]);
    }
  }

  /**
   * Persist Offline Registration Center to configured database
   */
  public async saveOfflineCenter(c: any): Promise<void> {
    if (!c || !c.id) return;

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute(
        `INSERT INTO offline_centers (
          id, name_en, name_bn, address_en, address_bn, phone,
          contact_person, contact_person_bn, timings, timings_bn,
          description_en, description_bn, map_url, order_index, is_active, is_trashed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name_en = VALUES(name_en), name_bn = VALUES(name_bn),
          address_en = VALUES(address_en), address_bn = VALUES(address_bn),
          phone = VALUES(phone), contact_person = VALUES(contact_person),
          contact_person_bn = VALUES(contact_person_bn), timings = VALUES(timings),
          timings_bn = VALUES(timings_bn), description_en = VALUES(description_en),
          description_bn = VALUES(description_bn), map_url = VALUES(map_url),
          order_index = VALUES(order_index), is_active = VALUES(is_active),
          is_trashed = VALUES(is_trashed)`,
        [
          c.id, c.name_en, c.name_bn, c.address_en || null, c.address_bn || null,
          c.phone, c.contact_person || null, c.contact_person_bn || null,
          c.timings || null, c.timings_bn || null, c.description_en || null,
          c.description_bn || null, c.map_url || null, c.order_index || 1,
          c.is_active !== false ? 1 : 0, c.is_trashed ? 1 : 0,
        ]
      );
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO offline_centers (
          id, name_en, name_bn, address_en, address_bn, phone,
          contact_person, contact_person_bn, timings, timings_bn,
          description_en, description_bn, map_url, order_index, is_active, is_trashed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          name_en = EXCLUDED.name_en, name_bn = EXCLUDED.name_bn,
          address_en = EXCLUDED.address_en, address_bn = EXCLUDED.address_bn,
          phone = EXCLUDED.phone, contact_person = EXCLUDED.contact_person,
          contact_person_bn = EXCLUDED.contact_person_bn, timings = EXCLUDED.timings,
          timings_bn = EXCLUDED.timings_bn, description_en = EXCLUDED.description_en,
          description_bn = EXCLUDED.description_bn, map_url = EXCLUDED.map_url,
          order_index = EXCLUDED.order_index, is_active = EXCLUDED.is_active,
          is_trashed = EXCLUDED.is_trashed`,
        [
          c.id, c.name_en, c.name_bn, c.address_en || null, c.address_bn || null,
          c.phone, c.contact_person || null, c.contact_person_bn || null,
          c.timings || null, c.timings_bn || null, c.description_en || null,
          c.description_bn || null, c.map_url || null, c.order_index || 1,
          c.is_active !== false, Boolean(c.is_trashed),
        ]
      );
    }
  }

  /**
   * Delete Offline Registration Center from configured database
   */
  public async deleteOfflineCenter(id: string): Promise<void> {
    if (!id) return;
    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute('DELETE FROM offline_centers WHERE id = ?', [id]);
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query('DELETE FROM offline_centers WHERE id = $1', [id]);
    }
  }

  /**
   * Persist Audit Log
   */
  public async saveAuditLog(l: any): Promise<void> {
    if (!l || !l.id) return;

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      await this.mysqlPool.execute(
        `INSERT INTO audit_logs (id, user_name, user_email, action, entity, details, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [l.id, l.user_name || 'Admin', l.user_email || 'admin@nanupuralumni.org', l.action, l.entity || 'System', l.details || '', l.ip || null, l.created_at || new Date().toISOString()]
      ).catch(() => {});
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO audit_logs (id, user_name, user_email, action, entity, details, ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [l.id, l.user_name || 'Admin', l.user_email || 'admin@nanupuralumni.org', l.action, l.entity || 'System', l.details || '', l.ip || null, l.created_at || new Date().toISOString()]
      ).catch(() => {});
    }
  }

  /**
   * Synchronize an entire collection with the database:
   * 1. Upserts each item
   * 2. Deletes records from database whose IDs are no longer in items list
   */
  public async syncCollection(key: string, items: any[]): Promise<void> {
    if (!Array.isArray(items)) return;

    // Save/Upsert all items
    for (const item of items) {
      if (key === 'registrations') await this.saveRegistration(item);
      else if (key === 'users') await this.saveUser(item);
      else if (key === 'payments') await this.savePayment(item);
      else if (key === 'tokens') await this.saveToken(item);
      else if (key === 'pages') await this.savePage(item);
      else if (key === 'news') await this.saveNews(item);
      else if (key === 'notices') await this.saveNotice(item);
      else if (key === 'committee_members') await this.saveCommitteeMember(item);
      else if (key === 'batches') await this.saveBatch(item);
      else if (key === 'offline_centers') await this.saveOfflineCenter(item);
    }

    // Handle Deletions: remove rows from DB that are not in items list
    if (items.length > 0) {
      const activeIds = items.map(i => i.id).filter(Boolean);
      let tableName = '';
      if (key === 'registrations') tableName = this.activeDriverType === 'mysql' ? 'registrations' : 'event_registrations';
      else if (key === 'payments') tableName = this.activeDriverType === 'mysql' ? 'payments' : 'payment_transactions';
      else if (key === 'tokens') tableName = this.activeDriverType === 'mysql' ? 'tokens' : 'entry_tokens';
      else if (key === 'pages') tableName = 'pages';
      else if (key === 'news') tableName = 'news_posts';
      else if (key === 'notices') tableName = 'notices';
      else if (key === 'committee_members') tableName = 'committee_members';
      else if (key === 'batches') tableName = 'batches';
      else if (key === 'offline_centers') tableName = 'offline_centers';

      if (tableName && activeIds.length > 0) {
        if (this.activeDriverType === 'mysql' && this.mysqlPool) {
          const placeholders = activeIds.map(() => '?').join(',');
          await this.mysqlPool.query(`DELETE FROM ${tableName} WHERE id NOT IN (${placeholders})`, activeIds).catch(() => {});
        } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
          await this.pgPool.query(`DELETE FROM ${tableName} WHERE NOT (id = ANY($1))`, [activeIds]).catch(() => {});
        }
      }
    }
  }

  /**
   * Load all entities directly from the configured database to ensure single authoritative truth
   */
  public async loadAllEntities(): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    // 1. Site Settings
    const settings = await this.loadSettings();
    for (const [k, v] of Object.entries(settings)) {
      data[k] = v;
    }

    if (this.activeDriverType === 'mysql' && this.mysqlPool) {
      try {
        const [users]: any = await this.mysqlPool.execute('SELECT * FROM users');
        if (Array.isArray(users) && users.length > 0) data.users = users;

        const [regs]: any = await this.mysqlPool.execute('SELECT * FROM registrations ORDER BY created_at DESC');
        if (Array.isArray(regs) && regs.length > 0) data.registrations = regs;

        const [tokens]: any = await this.mysqlPool.execute('SELECT * FROM tokens');
        if (Array.isArray(tokens) && tokens.length > 0) data.tokens = tokens;

        const [payments]: any = await this.mysqlPool.execute('SELECT * FROM payments');
        if (Array.isArray(payments) && payments.length > 0) data.payments = payments;

        const [pages]: any = await this.mysqlPool.execute('SELECT * FROM pages');
        if (Array.isArray(pages) && pages.length > 0) {
          data.pages = pages.map((p: any) => ({
            ...p,
            sections: typeof p.sections === 'string' ? JSON.parse(p.sections) : p.sections || [],
          }));
        }

        const [news]: any = await this.mysqlPool.execute('SELECT * FROM news_posts ORDER BY publish_date DESC');
        if (Array.isArray(news) && news.length > 0) data.news = news;

        const [notices]: any = await this.mysqlPool.execute('SELECT * FROM notices ORDER BY publish_date DESC');
        if (Array.isArray(notices) && notices.length > 0) data.notices = notices;

        const [batches]: any = await this.mysqlPool.execute('SELECT * FROM batches ORDER BY passing_year DESC');
        if (Array.isArray(batches) && batches.length > 0) data.batches = batches;

        const [cm]: any = await this.mysqlPool.execute('SELECT * FROM committee_members ORDER BY order_index ASC');
        if (Array.isArray(cm) && cm.length > 0) data.committee_members = cm;

        const [centers]: any = await this.mysqlPool.execute('SELECT * FROM offline_centers ORDER BY order_index ASC');
        if (Array.isArray(centers) && centers.length > 0) data.offline_centers = centers;
      } catch (err: any) {
        console.warn('[Database] MySQL loadAllEntities note:', err.message);
      }
    } else if ((this.activeDriverType === 'supabase' || this.activeDriverType === 'postgres') && this.pgPool) {
      try {
        const uRes = await this.pgPool.query('SELECT * FROM users');
        if (uRes.rows && uRes.rows.length > 0) data.users = uRes.rows;

        const rRes = await this.pgPool.query('SELECT * FROM event_registrations ORDER BY created_at DESC');
        if (rRes.rows && rRes.rows.length > 0) data.registrations = rRes.rows;

        const tRes = await this.pgPool.query('SELECT * FROM entry_tokens');
        if (tRes.rows && tRes.rows.length > 0) data.tokens = tRes.rows;

        const pRes = await this.pgPool.query('SELECT * FROM payment_transactions');
        if (pRes.rows && pRes.rows.length > 0) data.payments = pRes.rows;

        const pgRes = await this.pgPool.query('SELECT * FROM pages');
        if (pgRes.rows && pgRes.rows.length > 0) {
          data.pages = pgRes.rows.map(p => ({
            ...p,
            sections: typeof p.sections === 'string' ? JSON.parse(p.sections) : p.sections || [],
          }));
        }

        const nwRes = await this.pgPool.query('SELECT * FROM news_posts ORDER BY publish_date DESC');
        if (nwRes.rows && nwRes.rows.length > 0) data.news = nwRes.rows;

        const nRes = await this.pgPool.query('SELECT * FROM notices ORDER BY publish_date DESC');
        if (nRes.rows && nRes.rows.length > 0) data.notices = nRes.rows;

        const bRes = await this.pgPool.query('SELECT * FROM batches ORDER BY passing_year DESC');
        if (bRes.rows && bRes.rows.length > 0) data.batches = bRes.rows;

        const cmRes = await this.pgPool.query('SELECT * FROM committee_members ORDER BY order_index ASC');
        if (cmRes.rows && cmRes.rows.length > 0) data.committee_members = cmRes.rows;

        const cRes = await this.pgPool.query('SELECT * FROM offline_centers ORDER BY order_index ASC');
        if (cRes.rows && cRes.rows.length > 0) data.offline_centers = cRes.rows;
      } catch (err: any) {
        console.warn('[Database] PostgreSQL loadAllEntities note:', err.message);
      }
    }

    return data;
  }
}

export const portableDb = new PortableDatabaseManager();
