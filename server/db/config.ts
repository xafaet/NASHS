import dotenv from 'dotenv';
dotenv.config();

export type DatabaseDriver = 'supabase' | 'postgres' | 'mysql' | 'local';

export interface DatabaseConfiguration {
  driver: DatabaseDriver;
  // Supabase / PostgreSQL credentials
  postgres?: {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl?: boolean | object;
    supabaseUrl?: string;
    supabaseKey?: string;
  };
  // cPanel MySQL / MariaDB credentials
  mysql?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password?: string;
    socketPath?: string;
    charset: string;
  };
}

export interface ParsedPostgresConfig {
  user: string;
  password?: string;
  host: string;
  port: number;
  database: string;
  ssl: boolean | object;
}

export function parsePostgresUrl(rawUrl?: string): ParsedPostgresConfig | null {
  if (!rawUrl) return null;
  try {
    const prefix = 'postgresql://';
    const postPrefix = 'postgres://';
    let rest = rawUrl;
    if (rest.startsWith(prefix)) {
      rest = rest.slice(prefix.length);
    } else if (rest.startsWith(postPrefix)) {
      rest = rest.slice(postPrefix.length);
    } else {
      return null;
    }

    const lastAt = rest.lastIndexOf('@');
    if (lastAt === -1) return null;

    const userPass = rest.slice(0, lastAt);
    const hostPart = rest.slice(lastAt + 1);

    const firstColon = userPass.indexOf(':');
    const rawUser = firstColon !== -1 ? userPass.slice(0, firstColon) : userPass;
    const rawPass = firstColon !== -1 ? userPass.slice(firstColon + 1) : '';

    let user = rawUser;
    let password = rawPass;
    try { user = decodeURIComponent(rawUser); } catch {}
    try { password = decodeURIComponent(rawPass); } catch {}

    const slashIndex = hostPart.indexOf('/');
    const hostPort = slashIndex !== -1 ? hostPart.slice(0, slashIndex) : hostPart;
    let dbName = slashIndex !== -1 ? hostPart.slice(slashIndex + 1) : 'postgres';

    const questionIndex = dbName.indexOf('?');
    if (questionIndex !== -1) {
      dbName = dbName.slice(0, questionIndex);
    }

    const colonIndex = hostPort.indexOf(':');
    const host = colonIndex !== -1 ? hostPort.slice(0, colonIndex) : hostPort;
    const portStr = colonIndex !== -1 ? hostPort.slice(colonIndex + 1) : '5432';
    const port = parseInt(portStr || '5432', 10);

    return {
      user: user || 'postgres',
      password: password || '',
      host: host || 'localhost',
      port: isNaN(port) ? 5432 : port,
      database: dbName || 'postgres',
      ssl: { rejectUnauthorized: false },
    };
  } catch (err) {
    console.warn('Error parsing PostgreSQL URL:', err);
    return null;
  }
}

let activeRuntimeConfig: DatabaseConfiguration | null = null;

export function updateDatabaseConfig(newConfig: DatabaseConfiguration): void {
  activeRuntimeConfig = newConfig;

  if (newConfig.driver === 'mysql' && newConfig.mysql) {
    process.env.DB_CONNECTION = 'mysql';
    process.env.DB_HOST = newConfig.mysql.host;
    process.env.DB_PORT = String(newConfig.mysql.port);
    process.env.DB_DATABASE = newConfig.mysql.database;
    process.env.DB_USERNAME = newConfig.mysql.user;
    if (newConfig.mysql.password) {
      process.env.DB_PASSWORD = newConfig.mysql.password;
    }
  } else if ((newConfig.driver === 'supabase' || newConfig.driver === 'postgres') && newConfig.postgres) {
    process.env.DB_CONNECTION = 'supabase';
    if (newConfig.postgres.connectionString) {
      process.env.DATABASE_URL = newConfig.postgres.connectionString;
    }
  } else if (newConfig.driver === 'local') {
    process.env.DB_CONNECTION = 'local';
  }
}

export function getDatabaseConfig(): DatabaseConfiguration {
  if (activeRuntimeConfig) {
    return activeRuntimeConfig;
  }

  const rawDriver = (process.env.DB_CONNECTION || '').toLowerCase().trim();

  // 1. MySQL / MariaDB (cPanel hosting)
  if (rawDriver === 'mysql' || process.env.DB_HOST) {
    return {
      driver: 'mysql',
      mysql: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        database: process.env.DB_DATABASE || 'nash_alumni',
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '',
        socketPath: process.env.DB_SOCKET || undefined,
        charset: 'utf8mb4',
      },
    };
  }

  // 2. Supabase / PostgreSQL
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (rawDriver === 'supabase' || rawDriver === 'postgres' || dbUrl) {
    return {
      driver: 'supabase',
      postgres: {
        connectionString: dbUrl,
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      },
    };
  }

  // 3. Fallback / Embedded JSON engine
  return {
    driver: 'local',
  };
}
