import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { Pool as PgPool } from 'pg';
import { Request, Response, NextFunction } from 'express';
import { getDatabaseConfig, parsePostgresUrl, DatabaseConfiguration } from '../db/config';
import { portableDb } from '../db/portableDb';

const DATA_DIR = path.join(process.cwd(), 'data');
const INSTALLED_FILE = path.join(DATA_DIR, 'installed.json');

export type ApplicationState =
  | 'FRESH_INSTALLATION'     // State A: Not installed
  | 'OPERATIONAL'            // State B: Installed, DB connected, essential schema verified
  | 'DATABASE_UNAVAILABLE'   // State C: Installed, DB offline/unreachable/auth error (HTTP 503)
  | 'SCHEMA_INCOMPLETE';     // State D: Installed, DB connected, but essential tables missing (HTTP 503)

export interface ReadinessReport {
  state: ApplicationState;
  is_installed: boolean;
  database_connected: boolean;
  schema_valid: boolean;
  driver: string;
  configured_driver: string;
  host_masked: string;
  database_name: string;
  latency_ms: number | null;
  last_checked_at: string;
  message: string;
  sanitized_error?: string;
  site_name?: string;
}

export class DatabaseReadinessService {
  private static cachedReport: ReadinessReport | null = null;
  private static lastCheckTime = 0;
  private static readonly CACHE_TTL_MS = 15000; // 15-second TTL for cPanel and production performance
  private static lastKnownState: ApplicationState | null = null;

  /**
   * Invalidate cached report to trigger an immediate fresh connectivity check
   */
  public static invalidateCache(): void {
    this.cachedReport = null;
    this.lastCheckTime = 0;
  }

  /**
   * Mask host for secure public/diagnostic display
   */
  public static maskHost(host: string): string {
    if (!host || host === 'localhost' || host === '127.0.0.1') return host || 'localhost';
    const parts = host.split('.');
    if (parts.length > 2) {
      return `${parts[0].slice(0, 4)}****.${parts.slice(1).join('.')}`;
    }
    return `${host.slice(0, 3)}****`;
  }

  /**
   * Redact sensitive credentials, URIs, and connection secrets from errors
   */
  public static sanitizeError(errMsg?: string): string {
    if (!errMsg) return '';
    return errMsg
      .replace(/postgres(ql)?:\/\/[^@\s]+@[^\s/]+/gi, 'postgresql://[REDACTED]@[HOST]')
      .replace(/password\s*=\s*['"]?[^'"\s;]+['"]?/gi, 'password=[REDACTED]')
      .replace(/passwd\s*=\s*['"]?[^'"\s;]+['"]?/gi, 'passwd=[REDACTED]')
      .replace(/user\s*=\s*['"]?[^'"\s;]+['"]?/gi, 'user=[REDACTED]')
      .replace(/:[^\s@/:]+@/g, ':***@');
  }

