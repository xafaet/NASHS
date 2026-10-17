import fs from 'fs';
import path from 'path';
import { getDatabaseConfig, DatabaseConfiguration } from '../db/config';
import { portableDb } from '../db/portableDb';
import { DatabaseReadinessService } from './databaseReadinessService';

export interface DatabaseDiagnosticReport {
  status: 'OPERATIONAL' | 'ROOT_FALLBACK_DETECTED' | 'CONNECTION_FAILED' | 'HIGH_RISK_WARNING';
  timestamp: string;
  environment: {
    runtime: string;
    node_version: string;
    platform: string;
    cwd: string;
    app_env: string;
  };
  active_configuration: {
    driver: string;
    host: string;
    port: number;
    database: string;
    username: string;
    password_meta: {
      is_set: boolean;
      length: number;
      has_whitespace: boolean;
      has_special_chars: boolean;
    };
    socket?: string;
  };
  credential_origins: Record<string, {
    active_value: any;
    primary_source: string;
    layers: {
      dotenv_file: string | null;
      process_env: string | null;
    };
    is_inconsistent: boolean;
  }>;
  dotenv_file_audit: {
    exists: boolean;
    path: string;
    is_readable: boolean;
    permissions: string;
    size_bytes: number;
    modified_at: string | null;
    has_db_username: boolean;
    has_db_password: boolean;
  };
  config_cache_audit: {
    cache_file_exists: boolean;
    path: string;
    is_cached: boolean;
  };
  root_fallback_risk: {
    is_currently_root: boolean;
    risk_level: 'LOW' | 'MODERATE' | 'CRITICAL';
    critical_warnings: string[];
    recommendations: string[];
  };
  connection_test: {
    connected: boolean;
    driver: string;
    latency_ms: number | null;
    error_message?: string;
  };
  log_file_path: string;
  log_file_written: boolean;
}

export class DatabaseDiagnosticService {
  private static readonly LOG_FILE_RELATIVE = path.join('storage', 'logs', 'database-connection-diagnostic.log');

