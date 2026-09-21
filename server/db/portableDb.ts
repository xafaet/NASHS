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
    } else if (this.activeDriverType === 'supabase' && this.pgPool) {
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
    }
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
    } else if (this.activeDriverType === 'supabase' && this.pgPool) {
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
}

export const portableDb = new PortableDatabaseManager();