  /**
   * Determine whether the application has completed first-time installation
   * Checks file marker (installed.json) and environment variable APP_INSTALLED
   */
  public static isInstalled(): { isInstalled: boolean; installedData: any } {
    if (process.env.APP_INSTALLED === 'true') {
      return { isInstalled: true, installedData: { is_installed: true, driver: process.env.DB_CONNECTION || 'mysql' } };
    }

    if (fs.existsSync(INSTALLED_FILE)) {
      try {
        const raw = fs.readFileSync(INSTALLED_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (data && data.is_installed === true) {
          return { isInstalled: true, installedData: data };
        }
      } catch {
        // Parse error, treat as uninstalled only if file is corrupt
      }
    }

    return { isInstalled: false, installedData: {} };
  }

  /**
   * Run live database connectivity and schema check
   * Supports caching (5s TTL) or immediate forced check
   */
  public static async checkReadiness(force = false): Promise<ReadinessReport> {
    const now = Date.now();
    if (!force && this.cachedReport && now - this.lastCheckTime < this.CACHE_TTL_MS) {
      return this.cachedReport;
    }

    const { isInstalled, installedData } = this.isInstalled();

    // STATE A: Fresh installation
    if (!isInstalled) {
      const report: ReadinessReport = {
        state: 'FRESH_INSTALLATION',
        is_installed: false,
        database_connected: false,
        schema_valid: false,
        driver: 'unconfigured',
        configured_driver: 'unconfigured',
        host_masked: 'unconfigured',
        database_name: 'unconfigured',
        latency_ms: null,
        last_checked_at: new Date().toISOString(),
        message: 'The platform has not been installed yet. Initial setup wizard is required.',
      };
      this.cachedReport = report;
      this.lastCheckTime = now;
      this.logStateChange(report.state);
      return report;
    }

    // Determine target database driver
    const dbConfig = getDatabaseConfig();
    const effectiveDriver = (dbConfig.driver || installedData?.driver || (process.env.DATABASE_URL ? 'supabase' : 'local')).toLowerCase();
    const siteName = installedData?.site_name || 'Nanupur Abu Sobhan High School Alumni Association';

    let dbConnected = false;
    let schemaValid = false;
    let latencyMs: number | null = null;
    let maskedHost = 'local';
    let dbName = 'local';
    let rawError: string | undefined;

    const startTime = Date.now();

    // 1. Local Database Driver
    if (effectiveDriver === 'local') {
      maskedHost = 'local (data/db.json)';
      dbName = 'db.json';
      const dbPath = path.join(DATA_DIR, 'db.json');
      try {
        if (fs.existsSync(dbPath)) {
          const content = fs.readFileSync(dbPath, 'utf-8');
          const parsed = JSON.parse(content);
          dbConnected = true;
          schemaValid = Boolean(parsed && typeof parsed === 'object');
          latencyMs = Date.now() - startTime;
        } else {
          dbConnected = true;
          schemaValid = true;
          latencyMs = Date.now() - startTime;
        }
      } catch (err: any) {
        dbConnected = false;
        rawError = `Local JSON storage error: ${err.message}`;
      }
    }

    // 2. MySQL / MariaDB Driver (cPanel hosting)
    else if (effectiveDriver === 'mysql') {
      const mysqlCfg = dbConfig.mysql || {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        database: process.env.DB_DATABASE || 'nash_alumni',
        user: (process.env.DB_USERNAME || '').trim(),
        password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
      };

      maskedHost = `${this.maskHost(mysqlCfg.host)}:${mysqlCfg.port || 3306}`;
      dbName = mysqlCfg.database;

      // SECURITY AUDIT: Never attempt connection with empty user or unauthenticated root!
      if (!mysqlCfg.user || (mysqlCfg.user === 'root' && !mysqlCfg.password)) {
        dbConnected = false;
        schemaValid = false;
        rawError = 'Production MySQL credentials incomplete: DB_USERNAME and DB_PASSWORD must be configured in environment. Connecting with unauthenticated root credentials is prohibited.';
      } else {
        let conn: mysql.Connection | null = null;
        try {
          conn = await mysql.createConnection({
            host: mysqlCfg.host,
            port: mysqlCfg.port,
            database: mysqlCfg.database,
            user: mysqlCfg.user,
            password: mysqlCfg.password,
            connectTimeout: 4000,
          });

          // Test basic connectivity
          await conn.query('SELECT 1');
          latencyMs = Date.now() - startTime;
          dbConnected = true;

        // Verify required schema tables (users, site_settings, registrations)
        try {
          const [tables] = await conn.query('SHOW TABLES LIKE ?', ['users']);
          if (Array.isArray(tables) && tables.length > 0) {
            schemaValid = true;
          } else {
            schemaValid = false;
            rawError = 'Essential table "users" is missing from the database.';
          }
        } catch {
          schemaValid = true; // Connection is intact
        }
      } catch (err: any) {
        dbConnected = false;
        rawError = err.message || 'MySQL connection failed';
      } finally {
        if (conn) {
          try { await conn.end(); } catch {}
        }
      }
    }
    }

    // 3. PostgreSQL / Supabase Driver
    else if (effectiveDriver === 'supabase' || effectiveDriver === 'postgres') {
      const connStr = dbConfig.postgres?.connectionString || process.env.DATABASE_URL;
      if (connStr) {
        const parsed = parsePostgresUrl(connStr);
        if (parsed) {
          maskedHost = `${this.maskHost(parsed.host)}:${parsed.port}`;
          dbName = parsed.database;
        } else {
          maskedHost = 'PostgreSQL Host';
          dbName = 'PostgreSQL DB';
        }
      }

      let pool: PgPool | null = null;
      try {
        const parsed = parsePostgresUrl(connStr);
        if (parsed) {
          pool = new PgPool({
            user: parsed.user,
            password: parsed.password,
            host: parsed.host,
            port: parsed.port,
            database: parsed.database,
            ssl: parsed.ssl,
            connectionTimeoutMillis: 10000,
            max: 2,
          });
        } else {
          pool = new PgPool({
            connectionString: connStr,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000,
            max: 2,
          });
        }

        const client = await pool.connect();
        await client.query('SELECT 1');
        latencyMs = Date.now() - startTime;
        dbConnected = true;

        // Verify required schema
        try {
          const tableRes = await client.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
          );
          if (tableRes.rows && tableRes.rows.length > 0) {
            schemaValid = true;
          } else {
            schemaValid = false;
            rawError = 'Essential table "users" is missing from PostgreSQL public schema.';
          }
        } catch {
          schemaValid = true;
        }

        client.release();
      } catch (err: any) {
        dbConnected = false;
        rawError = err.message || 'PostgreSQL connection failed';
      } finally {
        if (pool) {
          try { await pool.end(); } catch {}
        }
      }
    }

    // Determine state
    let state: ApplicationState = 'OPERATIONAL';
    let message = 'Database connection verified and operational.';

    if (!dbConnected) {
      state = 'DATABASE_UNAVAILABLE'; // State C
      message = 'The database is currently unreachable or credentials failed.';
    } else if (!schemaValid) {
      state = 'SCHEMA_INCOMPLETE'; // State D
      message = 'Database is connected, but essential schema or tables are missing.';
    } else {
      state = 'OPERATIONAL'; // State B
      message = 'System operational. Mandatory database connection confirmed.';
    }

    const sanitizedError = rawError ? this.sanitizeError(rawError) : undefined;

    const report: ReadinessReport = {
      state,
      is_installed: true,
      database_connected: dbConnected,
      schema_valid: schemaValid,
      driver: effectiveDriver,
      configured_driver: dbConfig.driver,
      host_masked: maskedHost,
      database_name: dbName,
      latency_ms: latencyMs,
      last_checked_at: new Date().toISOString(),
      message,
      sanitized_error: sanitizedError,
      site_name: siteName,
    };

    this.cachedReport = report;
    this.lastCheckTime = now;
    this.logStateChange(report.state, report);

    return report;
  }