  public static async runDiagnostics(extraContext: Record<string, any> = {}): Promise<DatabaseDiagnosticReport> {
    const timestamp = new Date().toISOString();
    const envPath = path.join(process.cwd(), '.env');
    const configCachePath = path.join(process.cwd(), 'bootstrap', 'cache', 'config.php');

    // 1. Inspect disk .env
    const dotEnvParsed = this.inspectDotEnv(envPath);

    // 2. Active database configuration
    const activeDbConfig = getDatabaseConfig();
    const driver = activeDbConfig.driver;

    let host = 'localhost';
    let port = 3306;
    let database = '';
    let username = '';
    let rawPassword = '';
    let socket: string | undefined;

    if (driver === 'mysql' && activeDbConfig.mysql) {
      host = activeDbConfig.mysql.host;
      port = activeDbConfig.mysql.port;
      database = activeDbConfig.mysql.database;
      username = activeDbConfig.mysql.user;
      rawPassword = activeDbConfig.mysql.password || '';
      socket = activeDbConfig.mysql.socketPath;
    } else if ((driver === 'supabase' || driver === 'postgres') && activeDbConfig.postgres) {
      host = activeDbConfig.postgres.host || 'supabase-db';
      port = activeDbConfig.postgres.port || 5432;
      database = activeDbConfig.postgres.database || 'postgres';
      username = activeDbConfig.postgres.user || 'postgres';
      rawPassword = activeDbConfig.postgres.password || '';
    } else {
      host = 'local (memory/json)';
      port = 0;
      database = 'data/db.json';
      username = 'local_embedded';
    }

    // 3. Sanitized configuration (EXCLUDING PASSWORD)
    const activeConfigSanitized = {
      driver,
      host,
      port,
      database,
      username,
      password_meta: {
        is_set: Boolean(rawPassword && rawPassword.trim().length > 0),
        length: rawPassword ? rawPassword.length : 0,
        has_whitespace: /\s/.test(rawPassword),
        has_special_chars: /[!@#$%^&*(),.?":{}|<>]/.test(rawPassword),
      },
      socket,
    };

    // 4. Trace Origins
    const origins: Record<string, any> = {};
    const traceKeys = ['DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME'];
    for (const key of traceKeys) {
      const fromDotEnv = dotEnvParsed.data[key] || null;
      const fromProcEnv = process.env[key] || null;

      let primarySource = 'DEFAULT_OR_FALLBACK';
      if (fromProcEnv !== null) {
        primarySource = 'process.env';
      } else if (fromDotEnv !== null) {
        primarySource = '.env file';
      }

      origins[key] = {
        active_value: key === 'DB_USERNAME' ? username : (key === 'DB_HOST' ? host : (key === 'DB_DATABASE' ? database : (process.env[key] || dotEnvParsed.data[key] || 'default'))),
        primary_source: primarySource,
        layers: {
          dotenv_file: fromDotEnv,
          process_env: fromProcEnv,
        },
        is_inconsistent: Boolean(fromDotEnv && fromProcEnv && fromDotEnv !== fromProcEnv),
      };
    }

    // 5. Test Live Connectivity
    const readiness = await DatabaseReadinessService.checkReadiness(false);
    const connectionTest = {
      connected: readiness.database_connected,
      driver: readiness.driver,
      latency_ms: readiness.latency_ms,
      error_message: readiness.sanitized_error,
    };

    // 6. Assess Root Fallback Risks
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const isCurrentlyRoot = (username === 'root' || (!username && driver === 'mysql'));

    if (isCurrentlyRoot) {
      warnings.push(`CRITICAL: Database username is currently resolved to '${username || 'empty'}'.`);
      if (!activeConfigSanitized.password_meta.is_set) {
        warnings.push("CRITICAL: No password supplied, matching error: Access denied for user 'root'@'localhost' (using password: NO).");
      }
    }

    if (fs.existsSync(configCachePath)) {
      warnings.push("LARAVEL CONFIG CACHE PRESENT: bootstrap/cache/config.php was detected. If artisan config:cache was run before .env was properly populated, it forces defaults like root@127.0.0.1.");
      recommendations.push("Clear cached config on cPanel by running: php artisan config:clear");
    }

    if (!dotEnvParsed.exists) {
      warnings.push("MISSING .ENV: .env file does not exist on disk.");
      recommendations.push("Create a production .env file with explicit DB_USERNAME and DB_PASSWORD.");
    } else {
      if (!dotEnvParsed.data['DB_USERNAME']) {
        warnings.push("MISSING DB_USERNAME in .env: Database will fall back to 'root' if unconfigured.");
        recommendations.push("Set DB_USERNAME=cpaneluser_dbuser in .env.");
      }
      if (!dotEnvParsed.data['DB_PASSWORD']) {
        warnings.push("MISSING DB_PASSWORD in .env: Database connection has no password.");
        recommendations.push("Set DB_PASSWORD=\"your_password\" in .env.");
      }
      if (dotEnvParsed.unquoted_special_chars.length > 0) {
        warnings.push(`UNQUOTED SPECIAL CHARACTERS in .env keys: [${dotEnvParsed.unquoted_special_chars.join(', ')}]. Special characters like # or $ can cause values to be truncated.`);
        recommendations.push("Wrap values with quotes in .env, e.g., DB_PASSWORD=\"my#p@ssword\".");
      }
    }

    let overallStatus: 'OPERATIONAL' | 'ROOT_FALLBACK_DETECTED' | 'CONNECTION_FAILED' | 'HIGH_RISK_WARNING' = 'OPERATIONAL';
    if (isCurrentlyRoot) {
      overallStatus = 'ROOT_FALLBACK_DETECTED';
    } else if (!connectionTest.connected) {
      overallStatus = 'CONNECTION_FAILED';
    } else if (warnings.length > 0) {
      overallStatus = 'HIGH_RISK_WARNING';
    }

    const report: DatabaseDiagnosticReport = {
      status: overallStatus,
      timestamp,
      environment: {
        runtime: 'Node.js / Express + Laravel Architecture',
        node_version: process.version,
        platform: process.platform,
        cwd: process.cwd(),
        app_env: process.env.APP_ENV || 'production',
      },
      active_configuration: activeConfigSanitized,
      credential_origins: origins,
      dotenv_file_audit: {
        exists: dotEnvParsed.exists,
        path: envPath,
        is_readable: dotEnvParsed.is_readable,
        permissions: dotEnvParsed.permissions,
        size_bytes: dotEnvParsed.size,
        modified_at: dotEnvParsed.modified_at,
        has_db_username: Boolean(dotEnvParsed.data['DB_USERNAME']),
        has_db_password: Boolean(dotEnvParsed.data['DB_PASSWORD']),
      },
      config_cache_audit: {
        cache_file_exists: fs.existsSync(configCachePath),
        path: configCachePath,
        is_cached: fs.existsSync(configCachePath),
      },
      root_fallback_risk: {
        is_currently_root: isCurrentlyRoot,
        risk_level: isCurrentlyRoot ? 'CRITICAL' : (warnings.length > 0 ? 'MODERATE' : 'LOW'),
        critical_warnings: warnings,
        recommendations,
      },
      connection_test: connectionTest,
      log_file_path: this.LOG_FILE_RELATIVE,
      log_file_written: false,
    };

    // Write report to internal log file
    report.log_file_written = this.writeToSecureLog(report);

    return report;
  }

  private static inspectDotEnv(filePath: string) {
    if (!fs.existsSync(filePath)) {
      return {
        exists: false,
        is_readable: false,
        permissions: '0000',
        size: 0,
        modified_at: null,
        data: {} as Record<string, string>,
        unquoted_special_chars: [] as string[],
      };
    }

    try {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const data: Record<string, string> = {};
      const unquotedSpecial: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const k = trimmed.slice(0, idx).trim();
          const rawV = trimmed.slice(idx + 1).trim();
          const isQuoted = (rawV.startsWith('"') && rawV.endsWith('"')) || (rawV.startsWith("'") && rawV.endsWith("'"));
          const v = rawV.replace(/^["']|["']$/g, '');
          data[k] = v;

          if (!isQuoted && /[#$@\s]/.test(rawV)) {
            unquotedSpecial.push(k);
          }
        }
      }

      return {
        exists: true,
        is_readable: true,
        permissions: (stats.mode & 0o777).toString(8),
        size: stats.size,
        modified_at: stats.mtime.toISOString(),
        data,
        unquoted_special_chars: unquotedSpecial,
      };
    } catch {
      return {
        exists: true,
        is_readable: false,
        permissions: '0000',
        size: 0,
        modified_at: null,
        data: {} as Record<string, string>,
        unquoted_special_chars: [] as string[],
      };
    }
  }

  private static writeToSecureLog(report: DatabaseDiagnosticReport): boolean {
    try {
      const fullLogPath = path.join(process.cwd(), this.LOG_FILE_RELATIVE);
      const logDir = path.dirname(fullLogPath);

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true, mode: 0o750 });
      }

      const bar = '='.repeat(80);
      const passInfo = report.active_configuration.password_meta.is_set
        ? `YES (Length: ${report.active_configuration.password_meta.length})`
        : 'NO';

      let entry = `\n${bar}\n`;
      entry += `[${report.timestamp}] DATABASE DIAGNOSTIC RECORD | STATUS: ${report.status}\n`;
      entry += `  Active Connection: ${report.active_configuration.driver}://${report.active_configuration.username}@${report.active_configuration.host}:${report.active_configuration.port}/${report.active_configuration.database}\n`;
      entry += `  Password Configured: ${passInfo}\n`;
      entry += `  Connected: ${report.connection_test.connected ? 'YES' : 'NO'}\n`;

      if (report.connection_test.error_message) {
        entry += `  Error: ${report.connection_test.error_message}\n`;
      }

      entry += `  Credential Origins:\n`;
      for (const [k, v] of Object.entries(report.credential_origins)) {
        entry += `    - ${k}: '${v.active_value}' (Origin: ${v.primary_source})\n`;
      }

      entry += `  Root Fallback Risk: ${report.root_fallback_risk.risk_level}\n`;
      if (report.root_fallback_risk.critical_warnings.length > 0) {
        entry += `  Warnings:\n`;
        for (const w of report.root_fallback_risk.critical_warnings) {
          entry += `    ! ${w}\n`;
        }
      }
      if (report.root_fallback_risk.recommendations.length > 0) {
        entry += `  Recommendations:\n`;
        for (const r of report.root_fallback_risk.recommendations) {
          entry += `    * ${r}\n`;
        }
      }

      entry += `${bar}\n`;

      fs.appendFileSync(fullLogPath, entry, { encoding: 'utf-8', mode: 0o640 });
      return true;
    } catch (err: any) {
      console.warn('[DatabaseDiagnosticService] Failed writing to secure log:', err.message);
      return false;
    }
  }
}
