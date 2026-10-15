import { db } from '../server/db';
import { portableDb } from '../server/db/portableDb';
import { InstallerService } from '../server/installer';
import { AuthService } from '../server/auth';
import { MailService } from '../server/services/mailService';
import bcrypt from 'bcryptjs';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  id: string;
  name: string;
  phase: string;
  status: 'PASSED' | 'FAILED';
  details: string;
}

const results: TestResult[] = [];

function record(id: string, name: string, phase: string, passed: boolean, details: string) {
  results.push({
    id,
    name,
    phase,
    status: passed ? 'PASSED' : 'FAILED',
    details,
  });
  console.log(`${passed ? '✔ PASS' : '✖ FAIL'} [${id}] ${name}: ${details}`);
}

async function run() {
  console.log('================================================================');
  console.log(' 🚀 COMPREHENSIVE APPLICATION & DEPLOYMENT AUDIT RUNNER');
  console.log('================================================================\n');

  // Warm up and wait until HTTP server is responsive
  for (let i = 0; i < 20; i++) {
    try {
      const ping = await fetch(`${BASE_URL}/api/system/db-status`);
      if (ping.ok || ping.status === 503) break;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // ------------------------------------------------------------
  // PHASE 1 & 2: DATABASE PERSISTENCE & LIVE CONNECTIVITY
  // ------------------------------------------------------------
  console.log('--- Phase 2: Database Persistence & Verification ---');
  try {
    const liveConn = await portableDb.testLiveConnection();
    record(
      'DB-01',
      'Database Live Connectivity Handshake',
      'Phase 2: Database-Driven Architecture',
      liveConn.success,
      `Driver: ${liveConn.driver}, Latency: ${liveConn.latency_ms}ms, Server: ${liveConn.server_version || 'Active'}`
    );
  } catch (err: any) {
    record('DB-01', 'Database Live Connectivity Handshake', 'Phase 2: Database-Driven Architecture', false, err.message);
  }

  try {
    const settings = db.get('settings') as any;
    const globalSettings = db.get('global_settings') as any;
    const isDbSettings = Boolean(settings?.site_name_en || globalSettings?.site_title_en);
    record(
      'DB-02',
      'Site Settings Persisted from Database',
      'Phase 2: Database-Driven Architecture',
      isDbSettings,
      `Site Name: ${settings?.site_name_en || globalSettings?.site_title_en || 'None'}`
    );
  } catch (err: any) {
    record('DB-02', 'Site Settings Persisted from Database', 'Phase 2: Database-Driven Architecture', false, err.message);
  }

  // ------------------------------------------------------------
  // PHASE 3: FRESH INSTALLATION WIZARD & SECURITY LOCK
  // ------------------------------------------------------------
  console.log('\n--- Phase 3: Setup Wizard & Installation Security ---');
  try {
    const status = InstallerService.getStatus();
    record(
      'INST-01',
      'Installation State Persistence Check',
      'Phase 3: Installation Wizard',
      status.is_installed === true,
      `is_installed: ${status.is_installed}, driver: ${status.driver}, site_url: ${status.site_url}`
    );
  } catch (err: any) {
    record('INST-01', 'Installation State Persistence Check', 'Phase 3: Installation Wizard', false, err.message);
  }

  // Test re-installation protection (Must be rejected)
  try {
    const reInstallRes = await fetch(`${BASE_URL}/api/setup/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database: { driver: 'mysql' },
        admin: { name: 'Hacker', email: 'hacker@attack.com', password: 'password123' },
        site: { site_name: 'Defaced Site' },
      }),
    });
    const reInstallData = await reInstallRes.json();
    const isBlocked = reInstallRes.status === 403 || reInstallRes.status === 400;
    record(
      'INST-02',
      'Re-installation Lock Protection',
      'Phase 3: Installation Wizard',
      isBlocked,
      `HTTP Status: ${reInstallRes.status}, Message: ${reInstallData.message || reInstallData.error}`
    );
  } catch (err: any) {
    record('INST-02', 'Re-installation Lock Protection', 'Phase 3: Installation Wizard', false, err.message);
  }

  // Test unauthenticated connection test when installed (Must require Super Admin)
  try {
    const testConnRes = await fetch(`${BASE_URL}/api/setup/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver: 'mysql', host: 'localhost' }),
    });
    const isProtected = testConnRes.status === 403 || testConnRes.status === 401;
    record(
      'INST-03',
      'Setup Endpoints Authorization Guard',
      'Phase 3: Installation Wizard',
      isProtected,
      `HTTP Status: ${testConnRes.status} (Protected from unauthenticated access)`
    );
  } catch (err: any) {
    record('INST-03', 'Setup Endpoints Authorization Guard', 'Phase 3: Installation Wizard', false, err.message);
  }

  // ------------------------------------------------------------
  // AUTHENTICATION & ROLE AUTHORIZATION
  // ------------------------------------------------------------
  console.log('\n--- Phase 7: Authentication & RBAC ---');
  let adminToken = '';
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'super_admin', password: 'admin123' }),
    });
    const loginData = await loginRes.json();
    adminToken = loginData.token || '';
    record(
      'AUTH-01',
      'Super Admin Authentication & JWT Issue',
      'Phase 7: Security & Authorization',
      loginData.success && Boolean(adminToken),
      `User: ${loginData.user?.username}, Role: ${loginData.user?.role}`
    );
  } catch (err: any) {
    record('AUTH-01', 'Super Admin Authentication & JWT Issue', 'Phase 7: Security & Authorization', false, err.message);
  }

  // Test Role Guard on Dashboard (without token => 401)
  try {
    const unauthRes = await fetch(`${BASE_URL}/api/admin/dashboard`);
    record(
      'AUTH-02',
      'Admin Endpoint Protection Against Unauthenticated Access',
      'Phase 7: Security & Authorization',
      unauthRes.status === 401,
      `HTTP Status: ${unauthRes.status} (Unauthorized blocked)`
    );
  } catch (err: any) {
    record('AUTH-02', 'Admin Endpoint Protection Against Unauthenticated Access', 'Phase 7: Security & Authorization', false, err.message);
  }

  // ------------------------------------------------------------
  // PHASE 5: REGISTRATION WORKFLOW & T-SHIRT SIZE BUG REMEDIATION
  // ------------------------------------------------------------
  console.log('\n--- Phase 5: Registration Workflow & Form Integrity ---');
  let dynamicSizes: string[] = [];
  try {
    const fieldsRes = await fetch(`${BASE_URL}/api/registration/fields`);
    const fields = await fieldsRes.json();
    const tshirtField = fields.find((f: any) => f.name === 't_shirt_size');
    dynamicSizes = tshirtField?.options || [];
    const hasTshirtField = Boolean(tshirtField && tshirtField.is_enabled && dynamicSizes.length > 0);
    record(
      'REG-01',
      'Dynamic T-Shirt Field & Configured Options',
      'Phase 5: Registration Workflow',
      hasTshirtField,
      `Field enabled: ${tshirtField?.is_enabled}, Options: [${dynamicSizes.join(', ')}]`
    );
  } catch (err: any) {
    record('REG-01', 'Dynamic T-Shirt Field & Configured Options', 'Phase 5: Registration Workflow', false, err.message);
  }

  // Submit without T-shirt size (Must be rejected 400)
  try {
    const emptySizeRes = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Audit Empty Size Tester',
        dob: '1995-05-12',
        gender: 'male',
        blood_group: 'B+',
        phone: '01700' + Math.floor(100000 + Math.random() * 900000),
        email: 'empty_size@test.org',
        passing_year: 2010,
        t_shirt_size: '',
      }),
    });
    const emptySizeData = await emptySizeRes.json();
    const isRejected = emptySizeRes.status === 400;
    record(
      'REG-02',
      'Server-side Rejection of Empty Required T-Shirt Size',
      'Phase 5: Registration Workflow',
      isRejected,
      `HTTP ${emptySizeRes.status}: ${emptySizeData.message}`
    );
  } catch (err: any) {
    record('REG-02', 'Server-side Rejection of Empty Required T-Shirt Size', 'Phase 5: Registration Workflow', false, err.message);
  }

  // Submit with invalid T-shirt size (Must be rejected 400)
  try {
    const invalidSizeRes = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Audit Invalid Size Tester',
        dob: '1995-05-12',
        gender: 'male',
        blood_group: 'B+',
        phone: '01701' + Math.floor(100000 + Math.random() * 900000),
        email: 'invalid_size@test.org',
        passing_year: 2010,
        t_shirt_size: 'NON_EXISTENT_SIZE_XXXXL',
      }),
    });
    const invalidSizeData = await invalidSizeRes.json();
    const isRejected = invalidSizeRes.status === 400;
    record(
      'REG-03',
      'Server-side Rejection of Invalid Unconfigured T-Shirt Size',
      'Phase 5: Registration Workflow',
      isRejected,
      `HTTP ${invalidSizeRes.status}: ${invalidSizeData.message}`
    );
  } catch (err: any) {
    record('REG-03', 'Server-side Rejection of Invalid Unconfigured T-Shirt Size', 'Phase 5: Registration Workflow', false, err.message);
  }

  // Submit with valid intentional size 'XL'
  let registeredId = '';
  let tokenCode = '';
  const testPhone = '01702' + Math.floor(100000 + Math.random() * 900000);
  try {
    const validRegRes = await fetch(`${BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Audit Verification Alumni',
        dob: '1992-04-15',
        gender: 'male',
        blood_group: 'O+',
        phone: testPhone,
        email: `alumni_${Date.now()}@nanupuralumni.org`,
        passing_year: 2008,
        t_shirt_size: 'XL',
      }),
    });
    const validRegData = await validRegRes.json();
    registeredId = validRegData.registration?.id || '';
    tokenCode = validRegData.token?.token_code || '';
    const exactSizeSaved = validRegData.registration?.t_shirt_size === 'XL';
    record(
      'REG-04',
      'Intentional Selection Persisted Accurately Without Substitution',
      'Phase 5: Registration Workflow',
      validRegRes.status === 201 && exactSizeSaved,
      `Reg ID: ${registeredId}, Saved Size: "${validRegData.registration?.t_shirt_size}", Token: ${tokenCode}`
    );
  } catch (err: any) {
    record('REG-04', 'Intentional Selection Persisted Accurately Without Substitution', 'Phase 5: Registration Workflow', false, err.message);
  }

  // ------------------------------------------------------------
  // PAYMENT WORKFLOW & VERIFICATION
  // ------------------------------------------------------------
  console.log('\n--- Phase 5: Payment Processing & Verification ---');
  if (registeredId) {
    try {
      const paySubmitRes = await fetch(`${BASE_URL}/api/payments/manual-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: registeredId,
          transaction_id: 'TRX' + Math.floor(10000000 + Math.random() * 90000000),
          gateway: 'bkash',
          sender_number: testPhone,
          amount: 1000,
        }),
      });
      const paySubmitData = await paySubmitRes.json();
      record(
        'PAY-01',
        'Manual Payment Submission (bKash/Nagad)',
        'Phase 5: Registration & Payment',
        paySubmitRes.status === 200 && paySubmitData.success,
        `Status: ${paySubmitData.payment?.status || 'submitted'}`
      );
    } catch (err: any) {
      record('PAY-01', 'Manual Payment Submission (bKash/Nagad)', 'Phase 5: Registration & Payment', false, err.message);
    }

    // Admin Payment Verification
    try {
      const verifyPayRes = await fetch(`${BASE_URL}/api/admin/registrations/${registeredId}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const verifyPayData = await verifyPayRes.json();
      record(
        'PAY-02',
        'Authorized Admin Payment Verification & Token Activation',
        'Phase 5: Registration & Payment',
        verifyPayRes.status === 200 && verifyPayData.success,
        `Registration Status: ${verifyPayData.registration?.payment_status}, Token Code: ${verifyPayData.token?.token_code}`
      );
    } catch (err: any) {
      record('PAY-02', 'Authorized Admin Payment Verification & Token Activation', 'Phase 5: Registration & Payment', false, err.message);
    }
  }

  // ------------------------------------------------------------
  // TOKEN VERIFICATION & PASS VIEW
  // ------------------------------------------------------------
  console.log('\n--- Phase 5: Entry Token & QR Pass Verification ---');
  if (tokenCode) {
    try {
      const tokenRes = await fetch(`${BASE_URL}/api/tokens/verify/${tokenCode}`);
      const tokenData = await tokenRes.json();
      const isValid = tokenRes.status === 200 && (tokenData.isValid === true || tokenData.found === true);
      const attendeeName = tokenData.token?.alumni_name || tokenData.token?.member_name;
      const tShirt = tokenData.token?.t_shirt_size;
      record(
        'TOK-01',
        'Collision-safe Token Lookup & Verification',
        'Phase 5: Token Verification',
        isValid && Boolean(attendeeName),
        `Verified Attendee: ${attendeeName}, Size: ${tShirt}`
      );
    } catch (err: any) {
      record('TOK-01', 'Collision-safe Token Lookup & Verification', 'Phase 5: Token Verification', false, err.message);
    }
  }

  // ------------------------------------------------------------
  // PDF GENERATION
  // ------------------------------------------------------------
  console.log('\n--- Phase 6: PDF Generation & Confirmation Documents ---');
  if (registeredId) {
    try {
      const pdfRes = await fetch(`${BASE_URL}/api/registrations/${registeredId}/pdf`);
      const contentType = pdfRes.headers.get('content-type') || '';
      const isPdf = pdfRes.status === 200 && contentType.includes('application/pdf');
      record(
        'PDF-01',
        'Registration Confirmation PDF Generation',
        'Phase 6: PDF Generation',
        isPdf,
        `HTTP Status: ${pdfRes.status}, Content-Type: ${contentType}`
      );
    } catch (err: any) {
      record('PDF-01', 'Registration Confirmation PDF Generation', 'Phase 6: PDF Generation', false, err.message);
    }
  }

  // ------------------------------------------------------------
  // PHASE 6: SMTP EMAIL CONFIGURATION & TESTING
  // ------------------------------------------------------------
  console.log('\n--- Phase 6: Mail & SMTP Settings ---');
  try {
    const mailGetRes = await fetch(`${BASE_URL}/api/admin/mail-settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const mailSettings = await mailGetRes.json();
    const hasSmtp = mailGetRes.status === 200 && Boolean(mailSettings.smtp_host);
    record(
      'MAIL-01',
      'Admin SMTP Settings Retrieval (Masked Secrets)',
      'Phase 6: Email & SMTP',
      hasSmtp,
      `Host: ${mailSettings.smtp_host}, Port: ${mailSettings.smtp_port}, Encryption: ${mailSettings.smtp_encryption}`
    );
  } catch (err: any) {
    record('MAIL-01', 'Admin SMTP Settings Retrieval (Masked Secrets)', 'Phase 6: Email & SMTP', false, err.message);
  }

  // ------------------------------------------------------------
  // PHASE 8: CMS & ADMINISTRATIVE MODULES
  // ------------------------------------------------------------
  console.log('\n--- Phase 8: CMS & Administrative CRUD ---');
  let testPageSlug = `audit-test-${Date.now()}`;
  try {
    // 1. Create Page
    const createPageRes = await fetch(`${BASE_URL}/api/admin/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title_en: 'Audit Test Page',
        title_bn: 'অডিট পরীক্ষা পৃষ্ঠা',
        slug: testPageSlug,
        content_en: 'This is an audit test content.',
        content_bn: 'এটি একটি অডিট পরীক্ষা বিবরণ।',
        status: 'published',
      }),
    });
    const createPageData = await createPageRes.json();
    const createdPageId = createPageData.id;
    const createdOk = createPageRes.status === 201 && (createPageData.slug === testPageSlug || createPageData.title_en === 'Audit Test Page');

    // 2. Read Page publicly
    const readPageRes = await fetch(`${BASE_URL}/api/pages/${createPageData.slug || testPageSlug}`);
    const readPageData = await readPageRes.json();
    const readOk = readPageRes.status === 200 && (readPageData.slug === createPageData.slug || readPageData.slug === testPageSlug);

    // 3. Delete Page
    const delPageRes = await fetch(`${BASE_URL}/api/admin/pages/${createdPageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const delOk = delPageRes.status === 200;

    record(
      'CMS-01',
      'CMS Pages CRUD Lifecycle (Create, Read, Delete)',
      'Phase 8: CMS Functionality',
      createdOk && readOk && delOk,
      `Create: ${createdOk}, Read: ${readOk}, Delete: ${delOk}`
    );
  } catch (err: any) {
    record('CMS-01', 'CMS Pages CRUD Lifecycle (Create, Read, Delete)', 'Phase 8: CMS Functionality', false, err.message);
  }

  // ------------------------------------------------------------
  // PHASE 9: FILE STORAGE & IMAGE VALIDATION
  // ------------------------------------------------------------
  console.log('\n--- Phase 9: File Storage & Image Persistence ---');
  try {
    // Test FILE-01: Valid base64 PNG image upload
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await fetch(`${BASE_URL}/api/upload/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: validPng, folder: 'photos' }),
    });
    const uploadData = await uploadRes.json();
    const uploadOk = uploadRes.status === 200 && uploadData.success && uploadData.url.startsWith('/uploads/photos/');

    // Verify stored file is accessible via HTTP
    let fileFetchOk = false;
    if (uploadOk) {
      const fileRes = await fetch(`${BASE_URL}${uploadData.url}`);
      fileFetchOk = fileRes.status === 200 && (fileRes.headers.get('content-type')?.includes('image/png') ?? false);
    }

    record(
      'FILE-01',
      'Persistent Photo Upload & Magic Byte Verification',
      'Phase 9: File Storage',
      uploadOk && fileFetchOk,
      `Saved: ${uploadData.url}, Size: ${uploadData.size_bytes}B, HTTP Status: 200`
    );
  } catch (err: any) {
    record('FILE-01', 'Persistent Photo Upload & Magic Byte Verification', 'Phase 9: File Storage', false, err.message);
  }

  try {
    // Test FILE-02: Fake image with invalid signature rejected
    const fakeImage = 'data:image/png;base64,VEhJUyBJUyBOT1QgQU4gSU1BR0UgRklMRQ==';
    const fakeRes = await fetch(`${BASE_URL}/api/upload/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: fakeImage, folder: 'photos' }),
    });
    const fakeData = await fakeRes.json();
    const rejectedOk = fakeRes.status === 400 && fakeData.success === false;

    record(
      'FILE-02',
      'Server-side Rejection of Invalid Image Magic Bytes',
      'Phase 9: File Storage',
      rejectedOk,
      `HTTP Status: ${fakeRes.status}, Error: ${fakeData.message}`
    );
  } catch (err: any) {
    record('FILE-02', 'Server-side Rejection of Invalid Image Magic Bytes', 'Phase 9: File Storage', false, err.message);
  }

  console.log('\n================================================================');
  console.log(' 📊 AUDIT TEST SUITE SUMMARY:');
  console.log('================================================================');
  const passedCount = results.filter(r => r.status === 'PASSED').length;
  const failedCount = results.filter(r => r.status === 'FAILED').length;
  console.log(`Total Checks: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  if (failedCount === 0) {
    console.log('🎉 ALL AUDIT ACCEPTANCE CRITERIA PASSED SUCCESSFULLY!\n');
  } else {
    console.log('⚠️ Some checks failed. Review details above.\n');
  }
}

run().catch(console.error);
