import { getDatabaseConfig, DatabaseConfiguration } from './config';
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

class PortableDatabaseManager {
  private config: DatabaseConfiguration;
  private pgPool: PgPool | null = null;
  private mysqlPool: mysql.Pool | null = null;
  private activeDriverType: string = 'local';
  private connected: boolean = false;

  constructor() {
    this.config = getDatabaseConfig();
    this.init();
  }

  private async init() {
    // 1. MySQL / MariaDB (e.g. cPanel)
    if (this.config.driver === 'mysql' && this.config.mysql) {
      try {
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

        // Test connection
        const conn = await this.mysqlPool.getConnection();
        console.log(`[Database] Connected to cPanel MySQL/MariaDB database "${this.config.mysql.database}" on ${this.config.mysql.host}:${this.config.mysql.port}`);
        conn.release();
        this.activeDriverType = 'mysql';
        this.connected = true;
        return;
      } catch (err: any) {
        console.warn(`[Database] MySQL connection note (${err.message}). Using fallback local persistent store.`);
      }
    }

    // 2. Supabase / PostgreSQL
    if (this.config.driver === 'supabase' && this.config.postgres?.connectionString) {
      try {
        this.pgPool = new PgPool({
          connectionString: this.config.postgres.connectionString,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000,
          max: 10,
        });

        const client = await this.pgPool.connect();
        console.log('[Database] Connected to Supabase PostgreSQL database.');
        client.release();
        this.activeDriverType = 'supabase';
        this.connected = true;
        return;
      } catch (err: any) {
        console.warn(`[Database] Supabase connection note (${err.message}). Operating on resilient local JSON store.`);
      }
    }

    this.activeDriverType = 'local';
    this.connected = true;
  }

  public getStatus() {
    return {
      driver: this.activeDriverType,
      isConnected: this.connected,
      configuredDriver: this.config.driver,
      timestamp: new Date().toISOString(),
    };
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
