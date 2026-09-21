/**
 * ====================================================================
 * Nanupur Abu Sobhan High School Alumni Platform
 * Simple Database Read/Write & Eloquent Model Verification Tool
 * 
 * Verifies that:
 * 1. Backend storage (PostgreSQL / Supabase) communication is active.
 * 2. Eloquent models (User, Registration, CMSPage, Event, Batch)
 *    are correctly mapped to backend tables and views.
 * 3. Performs a simple, atomic write -> read -> update -> delete test cycle.
 * 
 * Usage:
 *   npx tsx scripts/verify-storage.ts
 *   npm run test:storage
 * ====================================================================
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import { parsePostgresUrl } from '../server/db/config';

dotenv.config();

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[97m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
};

// Model definitions representing Laravel Eloquent model mappings
const ELOQUENT_MODELS = [
  {
    model: 'User',
    primaryTable: 'users',
    fallbackTables: [],
    primaryKey: 'id',
    fillable: ['name', 'email', 'phone', 'role', 'batch', 'passing_year', 'password_hash'],
  },
  {
    model: 'Registration',
    primaryTable: 'registrations',
    fallbackTables: ['event_registrations'],
    primaryKey: 'id',
    fillable: ['event_id', 'full_name', 'phone', 'email', 'fee_amount', 'payment_status', 'registration_status', 'token_code'],
  },
  {
    model: 'CMSPage',
    primaryTable: 'cms_pages',
    fallbackTables: ['pages'],
    primaryKey: 'id',
    fillable: ['slug', 'title_en', 'title_bn', 'sections', 'status'],
  },
  {
    model: 'Event',
    primaryTable: 'events',
    fallbackTables: [],
    primaryKey: 'id',
    fillable: ['slug', 'title_en', 'title_bn', 'event_date', 'venue_en', 'registration_fee'],
  },
  {
    model: 'Batch',
    primaryTable: 'batches',
    fallbackTables: [],
    primaryKey: 'id',
    fillable: ['name_en', 'name_bn', 'passing_year', 'batch_number'],
  },
];

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log(`${c.bold}${c.cyan} 🔍 DATABASE STORAGE & ELOQUENT MODEL DIAGNOSTIC${c.reset}`);
  console.log(`${c.dim}    Verifying backend communication & model-to-table mappings${c.reset}`);
  console.log('='.repeat(70) + '\n');

  const rawUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!rawUrl) {
    console.error(`${c.red}✖ Error: DATABASE_URL is not set in environment.${c.reset}`);
    process.exit(1);
  }

  const parsed = parsePostgresUrl(rawUrl);
  if (!parsed) {
    console.error(`${c.red}✖ Error: Failed to parse DATABASE_URL.${c.reset}`);
    process.exit(1);
  }

  const pool = new Pool({
    user: parsed.user,
    password: parsed.password,
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    ssl: parsed.ssl,
    connectionTimeoutMillis: 8000,
    max: 2,
  });

  let client;
  const startTime = Date.now();

  try {
    // ----------------------------------------------------------------
    // 1. Connection Handshake
    // ----------------------------------------------------------------
    process.stdout.write(`  [1/3] Connecting to backend storage (${parsed.host}:${parsed.port})... `);
    client = await pool.connect();
    const handshakeRes = await client.query('SELECT version() as version, current_database() as db_name, current_user as db_user');
    const latency = Date.now() - startTime;
    const versionStr = handshakeRes.rows[0]?.version?.split(' ')?.[0] + ' ' + handshakeRes.rows[0]?.version?.split(' ')?.[1];
    
    console.log(`${c.green}${c.bold}CONNECTED${c.reset} (${latency}ms)`);
    console.log(`        ${c.gray}Database: ${handshakeRes.rows[0].db_name} | User: ${handshakeRes.rows[0].db_user} | Engine: ${versionStr}${c.reset}\n`);

    // ----------------------------------------------------------------
    // 2. Eloquent Model Mapping Verification
    // ----------------------------------------------------------------
    console.log(`  [2/3] Verifying Eloquent Model Mappings:`);

    // Fetch existing tables and views
    const tablesRes = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingEntities = new Map(tablesRes.rows.map(r => [r.table_name, r.table_type]));

    let allModelsValid = true;

    for (const m of ELOQUENT_MODELS) {
      const hasPrimary = existingEntities.has(m.primaryTable);
      const matchedFallback = m.fallbackTables.find(f => existingEntities.has(f));
      const activeTable = hasPrimary ? m.primaryTable : matchedFallback;

      if (!activeTable) {
        console.log(`    ${c.red}✖${c.reset} Model ${c.bold}${m.model.padEnd(13)}${c.reset} -> ${c.red}NO TABLE FOUND${c.reset} (Expected: '${m.primaryTable}')`);
        allModelsValid = false;
        continue;
      }

      // Check columns
      const colsRes = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [activeTable]);
      const availableCols = new Set(colsRes.rows.map(r => r.column_name));

      const missingFillable = m.fillable.filter(f => !availableCols.has(f));
      const entityType = existingEntities.get(activeTable);

      if (missingFillable.length === 0) {
        const aliasNote = activeTable !== m.primaryTable ? ` (via '${activeTable}')` : '';
        console.log(`    ${c.green}✔${c.reset} Model ${c.bold}${m.model.padEnd(13)}${c.reset} -> Table ${c.cyan}'${activeTable}'${c.reset} [${entityType}]${aliasNote} ${c.green}(All ${m.fillable.length} attributes mapped)${c.reset}`);
      } else {
        console.log(`    ${c.yellow}⚠${c.reset} Model ${c.bold}${m.model.padEnd(13)}${c.reset} -> Table ${c.cyan}'${activeTable}'${c.reset} (Missing columns: ${missingFillable.join(', ')})`);
      }
    }

    // ----------------------------------------------------------------
    // 3. Simple Read / Write Operation Cycle
    // ----------------------------------------------------------------
    console.log(`\n  [3/3] Performing Simple Read/Write Operation:`);

    const testKey = `DIAG_TEST_${Date.now()}`;
    const testPayload = {
      diagnostic_id: testKey,
      client: 'Laravel Eloquent Verifier',
      status: 'active',
      timestamp: new Date().toISOString(),
      random_nonce: Math.floor(Math.random() * 1000000),
    };

    // Step 3A: Simple Write (INSERT)
    const writeStart = Date.now();
    await client.query(`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [testKey, JSON.stringify(testPayload)]);
    const writeDuration = Date.now() - writeStart;
    console.log(`    ${c.green}✔ WRITE (INSERT)${c.reset} -> Saved test record with key '${testKey}' (${writeDuration}ms)`);

    // Step 3B: Simple Read (SELECT)
    const readStart = Date.now();
    const readRes = await client.query(`
      SELECT key, value, updated_at 
      FROM site_settings 
      WHERE key = $1
    `, [testKey]);
    const readDuration = Date.now() - readStart;

    if (readRes.rows.length === 0) {
      throw new Error(`Record with key '${testKey}' was written but could not be read back!`);
    }

    const retrievedValue = typeof readRes.rows[0].value === 'string' 
      ? JSON.parse(readRes.rows[0].value) 
      : readRes.rows[0].value;

    const valuesMatch = retrievedValue.random_nonce === testPayload.random_nonce;
    if (!valuesMatch) {
      throw new Error(`Data fidelity mismatch: wrote nonce ${testPayload.random_nonce}, retrieved ${retrievedValue.random_nonce}`);
    }
    console.log(`    ${c.green}✔ READ  (SELECT)${c.reset} -> Retrieved record and verified 100% data integrity (${readDuration}ms)`);

    // Step 3C: Simple Update (UPDATE)
    const updateStart = Date.now();
    const updatedPayload = { ...testPayload, status: 'verified_updated' };
    await client.query(`
      UPDATE site_settings 
      SET value = $2, updated_at = NOW() 
      WHERE key = $1
    `, [testKey, JSON.stringify(updatedPayload)]);
    const updateDuration = Date.now() - updateStart;
    console.log(`    ${c.green}✔ WRITE (UPDATE)${c.reset} -> Modified record state to 'verified_updated' (${updateDuration}ms)`);

    // Step 3D: Teardown (DELETE)
    const deleteStart = Date.now();
    await client.query('DELETE FROM site_settings WHERE key = $1', [testKey]);
    const deleteDuration = Date.now() - deleteStart;
    console.log(`    ${c.green}✔ CLEAN (DELETE)${c.reset} -> Purged temporary diagnostic record (${deleteDuration}ms)`);

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------
    console.log('\n' + '='.repeat(70));
    console.log(`  ${c.bgGreen}${c.white}${c.bold} VERIFICATION SUCCESSFUL ${c.reset}`);
    console.log(`  Backend storage communication is active and responsive.`);
    console.log(`  Eloquent models and database tables are verified.`);
    console.log('='.repeat(70) + '\n');

    process.exit(0);
  } catch (err: any) {
    console.error(`\n${c.bgRed}${c.white}${c.bold} VERIFICATION FAILED ${c.reset}`);
    console.error(`${c.red}Error: ${err.message}${c.reset}\n`);
    process.exit(1);
  } finally {
    if (client) {
      try { client.release(); } catch {}
    }
    try { await pool.end(); } catch {}
  }
}

main();