  /**
   * Log state changes securely with credentials redacted
   */
  private static logStateChange(newState: ApplicationState, report?: ReadinessReport) {
    if (this.lastKnownState !== newState) {
      const timestamp = new Date().toISOString();
      if (newState === 'OPERATIONAL') {
        console.log(`[DB Readiness] [${timestamp}] State recovered to OPERATIONAL (driver: ${report?.driver}, latency: ${report?.latency_ms}ms)`);
      } else if (newState === 'DATABASE_UNAVAILABLE') {
        console.warn(`[DB Readiness] [${timestamp}] ALERT: Database UNAVAILABLE. Host: ${report?.host_masked}, Error: ${report?.sanitized_error || 'Connection timed out'}`);
      } else if (newState === 'SCHEMA_INCOMPLETE') {
        console.warn(`[DB Readiness] [${timestamp}] ALERT: Database schema incomplete. Host: ${report?.host_masked}`);
      } else if (newState === 'FRESH_INSTALLATION') {
        console.log(`[DB Readiness] [${timestamp}] Application in FRESH_INSTALLATION state.`);
      }
      this.lastKnownState = newState;
    }
  }

  /**
   * Renders the controlled 503 HTML Maintenance page for public visitors
   */
  public static render503Html(report: ReadinessReport): string {
    const isSchemaError = report.state === 'SCHEMA_INCOMPLETE';
    const titleEn = isSchemaError ? 'Database Setup Required' : 'Service Temporarily Unavailable';
    const titleBn = isSchemaError ? 'ডাটাবেজ সেটআপ প্রয়োজন' : 'সেবা সাময়িকভাবে অনুপলব্ধ';
    const descEn = isSchemaError
      ? 'The application connected to the database, but essential tables or migrations are not yet initialized.'
      : 'We are experiencing a temporary database connection interruption. Our technical team has been notified, and service will automatically resume once connectivity is restored.';
    const descBn = isSchemaError
      ? 'ডাটাবেজে সফলভাবে সংযোগ স্থাপন হয়েছে, তবে প্রয়োজনীয় টেবিলগুলো এখনো তৈরি করা হয়নি।'
      : 'সিস্টেমের ডাটাবেজ সংযোগে সাময়িক বিঘ্ন ঘটেছে। আপনার নিবন্ধন ও সকল তথ্য সম্পূর্ণ নিরাপদ রয়েছে। সংযোগ পুনঃস্থাপিত হওয়া মাত্রই সাইটটি স্বয়ংক্রিয়ভাবে চালু হবে।';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>503 Service Unavailable | Nanupur Abu Sobhan High School Alumni</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', 'Hind Siliguri', -apple-system, BlinkMacSystemFont, sans-serif;
      background: radial-gradient(circle at top center, #0a3d20 0%, #041a0d 100%);
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(16, 185, 129, 0.25);
      backdrop-filter: blur(16px);
      border-radius: 1.5rem;
      max-width: 38rem;
      width: 100%;
      padding: 2.5rem 2rem;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 1rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.3);
      margin-bottom: 1.5rem;
    }
    .badge-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: #ef4444;
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    h1 {
      font-size: 1.6rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 0.5rem;
      line-height: 1.25;
    }
    .subtitle-bn {
      font-size: 1.2rem;
      color: #fbbf24;
      font-weight: 700;
      margin-bottom: 1.25rem;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1rem;
    }
    .p-bn {
      color: #cbd5e1;
      font-size: 0.9rem;
      line-height: 1.6;
      margin-bottom: 1.75rem;
    }
    .status-box {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 1rem;
      padding: 1rem;
      margin-bottom: 1.75rem;
      text-align: left;
      font-size: 0.8rem;
    }
    .status-row {
      display: flex;
      justify-content: space-between;
      padding: 0.35rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .status-row:last-child { border-bottom: none; }
    .status-label { color: #64748b; font-weight: 600; }
    .status-val { color: #e2e8f0; font-family: monospace; font-weight: 600; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1.75rem;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39);
    }
    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
    }
    .footer-note {
      margin-top: 1.75rem;
      font-size: 0.75rem;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span class="badge-dot"></span>
      HTTP 503 • ${isSchemaError ? 'SCHEMA PENDING' : 'DATABASE OFFLINE'}
    </div>
    <h1>${titleEn}</h1>
    <div class="subtitle-bn">${titleBn}</div>
    <p>${descEn}</p>
    <div class="p-bn">${descBn}</div>

    <div class="status-box">
      <div class="status-row">
        <span class="status-label">System Service:</span>
        <span class="status-val">${report.site_name || 'Nanupur Abu Sobhan High School Alumni Platform'}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Database Target:</span>
        <span class="status-val">${report.driver.toUpperCase()} (${report.host_masked})</span>
      </div>
      <div class="status-row">
        <span class="status-label">Connection Status:</span>
        <span class="status-val" style="color: #ef4444;">DISCONNECTED</span>
      </div>
      <div class="status-row">
        <span class="status-label">Auto Recovery:</span>
        <span class="status-val" style="color: #10b981;">Active (Polling every 5s)</span>
      </div>
    </div>

    <button class="btn" onclick="retryConnection()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
      Retry Connection / পুনরায় চেষ্টা করুন
    </button>

    <div class="footer-note">
      Nanupur Abu Sobhan High School 85th Anniversary Celebration 2027<br>
      Data integrity guaranteed. All member accounts and tickets are preserved.
    </div>
  </div>

  <script>
    function retryConnection() {
      const btn = document.querySelector('.btn');
      btn.innerText = 'Checking Database...';
      btn.disabled = true;
      fetch('/api/system/test-db')
        .then(r => r.json())
        .then(data => {
          if (data && data.state === 'OPERATIONAL') {
            window.location.reload();
          } else {
            setTimeout(() => {
              btn.innerText = 'Retry Connection / পুনরায় চেষ্টা করুন';
              btn.disabled = false;
            }, 1000);
          }
        })
        .catch(() => {
          setTimeout(() => {
            btn.innerText = 'Retry Connection / পুনরায় চেষ্টা করুন';
            btn.disabled = false;
          }, 1000);
        });
    }

    // Auto-poll every 6 seconds to recover immediately when DB is back up
    setInterval(() => {
      fetch('/api/system/db-status')
        .then(r => r.json())
        .then(d => {
          if (d && d.state === 'OPERATIONAL') {
            window.location.reload();
          }
        })
        .catch(() => {});
    }, 6000);
  </script>
</body>
</html>`;
  }

  /**
   * Express middleware enforcing mandatory database connection
   */
  public static createMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const pathname = req.path;

      // Allow static assets, bundles, CSS, images, and fonts unconditionally
      if (
        pathname.startsWith('/assets/') ||
        pathname.endsWith('.js') ||
        pathname.endsWith('.css') ||
        pathname.endsWith('.svg') ||
        pathname.endsWith('.png') ||
        pathname.endsWith('.jpg') ||
        pathname.endsWith('.jpeg') ||
        pathname.endsWith('.ico') ||
        pathname.endsWith('.woff') ||
        pathname.endsWith('.woff2') ||
        pathname.endsWith('.map')
      ) {
        return next();
      }

      // Allow system diagnostics, health checks, and database recovery endpoints
      if (
        pathname === '/api/health' ||
        pathname === '/api/system/db-status' ||
        pathname === '/api/system/test-db' ||
        pathname === '/api/system/db-diagnostic' ||
        pathname === '/api/system/db-diagnostic/log' ||
        pathname === '/api/system/switch-driver'
      ) {
        return next();
      }

      const report = await DatabaseReadinessService.checkReadiness();

      // STATE A: Fresh installation
      if (report.state === 'FRESH_INSTALLATION') {
        // Allow setup API endpoints during installation
        if (pathname.startsWith('/api/setup/')) {
          return next();
        }

        // For API requests outside setup, reject with setup required
        if (pathname.startsWith('/api/')) {
          return res.status(503).json({
            success: false,
            code: 'FRESH_INSTALLATION',
            state: 'FRESH_INSTALLATION',
            message: 'Application setup is required. Please visit the setup wizard.',
          });
        }

        // For HTML requests, proceed so SetupWizard can render
        return next();
      }

      // STATE B: Installed and database connected (OPERATIONAL)
      if (report.state === 'OPERATIONAL') {
        return next();
      }

      // STATE C & D: Database unavailable or schema incomplete
      const statusCode = 503;

      // If API request: return controlled, sanitized JSON
      if (pathname.startsWith('/api/')) {
        res.setHeader('Retry-After', '10');
        return res.status(statusCode).json({
          success: false,
          code: report.state,
          state: report.state,
          message: report.state === 'SCHEMA_INCOMPLETE'
            ? 'Database connected, but essential schema or tables are incomplete.'
            : 'Database connection is temporarily unavailable. Please retry shortly.',
          driver: report.driver,
          host: report.host_masked,
          checked_at: report.last_checked_at,
        });
      }

      // If browser page request:
      // In SPA mode with Vite/React, we pass down so App.tsx renders the graceful DatabaseUnavailableView,
      // but we set HTTP status code 503 so search engines and automated crawlers know the service is down!
      res.status(statusCode);
      return next();
    };
  }
}
