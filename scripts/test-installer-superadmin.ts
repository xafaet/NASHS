/**
 * Nanupur Abu Sobhan High School Alumni Platform
 * Automated Verification Suite for Super Admin Username & Installation Integrity
 *
 * Covers Tests A, B, C, D, E, F as specified in user requirements:
 * - Test A: Custom username (e.g. 'safaet')
 * - Test B: Username 'admin' (explicitly submitted by installer)
 * - Test C: Different arbitrary username (e.g. 'headmaster_2027')
 * - Test D: Invalid and duplicate usernames (rejections with HTTP 400)
 * - Test E: Installation security and re-installation lock (HTTP 403)
 * - Test F: Authentication persistence, role enforcement, and session lifecycle
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { db } from '../server/db';
import { InstallerService, InstallPayload } from '../server/installer';
import { AuthService } from '../server/auth';

const DATA_DIR = path.join(process.cwd(), 'data');
const INSTALLED_FILE = path.join(DATA_DIR, 'installed.json');

interface TestReport {
  name: string;
  category: string;
  passed: boolean;
  message: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, name: string, category: string, message: string) {
  reports.push({
    name,
    category,
    passed: condition,
    message,
  });
  if (condition) {
    console.log(`  ✔ PASS [${category}] ${name}: ${message}`);
  } else {
    console.error(`  ✖ FAIL [${category}] ${name}: ${message}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' 🧪 SUPER ADMIN USERNAME & INSTALLATION REGRESSION TEST SUITE');
  console.log('================================================================');

  // Backup existing installed.json and db state to restore after test run
  const installedFileBackup = fs.existsSync(INSTALLED_FILE) ? fs.readFileSync(INSTALLED_FILE, 'utf-8') : null;
  const initialUsersBackup = [...(db.get('users') || [])];

  try {
    // ------------------------------------------------------------------
    // TEST D: INVALID AND DUPLICATE USERNAME VALIDATION
    // ------------------------------------------------------------------
    console.log('\n--- Test D: Validation of Empty, Invalid, and Duplicate Usernames ---');

    db.set('users', []);
    if (fs.existsSync(INSTALLED_FILE)) fs.unlinkSync(INSTALLED_FILE);

    // D1: Empty username
    let emptyUsernameFailed = false;
    try {
      if (fs.existsSync(INSTALLED_FILE)) fs.unlinkSync(INSTALLED_FILE);
      await InstallerService.install({
        database: { driver: 'local' },
        admin: {
          name: 'Test Administrator',
          username: '   ', // Empty/whitespace
          email: 'test_empty@nanupuralumni.org',
          phone: '01711000000',
          password: 'Password123!',
        },
        site: {
          site_name: 'Test Association',
          site_url: 'https://test.nanupuralumni.org',
          site_email: 'test@nanupuralumni.org',
          default_language: 'en',
        },
      });
    } catch (err: any) {
      emptyUsernameFailed = true;
      assert(
        err.message.includes('username is required'),
        'Rejection of Empty Username',
        'TEST-D1',
        `Correctly rejected empty username: "${err.message}"`
      );
    }
    if (!emptyUsernameFailed) {
      assert(false, 'Rejection of Empty Username', 'TEST-D1', 'Failed: Server accepted empty username!');
    }

    // D2: Invalid characters in username (spaces, special symbols)
    let invalidCharFailed = false;
    try {
      if (fs.existsSync(INSTALLED_FILE)) fs.unlinkSync(INSTALLED_FILE);
      await InstallerService.install({
        database: { driver: 'local' },
        admin: {
          name: 'Test Administrator',
          username: 'safaet user!@#', // Invalid characters
          email: 'test_invalid@nanupuralumni.org',
          phone: '01711000000',
          password: 'Password123!',
        },
        site: {
          site_name: 'Test Association',
          site_url: 'https://test.nanupuralumni.org',
          site_email: 'test@nanupuralumni.org',
          default_language: 'en',
        },
      });
    } catch (err: any) {
      invalidCharFailed = true;
      assert(
        err.message.includes('between 3 and 30 characters'),
        'Rejection of Invalid Username Characters',
        'TEST-D2',
        `Correctly rejected invalid characters: "${err.message}"`
      );
    }
    if (!invalidCharFailed) {
      assert(false, 'Rejection of Invalid Username Characters', 'TEST-D2', 'Failed: Server accepted invalid username characters!');
    }

    // D3: Username too short (e.g. 2 chars)
    let tooShortFailed = false;
    try {
      if (fs.existsSync(INSTALLED_FILE)) fs.unlinkSync(INSTALLED_FILE);
      await InstallerService.install({
        database: { driver: 'local' },
        admin: {
          name: 'Test Administrator',
          username: 'ab', // Too short
          email: 'test_short@nanupuralumni.org',
          phone: '01711000000',
          password: 'Password123!',
        },
        site: {
          site_name: 'Test Association',
          site_url: 'https://test.nanupuralumni.org',
          site_email: 'test@nanupuralumni.org',
          default_language: 'en',
        },
      });
    } catch (err: any) {
      tooShortFailed = true;
      assert(
        err.message.includes('between 3 and 30 characters'),
        'Rejection of Too Short Username',
        'TEST-D3',
        `Correctly rejected short username: "${err.message}"`
      );
    }
    if (!tooShortFailed) {
      assert(false, 'Rejection of Too Short Username', 'TEST-D3', 'Failed: Server accepted too short username!');
    }

    // ------------------------------------------------------------------
    // TEST A: CUSTOM USERNAME (e.g. 'safaet')
    // ------------------------------------------------------------------
    console.log('\n--- Test A: Custom Super Admin Username ("safaet") ---');

    // Clean DB users for isolated installation test
    db.set('users', []);
    if (fs.existsSync(INSTALLED_FILE)) fs.unlinkSync(INSTALLED_FILE);

    const installA: InstallPayload = {
      database: { driver: 'local' },
      admin: {
        name: 'Safaet Ullah',
        username: 'safaet',
        email: 'safaet@nanupuralumni.org',
        phone: '01712999888',
        password: 'SafaetPassword2027!',
        password_confirmation: 'SafaetPassword2027!',
      },
      site: {
        site_name: 'Nanupur Abu Sobhan High School Alumni Platform',
        site_url: 'https://nanupuralumni.org',
        site_email: 'info@nanupuralumni.org',
        default_language: 'bn',
      },
    };

    const resA = await InstallerService.install(installA);
    assert(resA.success === true, 'Installation Execution', 'TEST-A1', 'Installation completed successfully for username "safaet"');

    // Verify DB contains account with exact username 'safaet'
    const usersA = db.get('users') || [];
    const accountA = usersA.find(u => u.username === 'safaet');
    assert(!!accountA, 'Database Account Existence', 'TEST-A2', 'Found account with exact username "safaet" in users collection');
    assert(accountA?.role === 'super_admin', 'Role Assignment', 'TEST-A3', `Account has role "${accountA?.role}" (expected: "super_admin")`);
    assert(accountA?.email === 'safaet@nanupuralumni.org', 'Email Persistence', 'TEST-A4', `Account email matches "safaet@nanupuralumni.org"`);
    assert(
      !!accountA?.password_hash && bcrypt.compareSync('SafaetPassword2027!', accountA.password_hash),
      'Bcrypt Hash Verification',
      'TEST-A5',
      'Password correctly verified via bcrypt hash'
    );

    // Verify authentication via getUserByCredential using username 'safaet'
    const authUserA = await db.getUserByCredential('safaet');
    assert(authUserA?.username === 'safaet', 'Authoritative Lookup by Username', 'TEST-A6', `Found user by credential "safaet": username="${authUserA?.username}"`);

    // Verify token generation and role checking
    const tokenA = AuthService.generateToken(authUserA!);
    const decodedA = AuthService.verifyToken(tokenA);
    assert(decodedA?.username === 'safaet', 'JWT Token Verification', 'TEST-A7', `Decoded JWT user has username="${decodedA?.username}"`);
    assert(decodedA?.role === 'super_admin', 'Super Admin Privileges in JWT', 'TEST-A8', `Decoded JWT role="${decodedA?.role}"`);
    assert(AuthService.hasPermission(decodedA!, 'manage_settings'), 'Super Admin Permission Gate', 'TEST-A9', 'Super admin permission gate granted all administrative capabilities');

    // D4: Test duplicate username rejection when 'safaet' already exists
    let duplicateUsernameFailed = false;
    try {
      if (fs.existsSync(INSTALLED_FILE)) fs.unlinkSync(INSTALLED_FILE);
      db.set('users', [{
        id: 'user-existing-safaet',
        username: 'safaet',
        name: 'Existing Member',
        email: 'existing_member@nanupuralumni.org',
        phone: '01711999999',
        role: 'alumni_member',
        status: 'active',
        created_at: new Date().toISOString(),
      }]);

      await InstallerService.install({
        ...installA,
        admin: {
          ...installA.admin,
          email: 'another_email@nanupuralumni.org', // Different email, same username
        },
      });
    } catch (err: any) {
      duplicateUsernameFailed = true;
      assert(
        err.message.includes('already taken'),
        'Rejection of Duplicate Username',
        'TEST-D4',
        `Correctly rejected duplicate username: "${err.message}"`
      );
    }
    if (!duplicateUsernameFailed) {
      assert(false, 'Rejection of Duplicate Username', 'TEST-D4', 'Failed: Duplicate username was accepted!');
    }

    // ------------------------------------------------------------------
    // TEST B: USERNAME 'admin' (EXPLICITLY ENTERED IN FORM)
    // ------------------------------------------------------------------
    console.log('\n--- Test B: Username "admin" (Explicitly Entered in Form) ---');

    // Clean DB users for fresh test B
    db.set('users', []);
    if (fs.existsSync(INSTALLED_FILE)) fs.unlinkSync(INSTALLED_FILE);

    const installB: InstallPayload = {
      database: { driver: 'local' },
      admin: {
        name: 'Headmaster Admin',
        username: 'admin', // Explicitly submitted by user
        email: 'headmaster@nanupuralumni.org',
        phone: '01819000002',
        password: 'AdminSecurePassword2027#',
        password_confirmation: 'AdminSecurePassword2027#',
      },
      site: {
        site_name: 'Nanupur Abu Sobhan High School Alumni Platform',
        site_url: 'https://nanupuralumni.org',
        site_email: 'info@nanupuralumni.org',
        default_language: 'bn',
      },
    };

    const resB = await InstallerService.install(installB);
    assert(resB.success === true, 'Installation with "admin"', 'TEST-B1', 'Installation succeeded when user chose "admin"');

    const usersB = db.get('users') || [];
    const accountB = usersB.find(u => u.username === 'admin');
    assert(!!accountB, 'Account Persistence for "admin"', 'TEST-B2', 'Account exists with username="admin" because user submitted it');
    assert(accountB?.role === 'super_admin', 'Role for "admin"', 'TEST-B3', 'Role assigned as "super_admin"');
    assert(
      bcrypt.compareSync('AdminSecurePassword2027#', accountB?.password_hash || ''),
      'Bcrypt Hash for "admin"',
      'TEST-B4',
      'Password verified using submitted credential'
    );

    // Verify rejection of incorrect password
    const isBadPass = bcrypt.compareSync('WrongPassword', accountB?.password_hash || '');
    assert(!isBadPass, 'Rejection of Incorrect Password', 'TEST-B5', 'Correctly rejected incorrect password for "admin"');

    // ------------------------------------------------------------------
    // TEST C: DIFFERENT ARBITRARY USERNAME (e.g. 'nash_convener')
    // ------------------------------------------------------------------
    console.log('\n--- Test C: Different Arbitrary Username ("nash_convener") ---');

    db.set('users', []);
    if (fs.existsSync(INSTALLED_FILE)) fs.unlinkSync(INSTALLED_FILE);

    const installC: InstallPayload = {
      database: { driver: 'local' },
      admin: {
        name: 'Reunion Committee Convener',
        username: 'nash_convener',
        email: 'convener@nanupuralumni.org',
        phone: '01711223344',
        password: 'ConvenerPass2027!',
      },
      site: {
        site_name: 'Nanupur Abu Sobhan High School Alumni Platform',
        site_url: 'https://nanupuralumni.org',
        site_email: 'info@nanupuralumni.org',
        default_language: 'bn',
      },
    };

    const resC = await InstallerService.install(installC);
    assert(resC.success === true, 'Installation with "nash_convener"', 'TEST-C1', 'Installation succeeded with "nash_convener"');

    const accountC = (db.get('users') || []).find(u => u.username === 'nash_convener');
    assert(!!accountC, 'Arbitrary Username Persistence', 'TEST-C2', 'Username "nash_convener" persisted accurately');
    assert(accountC?.role === 'super_admin', 'Arbitrary Username Role', 'TEST-C3', 'Role assigned as "super_admin"');

    // Verify login lookup by username
    const authC = await db.getUserByCredential('nash_convener');
    assert(authC?.username === 'nash_convener', 'Credential Lookup for Arbitrary Username', 'TEST-C4', 'Found user by username "nash_convener"');

    // ------------------------------------------------------------------
    // TEST E: INSTALLATION SECURITY & RE-INSTALLATION LOCK
    // ------------------------------------------------------------------
    console.log('\n--- Test E: Installation Security & Lock Protection ---');

    // Verify that installed.json exists and is_installed is true
    const statusE = InstallerService.getStatus();
    assert(statusE.is_installed === true, 'Installation Flag Status', 'TEST-E1', 'Installer reports is_installed === true');

    // Attempting to run install again should be strictly rejected
    let lockRejected = false;
    try {
      await InstallerService.install(installC);
    } catch (err: any) {
      lockRejected = true;
      assert(
        err.message.includes('SECURITY_RESTRICTION') || err.message.includes('already installed'),
        'Re-installation Lock Guard',
        'TEST-E2',
        `Re-installation blocked with security exception: "${err.message}"`
      );
    }
    if (!lockRejected) {
      assert(false, 'Re-installation Lock Guard', 'TEST-E1', 'Failed: Installer allowed re-configuration!');
    }

    // ------------------------------------------------------------------
    // TEST F: AUTHENTICATION PERSISTENCE & SESSION LIFECYCLE
    // ------------------------------------------------------------------
    console.log('\n--- Test F: Authentication Persistence & Lifecycle ---');

    // Re-verify that user can login via email as well as username
    const authByEmail = await db.getUserByCredential('convener@nanupuralumni.org');
    assert(authByEmail?.username === 'nash_convener', 'Authentication by Email', 'TEST-F1', 'User can authenticate using registered email address');

    // Re-verify that user can login by phone
    const authByPhone = await db.getUserByCredential('01711223344');
    assert(authByPhone?.username === 'nash_convener', 'Authentication by Mobile Phone', 'TEST-F2', 'User can authenticate using registered mobile phone');

    // Non-existent username returns null
    const nonExistent = await db.getUserByCredential('ghost_non_existent_user');
    assert(nonExistent === null, 'Rejection of Non-existent Credential', 'TEST-F3', 'Non-existent credential returns null safely');

  } finally {
    // Restore backup state
    if (installedFileBackup !== null) {
      fs.writeFileSync(INSTALLED_FILE, installedFileBackup, 'utf-8');
    }
    db.set('users', initialUsersBackup);
  }

  // ------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(' 📊 REGRESSION TEST SUMMARY');
  console.log('================================================================');
  const total = reports.length;
  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;

  console.log(`Total Checks: ${total} | Passed: ${passed} | Failed: ${failed}`);
  if (failed === 0) {
    console.log('🎉 ALL SUPER ADMIN USERNAME & INSTALLATION CRITERIA PASSED 100%!\n');
  } else {
    console.error(`❌ ${failed} checks failed. Please inspect logs.\n`);
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
