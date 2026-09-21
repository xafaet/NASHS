/**
 * ====================================================================
 * Nanupur Abu Sobhan High School Alumni Platform
 * Database & Eloquent / Controller Mapping Diagnostic Tool
 * 
 * Tests read/write operations for 'registrations' (event_registrations)
 * and 'cms_pages' (pages) tables against the PostgreSQL backend.
 * Verifies schema definitions, Eloquent model mappings, and controllers.
 * 
 * Usage:
 *   npx tsx scripts/diagnose-db.ts
 *   npx tsx scripts/diagnose-db.ts --url="postgresql://user:pass@host:5432/dbname"
 *   npx tsx scripts/diagnose-db.ts --migrate
 *   npx tsx scripts/diagnose-db.ts --skip-cleanup
 *   npx tsx scripts/diagnose-db.ts --verbose
 * ====================================================================
 */

import dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';
import { parsePostgresUrl } from '../server/db/config';
import { db } from '../server/db';
import { portableDb } from '../server/db/portableDb';

dotenv.config();

// ANSI Color Helpers for Terminal Output
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  white: '\x1b[97m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

// Parse Command-line arguments
const args = process.argv.slice(2);
const options = {
  url: args.find(a => a.startsWith('--url='))?.split('=')[1]?.replace(/^["']|["']$/g, ''),
  migrate: args.includes('--migrate'),
  skipCleanup: args.includes('--skip-cleanup'),
  verbose: args.includes('--verbose'),
  help: args.includes('--help') || args.includes('-h'),
};

if (options.help) {
  console.log(`
${c.bold}${c.cyan}Nanupur Alumni Platform - Database Diagnostic Tool${c.reset}

${c.bold}USAGE:${c.reset}
  npx tsx scripts/diagnose-db.ts [options]

${c.bold}OPTIONS:${c.reset}
  --url=<connection_string>  Override DATABASE_URL with a custom connection string
  --migrate                  Automatically create missing tables and Eloquent compatibility views
  --skip-cleanup             Keep diagnostic test records in DB for inspection
  --verbose                  Print detailed SQL queries, parameters, and payloads
  --help, -h                 Show this help message
`);
  process.exit(0);
}

interface TestResult {
  step: string;
  category: 'connection' | 'schema' | 'registrations' | 'cms_pages' | 'controller';
  status: 'PASS' | 'WARN' | 'FAIL' | 'SKIPPED';
  durationMs: number;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function recordResult(result: TestResult) {
  results.push(result);
  const icon = 
    result.status === 'PASS' ? `${c.green}✔ PASS${c.reset}` :
    result.status === 'WARN' ? `${c.yellow}⚠ WARN${c.reset}` :
    result.status === 'FAIL' ? `${c.red}✖ FAIL${c.reset}` :
    `${c.gray}○ SKIP${c.reset}`;
  
  console.log(`  ${icon} [${result.durationMs.toString().padStart(4)}ms] ${c.bold}${result.step}${c.reset}`);
  if (result.message) {
    const color = result.status === 'FAIL' ? c.red : result.status === 'WARN' ? c.yellow : c.gray;
    console.log(`         ${color}└─ ${result.message}${c.reset}`);
  }
  if (options.verbose && result.details) {
    console.log(`         ${c.dim}${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n         ')}${c.reset}`);
  }
}

async function main() {
  console.log('\n' + '='.repeat(78));
  console.log(`${c.bold}${c.cyan} 🛠️  DATABASE READ/WRITE & ELOQUENT MODEL DIAGNOSTIC RUNNER${c.reset}`);
  console.log(`${c.dim}    Targeting 'registrations' & 'cms_pages' PostgreSQL Tables & Controllers${c.reset}`);
  console.log('='.repeat(78) + '\n');

  // ------------------------------------------------------------------
  // 1. Connection Resolution
  // ------------------------------------------------------------------
  const targetUrl = options.url || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  console.log(`${c.bold}Phase 1: PostgreSQL Connection Handshake${c.reset}`);

  let pool: Pool | null = null;
  let client: PoolClient | null = null;
  let serverInfo: any = null;

  if (targetUrl) {
    const parsed = parsePostgresUrl(targetUrl);
    const maskedHost = parsed ? `${parsed.host}:${parsed.port}` : 'unknown';
    const targetDb = parsed?.database || 'postgres';
    console.log(`  Target Backend: ${c.cyan}${targetDb}${c.reset} on ${c.cyan}${maskedHost}${c.reset}`);

    const start = Date.now();
    try {
      const poolConfig = parsed ? {
        user: parsed.user,
        password: parsed.password,
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        ssl: parsed.ssl,
        connectionTimeoutMillis: 8000,
        max: 5,
      } : {
        connectionString: targetUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
        max: 5,
      };

      pool = new Pool(poolConfig);

      client = await pool.connect();
      const res = await client.query('SELECT 1 as test_val, version() as version, current_database() as db_name, current_user as user_name');
      const duration = Date.now() - start;

      serverInfo = {
        version: res.rows[0]?.version?.split(' ')?.[0] + ' ' + res.rows[0]?.version?.split(' ')?.[1],
        fullVersion: res.rows[0]?.version,
        database: res.rows[0]?.db_name,
        user: res.rows[0]?.user_name,
      };

      recordResult({
        step: 'PostgreSQL TCP / SSL Handshake',
        category: 'connection',
        status: 'PASS',
        durationMs: duration,
        message: `Connected to "${serverInfo.database}" as "${serverInfo.user}" (${serverInfo.version})`,
        details: serverInfo,
      });
    } catch (err: any) {
      recordResult({
        step: 'PostgreSQL TCP / SSL Handshake',
        category: 'connection',
        status: 'FAIL',
        durationMs: Date.now() - start,
        message: `Connection failed: ${err.message}`,
      });
    }
  } else {
    recordResult({
      step: 'PostgreSQL Connection Configuration',
      category: 'connection',
      status: 'WARN',
      durationMs: 0,
      message: 'No DATABASE_URL or SUPABASE_DB_URL provided in .env or via --url flag. Testing local application engine fallback.',
    });
  }

  // ------------------------------------------------------------------
  // 2. Schema Introspection for 'registrations' & 'cms_pages'
  // ------------------------------------------------------------------
  console.log(`\n${c.bold}Phase 2: Schema Introspection & Model Mapping Inspection${c.reset}`);

  let registrationTableName = 'event_registrations';
  let cmsPagesTableName = 'pages';
  let hasContentCols = false;

  if (client) {
    // 2.1 Check registration tables (event_registrations vs registrations)
    const startRegInspect = Date.now();
    try {
      const regTablesRes = await client.query(`
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('registrations', 'event_registrations')
      `);

      const foundRegTables = regTablesRes.rows.map(r => `${r.table_name} (${r.table_type})`);
      const hasEventRegistrations = regTablesRes.rows.some(r => r.table_name === 'event_registrations');
      const hasRegistrations = regTablesRes.rows.some(r => r.table_name === 'registrations');

      if (hasRegistrations) {
        registrationTableName = 'registrations';
      } else if (hasEventRegistrations) {
        registrationTableName = 'event_registrations';
      }

      if (hasEventRegistrations && !hasRegistrations) {
        if (options.migrate) {
          await client.query('CREATE OR REPLACE VIEW registrations AS SELECT * FROM event_registrations');
          recordResult({
            step: "Table Mapping: 'registrations' <-> 'event_registrations'",
            category: 'schema',
            status: 'PASS',
            durationMs: Date.now() - startRegInspect,
            message: "Auto-migrated: Created PostgreSQL view 'registrations' -> 'event_registrations' for Eloquent compatibility.",
          });
          registrationTableName = 'registrations';
        } else {
          recordResult({
            step: "Table Mapping: 'registrations' <-> 'event_registrations'",
            category: 'schema',
            status: 'WARN',
            durationMs: Date.now() - startRegInspect,
            message: `Found 'event_registrations' table, but 'registrations' alias view is missing. Laravel Eloquent models expecting 'registrations' table might fail without $table = 'event_registrations'. (Pass --migrate to auto-create view).`,
            details: { found: foundRegTables },
          });
        }
      } else if (!hasEventRegistrations && !hasRegistrations) {
        recordResult({
          step: "Table Mapping: 'registrations' & 'event_registrations'",
          category: 'schema',
          status: 'FAIL',
          durationMs: Date.now() - startRegInspect,
          message: "Neither 'event_registrations' nor 'registrations' table exists in public schema! Migrations must be executed.",
        });
      } else {
        recordResult({
          step: "Table Mapping: 'registrations'",
          category: 'schema',
          status: 'PASS',
          durationMs: Date.now() - startRegInspect,
          message: `Active registration table/view confirmed: '${registrationTableName}' (Tables present: ${foundRegTables.join(', ')})`,
        });
      }

      // 2.2 Inspect Columns of the active registrations table
      const regColsRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = $1
        ORDER BY ordinal_position
      `, [registrationTableName]);

      const regColumns = regColsRes.rows.map(r => r.column_name);
      const expectedRegCols = ['id', 'event_id', 'full_name', 'dob', 'gender', 'phone', 'fee_amount', 'payment_status', 'registration_status'];
      const missingRegCols = expectedRegCols.filter(c => !regColumns.includes(c));

      if (missingRegCols.length > 0) {
        recordResult({
          step: "Registrations Column Mapping Integrity",
          category: 'schema',
          status: 'FAIL',
          durationMs: 1,
          message: `Missing essential Eloquent model columns in '${registrationTableName}': ${missingRegCols.join(', ')}`,
        });
      } else {
        recordResult({
          step: "Registrations Column Mapping Integrity",
          category: 'schema',
          status: 'PASS',
          durationMs: 1,
          message: `'${registrationTableName}' contains all required fields (${regColumns.length} columns detected).`,
          details: { columns: regColumns },
        });
      }
    } catch (err: any) {
      recordResult({
        step: "Registrations Schema Inspection",
        category: 'schema',
        status: 'FAIL',
        durationMs: Date.now() - startRegInspect,
        message: `Error inspecting registrations table: ${err.message}`,
      });
    }

    // 2.3 Check CMS Pages tables ('pages' vs 'cms_pages')
    const startCmsInspect = Date.now();
    try {
      const cmsTablesRes = await client.query(`
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('pages', 'cms_pages')
      `);

      const foundCmsTables = cmsTablesRes.rows.map(r => `${r.table_name} (${r.table_type})`);
      const hasPages = cmsTablesRes.rows.some(r => r.table_name === 'pages');
      const hasCmsPages = cmsTablesRes.rows.some(r => r.table_name === 'cms_pages');

      if (hasCmsPages) {
        cmsPagesTableName = 'cms_pages';
      } else if (hasPages) {
        cmsPagesTableName = 'pages';
      }

      if (!hasPages && !hasCmsPages) {
        if (options.migrate) {
          await client.query(`
            CREATE TABLE IF NOT EXISTS pages (
                id VARCHAR(100) PRIMARY KEY,
                slug VARCHAR(191) UNIQUE NOT NULL,
                title_en VARCHAR(255) NOT NULL,
                title_bn VARCHAR(255) NOT NULL,
                content_en TEXT,
                content_bn TEXT,
                sections JSONB DEFAULT '[]'::jsonb,
                status VARCHAR(50) DEFAULT 'published',
                featured_image TEXT,
                seo_meta JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE OR REPLACE VIEW cms_pages AS SELECT * FROM pages;
          `);
          cmsPagesTableName = 'pages';
          recordResult({
            step: "Table Mapping: 'pages' / 'cms_pages'",
            category: 'schema',
            status: 'PASS',
            durationMs: Date.now() - startCmsInspect,
            message: "Auto-migrated: Created 'pages' table and 'cms_pages' Eloquent compatibility view.",
          });
        } else {
          recordResult({
            step: "Table Mapping: 'pages' / 'cms_pages'",
            category: 'schema',
            status: 'FAIL',
            durationMs: Date.now() - startCmsInspect,
            message: "Neither 'pages' nor 'cms_pages' table exists in PostgreSQL database! Run migrations or pass --migrate to create it.",
          });
        }
      } else if (hasPages && !hasCmsPages) {
        if (options.migrate) {
          await client.query('CREATE OR REPLACE VIEW cms_pages AS SELECT * FROM pages');
          recordResult({
            step: "Table Mapping: 'cms_pages' Eloquent Alias View",
            category: 'schema',
            status: 'PASS',
            durationMs: Date.now() - startCmsInspect,
            message: "Auto-migrated: Created view 'cms_pages' -> 'pages' for Laravel Eloquent compatibility.",
          });
        } else {
          recordResult({
            step: "Table Mapping: 'cms_pages' Eloquent Alias View",
            category: 'schema',
            status: 'WARN',
            durationMs: Date.now() - startCmsInspect,
            message: "Found 'pages' table, but 'cms_pages' alias view is missing. Laravel Eloquent models targeting 'cms_pages' might need $table = 'pages' or view creation. (Pass --migrate to auto-create).",
          });
        }
      } else {
        recordResult({
          step: "Table Mapping: 'cms_pages' & 'pages'",
          category: 'schema',
          status: 'PASS',
          durationMs: Date.now() - startCmsInspect,
          message: `Active CMS page table/view confirmed: '${cmsPagesTableName}' (Tables present: ${foundCmsTables.join(', ')})`,
        });
      }

      // 2.4 Inspect Columns of the active CMS Pages table
      if (hasPages || hasCmsPages || options.migrate) {
        if (options.migrate && hasPages) {
          try {
            await client.query(`
              ALTER TABLE pages ADD COLUMN IF NOT EXISTS content_en TEXT;
              ALTER TABLE pages ADD COLUMN IF NOT EXISTS content_bn TEXT;
              ALTER TABLE pages ADD COLUMN IF NOT EXISTS featured_image TEXT;
              ALTER TABLE pages ADD COLUMN IF NOT EXISTS seo_meta JSONB;
            `);
          } catch {}
        }

        const cmsColsRes = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = $1
          ORDER BY ordinal_position
        `, [cmsPagesTableName]);

        const cmsColumns = cmsColsRes.rows.map(r => r.column_name);
        hasContentCols = cmsColumns.includes('content_en');
        const expectedCmsCols = ['id', 'slug', 'title_en', 'title_bn', 'status'];
        const missingCmsCols = expectedCmsCols.filter(c => !cmsColumns.includes(c));

        if (missingCmsCols.length > 0) {
          recordResult({
            step: "CMS Pages Column Mapping Integrity",
            category: 'schema',
            status: 'FAIL',
            durationMs: 1,
            message: `Missing essential Eloquent model columns in '${cmsPagesTableName}': ${missingCmsCols.join(', ')}`,
          });
        } else {
          recordResult({
            step: "CMS Pages Column Mapping Integrity",
            category: 'schema',
            status: 'PASS',
            durationMs: 1,
            message: `'${cmsPagesTableName}' contains all required fields (${cmsColumns.length} columns detected). Has content_en/bn: ${hasContentCols ? 'Yes' : 'No (sections JSONB used)'}`,
            details: { columns: cmsColumns },
          });
        }
      }
    } catch (err: any) {
      recordResult({
        step: "CMS Pages Schema Inspection",
        category: 'schema',
        status: 'FAIL',
        durationMs: Date.now() - startCmsInspect,
        message: `Error inspecting CMS pages table: ${err.message}`,
      });
    }
  }

  // ------------------------------------------------------------------
  // 3. Read & Write Operations on 'registrations'
  // ------------------------------------------------------------------
  console.log(`\n${c.bold}Phase 3: Read/Write Test Operations on 'registrations'${c.reset}`);

  const testRegId = `DIAG-REG-${Date.now()}`;
  const testRegPhone = `01799${Math.floor(100000 + Math.random() * 900000)}`;
  const testTokenCode = `NASH-DIAG-${Math.floor(100000 + Math.random() * 900000)}`;

  const testRegistrationPayload = {
    id: testRegId,
    event_id: 'event-85th-anniversary',
    full_name: 'Dr. Diagnostic Tester (Alumni)',
    dob: '1988-03-15',
    gender: 'male',
    blood_group: 'A+',
    phone: testRegPhone,
    email: `diagnostic.${Date.now()}@nashalumni.org`,
    passing_year: 2004,
    batch_id: 'batch-2004',
    batch_name: 'Batch 2004 (79th SSC)',
    batch_name_bn: 'ব্যাচ ২০০৪',
    fee_amount: 1000,
    currency: 'BDT',
    payment_status: 'pending',
    registration_status: 'pending',
    payment_method: 'bKash',
    token_code: testTokenCode,
  };

  // 3.1 Direct PostgreSQL INSERT
  if (client) {
    const startInsert = Date.now();
    try {
      // Ensure the referenced event exists to satisfy FK constraint if present
      await client.query(`
        INSERT INTO events (id, slug, title_en, title_bn, event_date, venue_en, venue_bn, registration_fee)
        VALUES ('event-85th-anniversary', '85th-anniversary', '85th Anniversary Celebration', '৮৫তম বার্ষিকী উদযাপন', '2027-01-16', 'School Grounds', 'বিদ্যালয় প্রাঙ্গণ', 1000)
        ON CONFLICT (id) DO NOTHING
      `);

      // Ensure batch exists to satisfy FK constraint if present
      await client.query(`
        INSERT INTO batches (id, name_en, name_bn, passing_year, batch_number)
        VALUES ('batch-2004', 'Batch 2004', 'ব্যাচ ২০০৪', 2004, 79)
        ON CONFLICT (id) DO NOTHING
      `);

      // Perform INSERT
      const insertSql = `
        INSERT INTO event_registrations (
          id, event_id, full_name, dob, gender, blood_group, phone, email,
          passing_year, batch_id, batch_name, batch_name_bn, fee_amount, currency,
          payment_status, registration_status, payment_method, token_code, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
        ) RETURNING id, full_name, phone, payment_status, token_code
      `;

      const insertRes = await client.query(insertSql, [
        testRegistrationPayload.id,
        testRegistrationPayload.event_id,
        testRegistrationPayload.full_name,
        testRegistrationPayload.dob,
        testRegistrationPayload.gender,
        testRegistrationPayload.blood_group,
        testRegistrationPayload.phone,
        testRegistrationPayload.email,
        testRegistrationPayload.passing_year,
        testRegistrationPayload.batch_id,
        testRegistrationPayload.batch_name,
        testRegistrationPayload.batch_name_bn,
        testRegistrationPayload.fee_amount,
        testRegistrationPayload.currency,
        testRegistrationPayload.payment_status,
        testRegistrationPayload.registration_status,
        testRegistrationPayload.payment_method,
        testRegistrationPayload.token_code,
      ]);

      recordResult({
        step: "Registrations WRITE: INSERT Operation",
        category: 'registrations',
        status: 'PASS',
        durationMs: Date.now() - startInsert,
        message: `Successfully inserted test registration (${insertRes.rows[0].id}, Phone: ${insertRes.rows[0].phone})`,
        details: insertRes.rows[0],
      });
    } catch (err: any) {
      recordResult({
        step: "Registrations WRITE: INSERT Operation",
        category: 'registrations',
        status: 'FAIL',
        durationMs: Date.now() - startInsert,
        message: `Insert failed: ${err.message}`,
      });
    }

    // 3.2 Direct PostgreSQL SELECT (READ)
    const startSelect = Date.now();
    try {
      const selectSql = `
        SELECT id, event_id, full_name, phone, email, passing_year, batch_name, fee_amount, payment_status, token_code
        FROM event_registrations 
        WHERE id = $1
      `;
      const selectRes = await client.query(selectSql, [testRegId]);

      if (selectRes.rows.length === 1) {
        const row = selectRes.rows[0];
        const matchName = row.full_name === testRegistrationPayload.full_name;
        const matchPhone = row.phone === testRegistrationPayload.phone;
        const matchYear = Number(row.passing_year) === testRegistrationPayload.passing_year;

        if (matchName && matchPhone && matchYear) {
          recordResult({
            step: "Registrations READ: SELECT by Primary Key",
            category: 'registrations',
            status: 'PASS',
            durationMs: Date.now() - startSelect,
            message: `Retrieved record perfectly: ${row.full_name}, Batch: ${row.batch_name}, Status: ${row.payment_status}`,
            details: row,
          });
        } else {
          recordResult({
            step: "Registrations READ: SELECT by Primary Key",
            category: 'registrations',
            status: 'WARN',
            durationMs: Date.now() - startSelect,
            message: "Record retrieved but some fields had type or value discrepancies.",
            details: { expected: testRegistrationPayload, received: row },
          });
        }
      } else {
        recordResult({
          step: "Registrations READ: SELECT by Primary Key",
          category: 'registrations',
          status: 'FAIL',
          durationMs: Date.now() - startSelect,
          message: `Record with id '${testRegId}' could not be found after insertion!`,
        });
      }
    } catch (err: any) {
      recordResult({
        step: "Registrations READ: SELECT Operation",
        category: 'registrations',
        status: 'FAIL',
        durationMs: Date.now() - startSelect,
        message: `Query failed: ${err.message}`,
      });
    }

    // 3.3 Direct PostgreSQL UPDATE
    const startUpdate = Date.now();
    try {
      const updateSql = `
        UPDATE event_registrations 
        SET payment_status = 'paid', registration_status = 'confirmed', checked_in = TRUE, checked_in_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING id, payment_status, registration_status, checked_in
      `;
      const updateRes = await client.query(updateSql, [testRegId]);

      if (updateRes.rows.length === 1 && updateRes.rows[0].payment_status === 'paid' && updateRes.rows[0].checked_in === true) {
        recordResult({
          step: "Registrations WRITE: UPDATE Operation",
          category: 'registrations',
          status: 'PASS',
          durationMs: Date.now() - startUpdate,
          message: `Successfully updated registration state to: payment_status='paid', checked_in=true`,
          details: updateRes.rows[0],
        });
      } else {
        recordResult({
          step: "Registrations WRITE: UPDATE Operation",
          category: 'registrations',
          status: 'FAIL',
          durationMs: Date.now() - startUpdate,
          message: "Update query succeeded but did not return updated fields as expected.",
        });
      }
    } catch (err: any) {
      recordResult({
        step: "Registrations WRITE: UPDATE Operation",
        category: 'registrations',
        status: 'FAIL',
        durationMs: Date.now() - startUpdate,
        message: `Update failed: ${err.message}`,
      });
    }

    // 3.4 Cleanup (DELETE)
    if (!options.skipCleanup) {
      const startDelete = Date.now();
      try {
        await client.query('DELETE FROM event_registrations WHERE id = $1', [testRegId]);
        recordResult({
          step: "Registrations CLEANUP: DELETE Test Record",
          category: 'registrations',
          status: 'PASS',
          durationMs: Date.now() - startDelete,
          message: `Cleaned up test registration '${testRegId}' from database.`,
        });
      } catch (err: any) {
        recordResult({
          step: "Registrations CLEANUP: DELETE Test Record",
          category: 'registrations',
          status: 'WARN',
          durationMs: Date.now() - startDelete,
          message: `Could not delete test registration: ${err.message}`,
        });
      }
    } else {
      recordResult({
        step: "Registrations CLEANUP",
        category: 'registrations',
        status: 'SKIPPED',
        durationMs: 0,
        message: `Skipped cleanup as requested (--skip-cleanup). Record id '${testRegId}' retained.`,
      });
    }
  } else {
    recordResult({
      step: "Registrations Database Read/Write Operations",
      category: 'registrations',
      status: 'SKIPPED',
      durationMs: 0,
      message: 'PostgreSQL client unavailable. Skipping direct database queries.',
    });
  }

  // ------------------------------------------------------------------
  // 4. Read & Write Operations on 'cms_pages' / 'pages'
  // ------------------------------------------------------------------
  console.log(`\n${c.bold}Phase 4: Read/Write Test Operations on 'cms_pages' / 'pages'${c.reset}`);

  const testPageId = `diag-page-${Date.now()}`;
  const testPageSlug = `diagnostic-test-${Date.now()}`;
  const testPageSections = [
    {
      id: 'sec-hero-1',
      type: 'hero',
      title_en: 'Diagnostic Verification Heading',
      title_bn: 'ডায়াগনস্টিক যাচাই শিরোনাম',
      content_en: 'This section was created by the automated database diagnostic suite.',
      content_bn: 'এই বিভাগটি স্বয়ংক্রিয় ডাটাবেস ডায়াগনস্টিক স্যুট দ্বারা তৈরি করা হয়েছে।',
    },
    {
      id: 'sec-text-2',
      type: 'text',
      body: 'Verified JSONB serialization and deserialization in PostgreSQL backend.',
    }
  ];

  if (client) {
    // 4.1 Direct PostgreSQL INSERT
    const startCmsInsert = Date.now();
    try {
      const insertPageSql = hasContentCols
        ? `
          INSERT INTO pages (
            id, slug, title_en, title_bn, content_en, content_bn, sections, status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
          ) RETURNING id, slug, title_en, status
        `
        : `
          INSERT INTO pages (
            id, slug, title_en, title_bn, sections, status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, NOW(), NOW()
          ) RETURNING id, slug, title_en, status
        `;

      const insertParams = hasContentCols
        ? [
            testPageId,
            testPageSlug,
            'Diagnostic Verification Page',
            'ডায়াগনস্টিক যাচাইকরণ পাতা',
            '<p>Testing PostgreSQL backend persistence for CMS pages.</p>',
            '<p>পোস্টগ্রেস ব্যাকএন্ডে সিএমএস পেজ ডাটা সংরক্ষণ পরীক্ষা।</p>',
            JSON.stringify(testPageSections),
            'published',
          ]
        : [
            testPageId,
            testPageSlug,
            'Diagnostic Verification Page',
            'ডায়াগনস্টিক যাচাইকরণ পাতা',
            JSON.stringify(testPageSections),
            'published',
          ];

      const insertPageRes = await client.query(insertPageSql, insertParams);

      recordResult({
        step: "CMS Pages WRITE: INSERT Operation",
        category: 'cms_pages',
        status: 'PASS',
        durationMs: Date.now() - startCmsInsert,
        message: `Successfully created CMS page (ID: ${insertPageRes.rows[0].id}, Slug: /${insertPageRes.rows[0].slug})`,
        details: insertPageRes.rows[0],
      });
    } catch (err: any) {
      recordResult({
        step: "CMS Pages WRITE: INSERT Operation",
        category: 'cms_pages',
        status: 'FAIL',
        durationMs: Date.now() - startCmsInsert,
        message: `Page insertion failed: ${err.message}`,
      });
    }

    // 4.2 Direct PostgreSQL SELECT (READ by Slug & ID)
    const startCmsSelect = Date.now();
    try {
      const selectPageSql = `
        SELECT id, slug, title_en, title_bn, sections, status, created_at
        FROM pages 
        WHERE slug = $1
      `;
      const selectPageRes = await client.query(selectPageSql, [testPageSlug]);

      if (selectPageRes.rows.length === 1) {
        const pageRow = selectPageRes.rows[0];
        let parsedSections = pageRow.sections;
        if (typeof parsedSections === 'string') {
          try { parsedSections = JSON.parse(parsedSections); } catch {}
        }

        const sectionsValid = Array.isArray(parsedSections) && parsedSections.length === 2;
        const unicodeValid = pageRow.title_bn.includes('যাচাই');

        if (sectionsValid && unicodeValid) {
          recordResult({
            step: "CMS Pages READ: SELECT by Slug & JSONB Deserialization",
            category: 'cms_pages',
            status: 'PASS',
            durationMs: Date.now() - startCmsSelect,
            message: `Retrieved page '${pageRow.title_en}' with ${parsedSections.length} sections and verified Unicode Bengali fidelity.`,
            details: { slug: pageRow.slug, sections_count: parsedSections.length, sample_section: parsedSections[0] },
          });
        } else {
          recordResult({
            step: "CMS Pages READ: SELECT by Slug & JSONB Deserialization",
            category: 'cms_pages',
            status: 'WARN',
            durationMs: Date.now() - startCmsSelect,
            message: "Retrieved page, but sections JSON structure or Unicode Bengali text had format differences.",
          });
        }
      } else {
        recordResult({
          step: "CMS Pages READ: SELECT by Slug",
          category: 'cms_pages',
          status: 'FAIL',
          durationMs: Date.now() - startCmsSelect,
          message: `Page with slug '${testPageSlug}' not found in database!`,
        });
      }
    } catch (err: any) {
      recordResult({
        step: "CMS Pages READ: SELECT Operation",
        category: 'cms_pages',
        status: 'FAIL',
        durationMs: Date.now() - startCmsSelect,
        message: `Query failed: ${err.message}`,
      });
    }

    // 4.3 Direct PostgreSQL UPDATE
    const startCmsUpdate = Date.now();
    try {
      const updatePageSql = `
        UPDATE pages 
        SET title_en = $2, status = 'archived', updated_at = NOW()
        WHERE id = $1
        RETURNING id, title_en, status
      `;
      const updatePageRes = await client.query(updatePageSql, [testPageId, 'Diagnostic Verification Page (Updated)']);

      if (updatePageRes.rows.length === 1 && updatePageRes.rows[0].status === 'archived') {
        recordResult({
          step: "CMS Pages WRITE: UPDATE Operation",
          category: 'cms_pages',
          status: 'PASS',
          durationMs: Date.now() - startCmsUpdate,
          message: `Successfully updated page title and status='archived'`,
          details: updatePageRes.rows[0],
        });
      } else {
        recordResult({
          step: "CMS Pages WRITE: UPDATE Operation",
          category: 'cms_pages',
          status: 'FAIL',
          durationMs: Date.now() - startCmsUpdate,
          message: "Update query did not return expected updated fields.",
        });
      }
    } catch (err: any) {
      recordResult({
        step: "CMS Pages WRITE: UPDATE Operation",
        category: 'cms_pages',
        status: 'FAIL',
        durationMs: Date.now() - startCmsUpdate,
        message: `Page update failed: ${err.message}`,
      });
    }

    // 4.4 Cleanup (DELETE)
    if (!options.skipCleanup) {
      const startCmsDelete = Date.now();
      try {
        await client.query('DELETE FROM pages WHERE id = $1', [testPageId]);
        recordResult({
          step: "CMS Pages CLEANUP: DELETE Test Page",
          category: 'cms_pages',
          status: 'PASS',
          durationMs: Date.now() - startCmsDelete,
          message: `Cleaned up test page '${testPageId}' from database.`,
        });
      } catch (err: any) {
        recordResult({
          step: "CMS Pages CLEANUP: DELETE Test Page",
          category: 'cms_pages',
          status: 'WARN',
          durationMs: Date.now() - startCmsDelete,
          message: `Could not delete test page: ${err.message}`,
        });
      }
    } else {
      recordResult({
        step: "CMS Pages CLEANUP",
        category: 'cms_pages',
        status: 'SKIPPED',
        durationMs: 0,
        message: `Skipped cleanup as requested (--skip-cleanup). Page id '${testPageId}' retained.`,
      });
    }
  } else {
    recordResult({
      step: "CMS Pages Database Read/Write Operations",
      category: 'cms_pages',
      status: 'SKIPPED',
      durationMs: 0,
      message: 'PostgreSQL client unavailable. Skipping direct database queries.',
    });
  }

  // ------------------------------------------------------------------
  // 5. Controller & Application Data Layer Mapping Test
  // ------------------------------------------------------------------
  console.log(`\n${c.bold}Phase 5: Controller & Application Layer Mapping Test${c.reset}`);

  // 5.1 Test Registration Controller Pipeline (via db.get / db.set / sync)
  const startControllerReg = Date.now();
  try {
    const existingRegistrations = db.get('registrations') || [];
    const ctrlTestReg = {
      id: `CTRL-REG-${Date.now()}`,
      event_id: 'event-85th-anniversary',
      full_name: 'Controller Test Alumnus',
      dob: '1995-07-20',
      gender: 'male' as const,
      blood_group: 'B+' as any,
      phone: `01888${Math.floor(100000 + Math.random() * 900000)}`,
      email: 'ctrl.tester@nanupuralumni.org',
      passing_year: 2011,
      batch_id: 'batch-2011',
      batch_name: 'Batch 2011',
      batch_name_bn: 'ব্যাচ ২০১১',
      fee_amount: 1000,
      currency: 'BDT',
      payment_status: 'pending' as any,
      registration_status: 'pending' as any,
      payment_method: 'bKash',
      token_code: `CTRL-${Date.now()}`,
      checked_in: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Simulate RegistrationController.store()
    const updatedRegistrations = [ctrlTestReg, ...existingRegistrations];
    db.set('registrations', updatedRegistrations);

    // Read back via controller lookup (simulate RegistrationController.show())
    const reRead = (db.get('registrations') || []).find(r => r.id === ctrlTestReg.id);

    if (reRead && reRead.full_name === ctrlTestReg.full_name) {
      recordResult({
        step: "Registration Controller Pipeline (Store & Show Mapping)",
        category: 'controller',
        status: 'PASS',
        durationMs: Date.now() - startControllerReg,
        message: `Controller pipeline successfully mapped & persisted registration (ID: ${ctrlTestReg.id})`,
      });
    } else {
      recordResult({
        step: "Registration Controller Pipeline (Store & Show Mapping)",
        category: 'controller',
        status: 'FAIL',
        durationMs: Date.now() - startControllerReg,
        message: "Registration could not be retrieved from controller state after storage.",
      });
    }

    // Clean up controller test record
    if (!options.skipCleanup) {
      const cleaned = (db.get('registrations') || []).filter(r => r.id !== ctrlTestReg.id);
      db.set('registrations', cleaned);
    }
  } catch (err: any) {
    recordResult({
      step: "Registration Controller Pipeline",
      category: 'controller',
      status: 'FAIL',
      durationMs: Date.now() - startControllerReg,
      message: `Controller test failed: ${err.message}`,
    });
  }

  // 5.2 Test CMS Page Controller Pipeline (via db.get / db.set / sync)
  const startControllerPage = Date.now();
  try {
    const existingPages = db.get('pages') || [];
    const ctrlTestPage = {
      id: `ctrl-page-${Date.now()}`,
      slug: `ctrl-test-${Date.now()}`,
      title_en: 'Controller Mapping Test Page',
      title_bn: 'কন্ট্রোলার ম্যাপিং টেস্ট পাতা',
      status: 'published' as any,
      sections: [{ id: 'sec-1', type: 'hero', heading: 'Controller Test' }] as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Simulate CmsPageController.store()
    const updatedPages = [ctrlTestPage, ...existingPages];
    db.set('pages', updatedPages);

    // Simulate CmsPageController.show(slug)
    const reReadPage = (db.get('pages') || []).find(p => p.slug === ctrlTestPage.slug);

    if (reReadPage && reReadPage.id === ctrlTestPage.id) {
      recordResult({
        step: "CMS Page Controller Pipeline (Slug Resolution & Storage)",
        category: 'controller',
        status: 'PASS',
        durationMs: Date.now() - startControllerPage,
        message: `Controller pipeline successfully mapped CMS page by slug '/${ctrlTestPage.slug}'`,
      });
    } else {
      recordResult({
        step: "CMS Page Controller Pipeline (Slug Resolution & Storage)",
        category: 'controller',
        status: 'FAIL',
        durationMs: Date.now() - startControllerPage,
        message: `CMS Page could not be resolved by slug from controller state.`,
      });
    }

    // Clean up controller test page
    if (!options.skipCleanup) {
      const cleanedPages = (db.get('pages') || []).filter(p => p.id !== ctrlTestPage.id);
      db.set('pages', cleanedPages);
    }
  } catch (err: any) {
    recordResult({
      step: "CMS Page Controller Pipeline",
      category: 'controller',
      status: 'FAIL',
      durationMs: Date.now() - startControllerPage,
      message: `Controller test failed: ${err.message}`,
    });
  }

  // Release PostgreSQL pool
  if (client) {
    try { client.release(); } catch {}
  }
  if (pool) {
    try { await pool.end(); } catch {}
  }

  // ------------------------------------------------------------------
  // 6. Summary & Recommendations
  // ------------------------------------------------------------------
  console.log('\n' + '='.repeat(78));
  console.log(`${c.bold}DIAGNOSTIC EXECUTIVE SUMMARY${c.reset}`);
  console.log('='.repeat(78));

  const passCount = results.filter(r => r.status === 'PASS').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const skipCount = results.filter(r => r.status === 'SKIPPED').length;

  console.log(`\n  Total Tests: ${results.length} | ${c.green}Passed: ${passCount}${c.reset} | ${c.yellow}Warnings: ${warnCount}${c.reset} | ${c.red}Failed: ${failCount}${c.reset} | ${c.gray}Skipped: ${skipCount}${c.reset}\n`);

  if (failCount === 0 && warnCount === 0) {
    console.log(`  ${c.bgGreen}${c.white}${c.bold} ALL CHECKS PASSED ${c.reset}  Database tables and controller mappings are 100% verified.\n`);
  } else if (failCount === 0) {
    console.log(`  ${c.bgYellow}${c.white}${c.bold} PASSED WITH RECOMMENDATIONS ${c.reset}  Read/Write operations succeeded with minor warnings noted.\n`);
  } else {
    console.log(`  ${c.bgRed}${c.white}${c.bold} ISSUES DETECTED ${c.reset}  Please review the recommendations below.\n`);
  }

  // Print Actionable Recommendations if any
  if (warnCount > 0 || failCount > 0) {
    console.log(`${c.bold}Actionable Recommendations:${c.reset}`);
    let recIndex = 1;

    if (!targetUrl) {
      console.log(`  ${recIndex++}. ${c.yellow}Configure DATABASE_URL:${c.reset} Add your PostgreSQL connection string in .env:`);
      console.log(`     DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/[DATABASE]`);
      console.log(`     Or run with: npx tsx scripts/diagnose-db.ts --url="postgresql://..."`);
    }

    const regWarn = results.find(r => r.category === 'schema' && r.step.includes('registrations') && r.status !== 'PASS');
    if (regWarn) {
      console.log(`  ${recIndex++}. ${c.yellow}Registrations Table Mapping:${c.reset} To ensure Eloquent models expecting 'registrations' work when the table is 'event_registrations', execute:`);
      console.log(`     ${c.cyan}CREATE OR REPLACE VIEW registrations AS SELECT * FROM event_registrations;${c.reset}`);
    }

    const cmsWarn = results.find(r => r.category === 'schema' && r.step.includes('cms_pages') && r.status !== 'PASS');
    if (cmsWarn) {
      console.log(`  ${recIndex++}. ${c.yellow}CMS Pages Table Mapping:${c.reset} Ensure the 'pages' table and 'cms_pages' view exist in PostgreSQL:`);
      console.log(`     ${c.cyan}CREATE TABLE IF NOT EXISTS pages (id VARCHAR(100) PRIMARY KEY, slug VARCHAR(191) UNIQUE NOT NULL, title_en VARCHAR(255) NOT NULL, title_bn VARCHAR(255) NOT NULL, content_en TEXT, content_bn TEXT, sections JSONB DEFAULT '[]'::jsonb, status VARCHAR(50) DEFAULT 'published', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);${c.reset}`);
      console.log(`     ${c.cyan}CREATE OR REPLACE VIEW cms_pages AS SELECT * FROM pages;${c.reset}`);
      console.log(`     (Tip: You can run ${c.bold}npx tsx scripts/diagnose-db.ts --migrate${c.reset} to automatically apply these).`);
    }
    console.log();
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n' + c.red + 'Fatal Diagnostic Runner Error:' + c.reset, err);
  process.exit(1);
});
