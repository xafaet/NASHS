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
