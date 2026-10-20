import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { db, portableDb } from './server/db';
import { initialProgramSchedule, initialRegistrationFields, initialTokenFormatConfig, initialHeroConfig, initialRegistrationConfirmationConfig } from './server/seedData';
import { AuthService, authenticate, requireRole, requirePermission, AuthRequest } from './server/auth';
import { BatchService } from './server/services/batchService';
import { PaymentService, PaymentManager } from './server/services/paymentService';
import { PaymentController } from './server/controllers/paymentController';
import { TokenService } from './server/services/tokenService';
import { InstallerService } from './server/installer';
import { DatabaseReadinessService } from './server/services/databaseReadinessService';
import { DatabaseDiagnosticService } from './server/services/databaseDiagnosticService';
import {
  Registration,
  User,
  Committee,
  CommitteeMemberItem,
  CommitteeDesignation,
  OfflineRegistrationCenter,
  SchoolInfo,
  CMSPage,
  NavigationMenuItem,
  FAQItem,
  PaymentGatewayConfig,
  RegistrationConfig,
  RegistrationConfirmationConfig,
  TokenFormatConfig,
  BatchConfig,
  CustomRole,
  NewsPost,
  GateItem,
  HeroConfig,
  MediaItem,
} from './src/types';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { generateEntryPassPDF } from './server/services/pdfService';
import { MailService } from './server/services/mailService';
import { FileStorageService } from './server/services/fileStorageService';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  const app = express();

  // Configure body limit to handle image uploads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Ensure persistent file upload directories exist and mount static route
  FileStorageService.ensureUploadDirs();
  const uploadsStaticPath = path.join(process.cwd(), 'public', 'uploads');
  app.use('/uploads', express.static(uploadsStaticPath));

  // Request audit logging
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') && req.method !== 'GET') {
      console.log(`[API ${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Nanupur Abu Sobhan High School Alumni Platform',
      anniversary: '85th Anniversary Celebration 2027',
      time: new Date().toISOString(),
    });
  });

  // ==========================================
  // SYSTEM & DATABASE READINESS ENDPOINTS
  // ==========================================
  app.get('/api/system/db-status', async (req, res) => {
    try {
      const report = await DatabaseReadinessService.checkReadiness(false);
      res.json(report);
    } catch (err: any) {
      res.status(503).json({
        state: 'DATABASE_UNAVAILABLE',
        error: DatabaseReadinessService.sanitizeError(err.message),
      });
    }
  });

  app.get('/api/system/test-db', async (req, res) => {
    try {
      const report = await DatabaseReadinessService.checkReadiness(true);
      res.json(report);
    } catch (err: any) {
      res.status(503).json({
        state: 'DATABASE_UNAVAILABLE',
        error: DatabaseReadinessService.sanitizeError(err.message),
      });
    }
  });

  // Diagnostic endpoint: Logs current database connection settings (excluding password)
  // and reports the origin of credentials to secure internal log file storage/logs/database-connection-diagnostic.log
  app.get('/api/system/db-diagnostic', async (req, res) => {
    try {
      const report = await DatabaseDiagnosticService.runDiagnostics();
      const statusCode = (!report.connection_test.connected || report.root_fallback_risk.is_currently_root) ? 503 : 200;
      res.status(statusCode).json(report);
    } catch (err: any) {
      res.status(500).json({
        status: 'ERROR',
        message: err.message,
      });
    }
  });

  app.post('/api/system/db-diagnostic/log', async (req, res) => {
    try {
      const context = req.body || {};
      const report = await DatabaseDiagnosticService.runDiagnostics(context);
      res.json({
        success: true,
        message: 'Database connection diagnostics recorded to secure internal log.',
        log_path: report.log_file_path,
        status: report.status,
        summary: {
          driver: report.active_configuration.driver,
          host: report.active_configuration.host,
          database: report.active_configuration.database,
          username: report.active_configuration.username,
          is_root: report.root_fallback_risk.is_currently_root,
          connected: report.connection_test.connected,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  });

  app.post('/api/system/switch-driver', async (req, res) => {
    try {
      const { driver, credentials } = req.body;
      if (!['local', 'mysql', 'supabase', 'postgres'].includes(driver)) {
        return res.status(400).json({ success: false, message: 'Invalid database driver.' });
      }
      const installedPath = path.join(process.cwd(), 'data', 'installed.json');
      if (fs.existsSync(installedPath)) {
        try {
          const content = JSON.parse(fs.readFileSync(installedPath, 'utf-8'));
          content.driver = driver;
          fs.writeFileSync(installedPath, JSON.stringify(content, null, 2), 'utf-8');
        } catch {}
      }
      if (driver === 'local') {
        process.env.DB_CONNECTION = 'local';
      } else if (driver === 'mysql' && credentials) {
        if (!credentials.username || (credentials.username === 'root' && !credentials.password)) {
          return res.status(400).json({ success: false, message: 'Valid MySQL username and password are required. Unauthenticated root connections are prohibited.' });
        }
        process.env.DB_CONNECTION = 'mysql';
        process.env.DB_HOST = credentials.host || '127.0.0.1';
        process.env.DB_PORT = String(credentials.port || 3306);
        process.env.DB_DATABASE = credentials.database || 'nash_alumni';
        process.env.DB_USERNAME = credentials.username;
        if (credentials.password !== undefined) process.env.DB_PASSWORD = credentials.password;
      } else if ((driver === 'supabase' || driver === 'postgres') && credentials) {
        process.env.DB_CONNECTION = 'supabase';
        if (credentials.connectionString) process.env.DATABASE_URL = credentials.connectionString;
      }
      await portableDb.reconnect();
      const report = await DatabaseReadinessService.checkReadiness(true);
      res.json({ success: true, report });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // INSTALLATION & DATABASE SETUP WIZARD
  // ==========================================
  app.get('/api/setup/status', async (req, res) => {
    const report = await DatabaseReadinessService.checkReadiness(false);
    const installerStatus = InstallerService.getStatus();
    res.json({
      ...installerStatus,
      state: report.state,
      database_connected: report.database_connected,
      schema_valid: report.schema_valid,
      driver: report.driver,
      host: report.host_masked,
      db_error: report.sanitized_error,
    });
  });

  app.post('/api/setup/test-connection', async (req, res) => {
    try {
      const status = InstallerService.getStatus();
      if (status.is_installed) {
        // When installed, only authorized Super Admin may test database connectivity
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        const user = token ? AuthService.verifyToken(token) : null;
        if (!user || user.role !== 'super_admin') {
          return res.status(403).json({
            success: false,
            message: 'Application is already installed. Testing database connections requires Super Admin authorization.',
          });
        }
      }
      const result = await InstallerService.testConnection(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Database connection test failed' });
    }
  });

  app.post('/api/setup/install', async (req, res) => {
    try {
      const status = InstallerService.getStatus();
      if (status.is_installed) {
        return res.status(403).json({
          success: false,
          error: 'ALREADY_INSTALLED',
          message: 'Security Alert: Application is already installed and locked. Re-running the installation wizard is strictly prohibited to prevent unauthorized configuration.',
        });
      }
      const result = await InstallerService.install(req.body);
      // Force refresh of readiness cache after installation
      await DatabaseReadinessService.checkReadiness(true);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Installation failed' });
    }
  });

  // Centralized Mandatory Database Readiness & Application State Gate Middleware
  app.use(DatabaseReadinessService.createMiddleware());

  // ==========================================
  // AUTHENTICATION & IDENTITY
  // ==========================================
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { emailOrPhone, username, email, credential, identifier, password } = req.body;
      const cred = (username || emailOrPhone || email || credential || identifier || '').trim();
      const pass = (password || '').trim();

      if (!cred) {
        return res.status(400).json({ success: false, message: 'Username, email, or mobile number is required.' });
      }
      if (!pass) {
        return res.status(400).json({ success: false, message: 'Password is required.' });
      }

      // Query database/cache for user (checks memory and Supabase PostgreSQL users table)
      const user = await db.getUserByCredential(cred);

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials. Account not found.' });
      }

      if (user.status === 'suspended' || user.status === 'blocked' || user.status === 'inactive') {
        return res.status(403).json({ success: false, message: `Account is ${user.status}. Please contact the alumni secretariat.` });
      }

      // Verify Password strictly via standard bcrypt
      if (!user.password_hash) {
        return res.status(401).json({ success: false, message: 'Password has not been initialized for this account.' });
      }

      let isPasswordValid = false;
      if (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')) {
        isPasswordValid = bcrypt.compareSync(pass, user.password_hash);
      } else {
        // Migration fallback for legacy hash
        isPasswordValid = (user.password_hash === pass);
        if (isPasswordValid) {
          const upgradedHash = bcrypt.hashSync(pass, 10);
          await db.updateUserPassword(user.id, upgradedHash);
        }
      }

      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: 'Incorrect password. Please verify and try again.' });
      }

      const token = AuthService.generateToken(user);
      db.logAudit(user.name, user.email, 'LOGIN', 'Auth', `User logged in successfully (${user.role})`);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          name_bn: user.name_bn,
          email: user.email,
          phone: user.phone,
          role: user.role,
          batch: user.batch,
          status: user.status,
          dob: user.dob,
          gender: user.gender,
          blood_group: user.blood_group,
          photo_url: user.photo_url,
          passing_year: user.passing_year,
          created_at: user.created_at,
        },
      });
    } catch (err: any) {
      console.error('Login processing error:', err);
      res.status(500).json({ success: false, message: 'Authentication service encountered an error.' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, phone, password, passing_year, batch, gender, blood_group } = req.body;
      if (!name || !email || !phone || !password) {
        return res.status(400).json({ success: false, message: 'Full name, email, mobile phone, and password are required.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
      }

      const existingEmail = await db.getUserByCredential(email);
      const existingPhone = await db.getUserByCredential(phone);
      if (existingEmail || existingPhone) {
        return res.status(400).json({ success: false, message: 'An account with this email address or mobile phone already exists.' });
      }

      const users = db.get('users') || [];
      const requestedUsername = (req.body.username || email.split('@')[0] || `alumni_${phone.slice(-4)}`).trim();
      const cleanUsername = requestedUsername.toLowerCase();

      // Enforce global username uniqueness (Application & Database level)
      const existingUserByUsername = await db.getUserByCredential(cleanUsername);
      if (existingUserByUsername || users.some(u => (u.username || '').trim().toLowerCase() === cleanUsername)) {
        return res.status(422).json({
          success: false,
          message: 'This username is already taken. Please choose another username.',
          message_bn: 'এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হয়েছে। অনুগ্রহ করে অন্য একটি ইউজারনেম বেছে নিন।'
        });
      }

      const yearNum = parseInt(passing_year, 10) || 2008;
      const batchInfo = BatchService.getBatchByPassingYear(yearNum);
      const newUser: User = {
        id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        username: cleanUsername,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password_hash: bcrypt.hashSync(password, 10),
        role: 'alumni_member',
        passing_year: yearNum,
        batch: batch || batchInfo.batch_name,
        gender: gender || 'male',
        blood_group: blood_group || undefined,
        status: 'active',
        created_at: new Date().toISOString(),
      };

      users.push(newUser);
      db.set('users', users);

      const token = AuthService.generateToken(newUser);
      db.logAudit(newUser.name, newUser.email, 'REGISTER', 'Auth', 'New alumnus registered an account');

      const { password_hash, ...safeUser } = newUser;
      res.status(201).json({
        success: true,
        message: 'Registration successful! You are now logged in.',
        token,
        user: safeUser,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Registration failed: ' + err.message });
    }
  });


  // Request Password Reset / Verify Account
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier || !identifier.trim()) {
        return res.status(400).json({ success: false, message: 'Please provide your email, username, or phone number.' });
      }

      const user = await db.getUserByCredential(identifier.trim());
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'No account found matching this email, username, or phone number.',
        });
      }

      res.json({
        success: true,
        verified: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone ? `***${user.phone.slice(-4)}` : '',
          passing_year: user.passing_year,
          requires_passing_year: !!user.passing_year,
        },
        message: 'Account verified. Please confirm your SSC passing year and choose a new password.',
      });
    } catch (err: any) {
      console.error('Forgot password error:', err);
      res.status(500).json({ success: false, message: 'Failed to process password reset request.' });
    }
  });

  // Execute Password Reset
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { identifier, passing_year, new_password } = req.body;
      if (!identifier || !identifier.trim()) {
        return res.status(400).json({ success: false, message: 'Account identifier is required.' });
      }
      if (!new_password || new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
      }

      const user = await db.getUserByCredential(identifier.trim());
      if (!user) {
        return res.status(404).json({ success: false, message: 'User account not found.' });
      }

      // If user has a passing year, verify it as security question
      if (user.passing_year && passing_year) {
        const enteredYear = parseInt(passing_year, 10);
        if (enteredYear !== user.passing_year) {
          return res.status(400).json({
            success: false,
            message: 'Passing year verification failed. Please enter your correct SSC passing year.',
          });
        }
      }

      // Hash and update password in both cache and Supabase
      const newHash = bcrypt.hashSync(new_password, 10);
      await db.updateUserPassword(user.id, newHash);

      db.logAudit(
        user.name,
        user.email,
        'PASSWORD_RESET',
        'Auth',
        `User successfully reset their password via verification (${user.username || user.email})`
      );

      // Generate a fresh token for immediate convenience
      const token = AuthService.generateToken(user);
      const { password_hash, ...safeUser } = user;

      res.json({
        success: true,
        message: 'Your password has been reset successfully! You are now signed in.',
        token,
        user: safeUser,
      });
    } catch (err: any) {
      console.error('Reset password error:', err);
      res.status(500).json({ success: false, message: 'Failed to reset password. Please try again.' });
    }
  });

  app.post('/api/auth/change-password', authenticate, async (req: AuthRequest, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    const users = db.get('users') || [];
    const user = users.find(u => u.id === req.user?.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.password_hash && !bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(400).json({ message: 'Current password does not match.' });
    }

    const newHash = bcrypt.hashSync(new_password, 10);
    user.password_hash = newHash;
    db.set('users', users);
    await db.updateUserPassword(user.id, newHash);

    db.logAudit(user.name, user.email, 'CHANGE_PASSWORD', 'Auth', 'User changed their own account password');
    res.json({ success: true, message: 'Password updated successfully.' });
  });

  app.get('/api/auth/me', authenticate, (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/logout', authenticate, (req: AuthRequest, res) => {
    if (req.user) {
      db.logAudit(req.user.name, req.user.email, 'LOGOUT', 'Auth', `User logged out successfully (${req.user.role})`);
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  // ==========================================
  // GLOBAL SETTINGS & APPEARANCE (CMS)
  // ==========================================
  app.get('/api/settings', (req, res) => {
    const globalSettings = db.get('global_settings');
    const legacy = db.get('settings');
    const regConfig = db.get('registration_config');
    res.json({
      ...legacy,
      ...globalSettings,
      registration_fee: regConfig?.fee_amount || legacy?.registration_fee || 1000,
      currency: regConfig?.currency || legacy?.currency || 'BDT',
      registration_open: regConfig?.is_enabled ?? legacy?.registration_open ?? true,
    });
  });

  app.put('/api/admin/settings', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const legacy = db.get('settings') || ({} as any);
    const updated = { ...legacy, ...req.body };
    db.set('settings', updated);

    // Synchronize with registration_config
    const regConfig = db.get('registration_config');
    if (regConfig) {
      if (req.body.registration_fee !== undefined) regConfig.fee_amount = Number(req.body.registration_fee);
      if (req.body.currency !== undefined) regConfig.currency = req.body.currency;
      if (req.body.registration_open !== undefined) regConfig.is_enabled = Boolean(req.body.registration_open);
      if (req.body.registration_deadline !== undefined) regConfig.end_date = req.body.registration_deadline;
      db.set('registration_config', regConfig);
    }

    // Synchronize with batch_config if base year provided
    if (req.body.batch_base_year !== undefined) {
      const batchConfig = db.get('batch_config');
      if (batchConfig) {
        batchConfig.reference_year = Number(req.body.batch_base_year);
        db.set('batch_config', batchConfig);
      }
    }

    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'UPDATE_SETTINGS',
      'Settings',
      `Updated registration settings: Fee ৳${req.body.registration_fee ?? legacy.registration_fee ?? 1000}, Open: ${req.body.registration_open ?? legacy.registration_open ?? true}`
    );
    res.json(updated);
  });

  // ==========================================
  // DATABASE SETTINGS TABLE (MIGRATION & CMS)
  // ==========================================
  app.get('/api/settings/table', (req, res) => {
    res.json({
      success: true,
      settings: db.getAllSettings(),
    });
  });

  app.get('/api/settings/item/:key', (req, res) => {
    const val = db.getSetting(req.params.key);
    if (val === null) {
      return res.status(404).json({ success: false, message: `Setting "${req.params.key}" not found in settings table.` });
    }
    const item = db.getAllSettings().find(s => s.key === req.params.key);
    res.json({ success: true, key: req.params.key, value: val, item });
  });

  app.put('/api/admin/settings/item/:key', authenticate, requireRole(['super_admin', 'admin']), async (req: AuthRequest, res) => {
    try {
      const { key } = req.params;
      const { value, group, description } = req.body;

      if (value === undefined || value === null) {
        return res.status(400).json({ success: false, message: 'Setting value is required.' });
      }

      const valString = String(value).trim();

      // Specific validation for registration_image_max_size
      if (key === 'registration_image_max_size') {
        const num = parseFloat(valString);
        if (isNaN(num) || num < 0.1 || num > 25) {
          return res.status(400).json({
            success: false,
            message: 'Invalid registration image max size. Please specify a numeric value between 0.1 MB and 25 MB.',
          });
        }
      }

      const updatedItem = await db.setSetting(key, valString, group, description);
      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'UPDATE_SETTING_TABLE',
        'SettingsTable',
        `Updated settings table key "${key}" to "${valString}" (${group || 'general'})`
      );

      res.json({
        success: true,
        message: `Setting "${key}" updated successfully in database settings table.`,
        setting: updatedItem,
        settings: db.getAllSettings(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Failed to update setting: ' + err.message });
    }
  });

  app.put('/api/admin/settings/registration-image-size', authenticate, requireRole(['super_admin', 'admin']), async (req: AuthRequest, res) => {
    try {
      const rawVal = req.body.size_mb ?? req.body.value ?? req.body.max_image_size_mb;
      const num = parseFloat(rawVal);
      if (isNaN(num) || num < 0.1 || num > 25) {
        return res.status(400).json({
          success: false,
          message: 'Invalid registration image size limit. Value must be a valid number between 0.1 MB and 25 MB.',
        });
      }

      const valString = String(num);
      const updatedItem = await db.setSetting(
        'registration_image_max_size',
        valString,
        'registration',
        'Maximum allowed registration photograph file size in Megabytes (MB). Default: 1.5MB.',
        'numeric'
      );

      // Keep registration_config synchronized
      const regConfig = db.get('registration_config') || ({} as any);
      regConfig.max_image_size_mb = num;
      db.set('registration_config', regConfig);

      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'UPDATE_IMAGE_MAX_SIZE',
        'SettingsTable',
        `Updated registration_image_max_size to ${num} MB in settings table`
      );

      res.json({
        success: true,
        message: `Registration image size limit updated to ${num} MB successfully in database settings table.`,
        setting: updatedItem,
        registration_image_max_size: num,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Failed to update image size setting: ' + err.message });
    }
  });

  app.get('/api/global-settings', (req, res) => {
    res.json(db.get('global_settings'));
  });

  app.put('/api/admin/global-settings', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const current = db.get('global_settings');
    const updated = { ...current, ...req.body };
    db.set('global_settings', updated);

    // Sync legacy settings for backwards compatibility
    const legacy = db.get('settings');
    db.set('settings', {
      ...legacy,
      site_name_en: updated.site_name_en,
      site_name_bn: updated.site_name_bn,
      contact_phone: updated.contact_phone,
      contact_email: updated.contact_email,
      address_en: updated.address_en,
      address_bn: updated.address_bn,
    });

    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'UPDATE_GLOBAL_SETTINGS',
      'Settings',
      'Updated global website settings, typography, and branding'
    );
    res.json(updated);
  });

  // Header and TopBar
  app.get('/api/appearance/header', (req, res) => {
    res.json(db.get('header_config'));
  });

  app.put('/api/admin/appearance/header', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const current = db.get('header_config');
    const updated = { ...current, ...req.body };
    db.set('header_config', updated);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_HEADER', 'Appearance', 'Updated header configuration');
    res.json(updated);
  });

  app.get('/api/appearance/topbar', (req, res) => {
    res.json(db.get('top_bar_config'));
  });

  app.put('/api/admin/appearance/topbar', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const current = db.get('top_bar_config');
    const updated = { ...current, ...req.body };
    db.set('top_bar_config', updated);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_TOPBAR', 'Appearance', 'Updated topbar notification banner');
    res.json(updated);
  });

  // Hero Section Configuration
  app.get('/api/appearance/hero', (req, res) => {
    const hero = db.get('hero_config') || initialHeroConfig;
    res.json(hero);
  });

  app.put('/api/admin/appearance/hero', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const current = db.get('hero_config') || initialHeroConfig;
    const updated: HeroConfig = {
      ...current,
      ...req.body,
      updated_at: new Date().toISOString(),
    };
    db.set('hero_config', updated);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_HERO', 'Appearance', 'Updated homepage hero section texts, labels, CTA buttons, and background settings');
    res.json(updated);
  });

  // Navigation Menus
  app.get('/api/appearance/menus', (req, res) => {
    const rawMenus = db.get('menus') || [];
    // Ensure all items and any nested children are exposed with parent_id for uniform handling
    const result: NavigationMenuItem[] = [];
    const seenIds = new Set<string>();

    rawMenus.forEach((item: NavigationMenuItem) => {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        result.push(item);
      }
      if (item.children && Array.isArray(item.children)) {
        item.children.forEach((child: NavigationMenuItem) => {
          if (!seenIds.has(child.id)) {
            seenIds.add(child.id);
            result.push({ ...child, parent_id: child.parent_id || item.id });
          }
        });
      }
    });

    res.json(result.sort((a, b) => (a.order || 0) - (b.order || 0)));
  });

  app.post('/api/admin/appearance/menus', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    let menus = db.get('menus') || [];
    const newItem: NavigationMenuItem = {
      ...req.body,
      id: req.body.id || `menu-${Date.now()}`,
      order: req.body.order || menus.length + 1,
      is_active: req.body.is_active ?? true,
    };

    if (newItem.parent_id) {
      // If it has a parent_id, attach to parent.children if parent exists
      const parent = menus.find(m => m.id === newItem.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(newItem);
      } else {
        menus.push(newItem);
      }
    } else {
      menus.push(newItem);
    }

    db.set('menus', menus);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_MENU_ITEM', 'Menus', `Added menu: ${newItem.label_en}`);
    res.status(201).json(newItem);
  });

  app.put('/api/admin/appearance/menus/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    let menus = db.get('menus') || [];
    const targetId = req.params.id;
    let foundItem: NavigationMenuItem | null = null;

    // 1. Check top-level
    const topIndex = menus.findIndex(m => m.id === targetId);
    if (topIndex !== -1) {
      menus[topIndex] = { ...menus[topIndex], ...req.body, id: targetId };
      foundItem = menus[topIndex];
    } else {
      // 2. Check inside children
      menus = menus.map(parent => {
        if (parent.children && Array.isArray(parent.children)) {
          const childIdx = parent.children.findIndex(c => c.id === targetId);
          if (childIdx !== -1) {
            parent.children[childIdx] = { ...parent.children[childIdx], ...req.body, id: targetId };
            foundItem = parent.children[childIdx];
          }
        }
        return parent;
      });
    }

    if (!foundItem) {
      // In case it wasn't in db array, push it
      foundItem = { ...req.body, id: targetId };
      menus.push(foundItem);
    }

    db.set('menus', menus);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_MENU_ITEM', 'Menus', `Updated menu: ${foundItem.label_en || targetId}`);
    res.json(foundItem);
  });

  app.patch('/api/admin/appearance/menus/:id/toggle', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    let menus = db.get('menus') || [];
    const targetId = req.params.id;
    let targetItem: NavigationMenuItem | null = null;

    // Helper to toggle recursively
    const toggleInList = (list: NavigationMenuItem[]): NavigationMenuItem[] => {
      return list.map(item => {
        if (item.id === targetId) {
          const nextState = !item.is_active;
          targetItem = { ...item, is_active: nextState };
          return targetItem;
        }
        if (item.children && Array.isArray(item.children)) {
          return { ...item, children: toggleInList(item.children) };
        }
        return item;
      });
    };

    menus = toggleInList(menus);
    db.set('menus', menus);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'TOGGLE_MENU_ITEM', 'Menus', `Toggled menu ${targetId} active state to ${targetItem?.is_active}`);
    res.json({ success: true, item: targetItem, menus });
  });

  app.delete('/api/admin/appearance/menus/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const deleteId = req.params.id;
    let menus = db.get('menus') || [];

    // Helper to filter out recursively
    const removeRecursively = (list: NavigationMenuItem[]): NavigationMenuItem[] => {
      return list
        .filter(m => m.id !== deleteId && m.parent_id !== deleteId)
        .map(m => {
          if (m.children && Array.isArray(m.children)) {
            return {
              ...m,
              children: removeRecursively(m.children),
            };
          }
          return m;
        });
    };

    menus = removeRecursively(menus);
    db.set('menus', menus);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_MENU_ITEM', 'Menus', `Permanently deleted menu item ${deleteId}`);
    res.json({ success: true, deleted_id: deleteId, message: `Menu item ${deleteId} removed successfully.` });
  });

  // Footer Configuration
  app.get('/api/appearance/footer', (req, res) => {
    res.json(db.get('footer_config'));
  });

  app.put('/api/admin/appearance/footer', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const current = db.get('footer_config');
    const updated = { ...current, ...req.body };
    db.set('footer_config', updated);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_FOOTER', 'Appearance', 'Updated footer configuration and columns');
    res.json(updated);
  });

  // Appearance & Framer Motion Animations Configuration
  app.get('/api/appearance/animations', (req, res) => {
    const defaultAnimations = {
      is_enabled: true,
      preset: 'smooth',
      duration: 0.5,
      default_delay: 0,
      stagger_delay: 0.08,
      scroll_triggered: true,
      hover_effects: true,
      play_mode: 'once',
      intensity: 'standard',
      respect_reduced_motion: true,

      enable_homepage: true,
      enable_header_nav: true,
      enable_hero_animations: true,
      enable_stats_cards: true,
      enable_notices_news: true,
      enable_events_schedule: true,
      enable_forms_inputs: true,
      enable_member_portal: true,
      enable_admin_interface: true,
      enable_page_transitions: true,
      enable_card_reveals: true,
      enable_button_hover: true,
      enable_counter_animations: true,
      updated_at: new Date().toISOString(),
    };
    const animConfig = db.get('animations_config') || defaultAnimations;
    res.json(animConfig);
  });

  app.put('/api/admin/appearance/animations', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const current: any = db.get('animations_config') || {
      is_enabled: true,
      preset: 'smooth',
      duration: 0.5,
      default_delay: 0,
      stagger_delay: 0.08,
      scroll_triggered: true,
      hover_effects: true,
      play_mode: 'once',
      intensity: 'standard',
      respect_reduced_motion: true,

      enable_homepage: true,
      enable_header_nav: true,
      enable_hero_animations: true,
      enable_stats_cards: true,
      enable_notices_news: true,
      enable_events_schedule: true,
      enable_forms_inputs: true,
      enable_member_portal: true,
      enable_admin_interface: true,
      enable_page_transitions: true,
      enable_card_reveals: true,
      enable_button_hover: true,
      enable_counter_animations: true,
    };

    // Strict allowlist validation
    const allowedPresets = ['minimal', 'subtle', 'smooth', 'dynamic', 'energetic', 'disabled'];
    const preset = allowedPresets.includes(req.body.preset) ? req.body.preset : current.preset;

    const rawDuration = parseFloat(req.body.duration);
    const duration = !isNaN(rawDuration) && rawDuration >= 0.1 && rawDuration <= 2.0 ? rawDuration : current.duration;

    const rawDefaultDelay = parseFloat(req.body.default_delay);
    const default_delay = !isNaN(rawDefaultDelay) && rawDefaultDelay >= 0 && rawDefaultDelay <= 1.5 ? rawDefaultDelay : (current.default_delay ?? 0);

    const rawStagger = parseFloat(req.body.stagger_delay);
    const stagger_delay = !isNaN(rawStagger) && rawStagger >= 0.02 && rawStagger <= 0.5 ? rawStagger : current.stagger_delay;

    const allowedPlayModes = ['once', 'repeat'];
    const play_mode = allowedPlayModes.includes(req.body.play_mode) ? req.body.play_mode : (current.play_mode ?? 'once');

    const allowedIntensities = ['subtle', 'standard', 'high'];
    const intensity = allowedIntensities.includes(req.body.intensity) ? req.body.intensity : (current.intensity ?? 'standard');

    const updated = {
      ...current,
      is_enabled: typeof req.body.is_enabled === 'boolean' ? req.body.is_enabled : current.is_enabled,
      preset,
      duration,
      default_delay,
      stagger_delay,
      scroll_triggered: typeof req.body.scroll_triggered === 'boolean' ? req.body.scroll_triggered : (current.scroll_triggered ?? true),
      hover_effects: typeof req.body.hover_effects === 'boolean' ? req.body.hover_effects : (current.hover_effects ?? true),
      play_mode,
      intensity,
      respect_reduced_motion: typeof req.body.respect_reduced_motion === 'boolean' ? req.body.respect_reduced_motion : current.respect_reduced_motion,

      // Granular section toggles
      enable_homepage: typeof req.body.enable_homepage === 'boolean' ? req.body.enable_homepage : (current.enable_homepage ?? true),
      enable_header_nav: typeof req.body.enable_header_nav === 'boolean' ? req.body.enable_header_nav : (current.enable_header_nav ?? true),
      enable_hero_animations: typeof req.body.enable_hero_animations === 'boolean' ? req.body.enable_hero_animations : current.enable_hero_animations,
      enable_stats_cards: typeof req.body.enable_stats_cards === 'boolean' ? req.body.enable_stats_cards : (current.enable_stats_cards ?? true),
      enable_notices_news: typeof req.body.enable_notices_news === 'boolean' ? req.body.enable_notices_news : (current.enable_notices_news ?? true),
      enable_events_schedule: typeof req.body.enable_events_schedule === 'boolean' ? req.body.enable_events_schedule : (current.enable_events_schedule ?? true),
      enable_forms_inputs: typeof req.body.enable_forms_inputs === 'boolean' ? req.body.enable_forms_inputs : (current.enable_forms_inputs ?? true),
      enable_member_portal: typeof req.body.enable_member_portal === 'boolean' ? req.body.enable_member_portal : (current.enable_member_portal ?? true),
      enable_admin_interface: typeof req.body.enable_admin_interface === 'boolean' ? req.body.enable_admin_interface : (current.enable_admin_interface ?? true),
      enable_page_transitions: typeof req.body.enable_page_transitions === 'boolean' ? req.body.enable_page_transitions : current.enable_page_transitions,
      enable_card_reveals: typeof req.body.enable_card_reveals === 'boolean' ? req.body.enable_card_reveals : current.enable_card_reveals,
      enable_button_hover: typeof req.body.enable_button_hover === 'boolean' ? req.body.enable_button_hover : current.enable_button_hover,
      enable_counter_animations: typeof req.body.enable_counter_animations === 'boolean' ? req.body.enable_counter_animations : current.enable_counter_animations,
      updated_at: new Date().toISOString(),
    };

    db.set('animations_config', updated);
    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'UPDATE_ANIMATIONS',
      'Appearance',
      `Updated website motion system settings (Enabled: ${updated.is_enabled}, Preset: ${updated.preset}, Duration: ${updated.duration}s)`
    );
    res.json(updated);
  });

  // ==========================================
  // CMS PAGES & BUILDER MODULE
  // ==========================================
  app.get('/api/pages', (req, res) => {
    const pages = db.get('pages') || [];
    res.json(pages.filter(p => p.status === 'published'));
  });

  app.get('/api/pages/:slug', (req, res) => {
    const pages = db.get('pages') || [];
    const requestedSlug = req.params.slug;
    let page = pages.find(p => p.slug === requestedSlug || p.id === requestedSlug);
    if (!page) {
      if (requestedSlug === 'school') page = pages.find(p => p.slug === 'school-heritage' || p.id === 'page-school');
      else if (requestedSlug === 'association') page = pages.find(p => p.slug === 'alumni-association' || p.id === 'page-association');
      else if (requestedSlug === 'about') page = pages.find(p => p.slug === 'about' || p.id === 'page-about');
    }
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }
    res.json(page);
  });

  app.get('/api/admin/pages', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req, res) => {
    res.json(db.get('pages') || []);
  });

  app.post('/api/admin/pages', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const pages = db.get('pages') || [];
    const { title_en, title_bn, slug, sections, status } = req.body;

    const pageSlug = (slug || title_en || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const newPage: CMSPage = {
      id: `page-${Date.now()}`,
      slug: pageSlug,
      title_en: title_en || 'Untitled Page',
      title_bn: title_bn || 'শিরোনামহীন পাতা',
      status: status || 'draft',
      sections: sections || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    pages.push(newPage);
    db.set('pages', pages);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_PAGE', 'CMS', `Created page: ${newPage.title_en} (/${newPage.slug})`);
    res.status(201).json(newPage);
  });

  app.put('/api/admin/pages/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const pages = db.get('pages') || [];
    const index = pages.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Page not found' });

    pages[index] = {
      ...pages[index],
      ...req.body,
      updated_at: new Date().toISOString(),
    };
    db.set('pages', pages);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_PAGE', 'CMS', `Updated page: ${pages[index].title_en}`);
    res.json(pages[index]);
  });

  app.delete('/api/admin/pages/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    let pages = db.get('pages') || [];
    pages = pages.filter(p => p.id !== req.params.id);
    db.set('pages', pages);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_PAGE', 'CMS', `Deleted page ${req.params.id}`);
    res.json({ success: true });
  });

  // ==========================================
  // FAQ MANAGEMENT
  // ==========================================
  app.get(['/api/faqs', '/api/faq'], (req, res) => {
    const faqs = db.get('faqs') || [];
    res.json(faqs.filter(f => f.is_active).sort((a, b) => a.order - b.order));
  });

  app.get('/api/admin/faqs', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req, res) => {
    const faqs = db.get('faqs') || [];
    res.json(faqs.sort((a, b) => a.order - b.order));
  });

  app.post('/api/admin/faqs', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const faqs = db.get('faqs') || [];
    const newFaq: FAQItem = {
      id: `faq-${Date.now()}`,
      category: req.body.category || 'General',
      question_en: req.body.question_en,
      question_bn: req.body.question_bn,
      answer_en: req.body.answer_en,
      answer_bn: req.body.answer_bn,
      order: req.body.order || faqs.length + 1,
      is_active: req.body.is_active ?? true,
    };
    faqs.push(newFaq);
    db.set('faqs', faqs);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_FAQ', 'FAQ', `Created FAQ: ${newFaq.question_en}`);
    res.status(201).json(newFaq);
  });

  app.put('/api/admin/faqs/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const faqs = db.get('faqs') || [];
    const index = faqs.findIndex(f => f.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'FAQ not found' });

    faqs[index] = { ...faqs[index], ...req.body };
    db.set('faqs', faqs);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_FAQ', 'FAQ', `Updated FAQ: ${faqs[index].question_en}`);
    res.json(faqs[index]);
  });

  app.delete('/api/admin/faqs/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    let faqs = db.get('faqs') || [];
    faqs = faqs.filter(f => f.id !== req.params.id);
    db.set('faqs', faqs);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_FAQ', 'FAQ', `Deleted FAQ ${req.params.id}`);
    res.json({ success: true });
  });

  // ==========================================
  // NEWS & UPDATES CMS (DATABASE-DRIVEN)
  // ==========================================
  app.get('/api/news', (req, res) => {
    const allNews = db.get('news') || [];
    const { category, search, page = '1', limit = '12' } = req.query;

    let filtered = allNews.filter((item: NewsPost) => item.is_published);

    if (category && category !== 'all' && category !== 'All') {
      const catStr = String(category).toLowerCase();
      filtered = filtered.filter(item => (item.category || '').toLowerCase() === catStr);
    }

    if (search && String(search).trim()) {
      const q = String(search).toLowerCase().trim();
      filtered = filtered.filter(
        item =>
          (item.title_en || '').toLowerCase().includes(q) ||
          (item.title_bn || '').toLowerCase().includes(q) ||
          (item.excerpt_en || '').toLowerCase().includes(q) ||
          (item.excerpt_bn || '').toLowerCase().includes(q) ||
          (item.content_en || '').toLowerCase().includes(q) ||
          (item.content_bn || '').toLowerCase().includes(q) ||
          (item.author || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q)
      );
    }

    // Sort latest first
    filtered.sort((a, b) => new Date(b.publish_date || 0).getTime() - new Date(a.publish_date || 0).getTime());

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(String(limit), 10) || 12));
    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Extract unique categories
    const categories = Array.from(new Set(allNews.filter((i: NewsPost) => i.is_published).map((i: NewsPost) => i.category).filter(Boolean)));

    res.json({
      posts: paginated,
      total,
      page: pageNum,
      totalPages,
      limit: limitNum,
      categories,
    });
  });

  app.get('/api/news/:idOrSlug', (req, res) => {
    const newsList = db.get('news') || [];
    const query = req.params.idOrSlug.toLowerCase();
    const index = newsList.findIndex((item: NewsPost) => item.id.toLowerCase() === query || (item.slug && item.slug.toLowerCase() === query));

    if (index === -1) {
      return res.status(404).json({ message: 'News article not found' });
    }

    // Increment views
    newsList[index].views = (newsList[index].views || 0) + 1;
    db.set('news', newsList);

    res.json(newsList[index]);
  });

  app.get('/api/admin/news', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req, res) => {
    const newsList = db.get('news') || [];
    const sorted = [...newsList].sort(
      (a, b) => new Date(b.publish_date || b.created_at || 0).getTime() - new Date(a.publish_date || a.created_at || 0).getTime()
    );
    res.json(sorted);
  });

  app.post('/api/admin/news', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const newsList = db.get('news') || [];
    const {
      title_en,
      title_bn,
      excerpt_en,
      excerpt_bn,
      content_en,
      content_bn,
      category,
      featured_image,
      author,
      publish_date,
      is_published,
      is_featured,
      slug,
      seo_title,
      seo_description,
    } = req.body;

    const baseSlug = (slug || title_en || 'news-post')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let finalSlug = baseSlug;
    let counter = 1;
    while (newsList.some((n: NewsPost) => n.slug === finalSlug)) {
      finalSlug = `${baseSlug}-${counter++}`;
    }

    const newPost: NewsPost = {
      id: `news-${Date.now()}`,
      slug: finalSlug,
      title_en: title_en || 'Untitled Update',
      title_bn: title_bn || title_en || 'শিরোনামহীন সংবাদ',
      excerpt_en: excerpt_en || (content_en ? content_en.slice(0, 160) + '...' : ''),
      excerpt_bn: excerpt_bn || (content_bn ? content_bn.slice(0, 160) + '...' : ''),
      content_en: content_en || '',
      content_bn: content_bn || content_en || '',
      category: category || 'General Updates',
      featured_image: featured_image || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
      author: author || req.user?.name || 'Alumni Media Wing',
      publish_date: publish_date || new Date().toISOString().slice(0, 10),
      is_published: is_published ?? true,
      is_featured: is_featured ?? false,
      views: 0,
      seo_title: seo_title || title_en,
      seo_description: seo_description || excerpt_en,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    newsList.unshift(newPost);
    db.set('news', newsList);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_NEWS', 'NewsCMS', `Created news post: ${newPost.title_en}`);
    res.status(201).json(newPost);
  });

  app.put('/api/admin/news/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const newsList = db.get('news') || [];
    const index = newsList.findIndex((n: NewsPost) => n.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'News post not found' });

    newsList[index] = {
      ...newsList[index],
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    db.set('news', newsList);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_NEWS', 'NewsCMS', `Updated news post: ${newsList[index].title_en}`);
    res.json(newsList[index]);
  });

  app.patch('/api/admin/news/:id/status', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const newsList = db.get('news') || [];
    const index = newsList.findIndex((n: NewsPost) => n.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'News post not found' });

    newsList[index].is_published = req.body.is_published ?? !newsList[index].is_published;
    newsList[index].updated_at = new Date().toISOString();

    db.set('news', newsList);
    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'TOGGLE_NEWS_STATUS',
      'NewsCMS',
      `Toggled status for: ${newsList[index].title_en} (${newsList[index].is_published ? 'Published' : 'Draft'})`
    );
    res.json(newsList[index]);
  });

  app.delete('/api/admin/news/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    let newsList = db.get('news') || [];
    const post = newsList.find((n: NewsPost) => n.id === req.params.id);
    newsList = newsList.filter((n: NewsPost) => n.id !== req.params.id);
    db.set('news', newsList);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_NEWS', 'NewsCMS', `Deleted news post: ${post?.title_en || req.params.id}`);
    res.json({ success: true });
  });

  // ==========================================
  // GATE MANAGEMENT (DATABASE-DRIVEN)
  // ==========================================
  app.get('/api/gates', (req, res) => {
    const gates = db.get('gates') || [];
    const active = gates.filter((g: GateItem) => g.is_active).sort((a: GateItem, b: GateItem) => a.display_order - b.display_order);
    res.json(active);
  });

  app.get('/api/admin/gates', authenticate, requireRole(['super_admin', 'admin', 'verification_officer']), (req, res) => {
    const gates = db.get('gates') || [];
    const sorted = [...gates].sort((a: GateItem, b: GateItem) => a.display_order - b.display_order);
    res.json(sorted);
  });

  app.post('/api/admin/gates', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const gates = db.get('gates') || [];
    const { gate_name, gate_code, description, display_order, is_active } = req.body;

    const newGate: GateItem = {
      id: `gate-${Date.now()}`,
      gate_name: gate_name || `Gate ${(gates.length + 1).toString().padStart(2, '0')}`,
      gate_code: (gate_code || `GATE-${(gates.length + 1).toString().padStart(2, '0')}`).toUpperCase().trim(),
      description: description || '',
      display_order: display_order !== undefined ? Number(display_order) : gates.length + 1,
      is_active: is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    gates.push(newGate);
    db.set('gates', gates);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_GATE', 'Gates', `Added gate: ${newGate.gate_name} (${newGate.gate_code})`);
    res.status(201).json(newGate);
  });

  app.put('/api/admin/gates/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const gates = db.get('gates') || [];
    const index = gates.findIndex((g: GateItem) => g.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Gate not found' });

    gates[index] = {
      ...gates[index],
      ...req.body,
      gate_code: (req.body.gate_code || gates[index].gate_code).toUpperCase().trim(),
      display_order: req.body.display_order !== undefined ? Number(req.body.display_order) : gates[index].display_order,
      updated_at: new Date().toISOString(),
    };

    db.set('gates', gates);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_GATE', 'Gates', `Updated gate: ${gates[index].gate_name}`);
    res.json(gates[index]);
  });

  app.delete('/api/admin/gates/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    let gates = db.get('gates') || [];
    const gate = gates.find((g: GateItem) => g.id === req.params.id);
    gates = gates.filter((g: GateItem) => g.id !== req.params.id);
    db.set('gates', gates);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_GATE', 'Gates', `Deleted gate: ${gate?.gate_name || req.params.id}`);
    res.json({ success: true });
  });

  // ==========================================
  // PAYMENT GATEWAY MANAGEMENT (ADAPTER PATTERN)
  // ==========================================
  app.get(['/api/payment-gateways', '/api/gateways'], (req, res) => {
    // Sanitized, safe public list of enabled gateways
    res.json(PaymentManager.getPublicGateways());
  });

  app.get('/api/admin/payment-gateways', authenticate, requireRole(['super_admin', 'admin', 'finance_manager']), (req, res) => {
    res.json(db.get('payment_gateways') || []);
  });

  app.post('/api/admin/payment-gateways', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const gateways = db.get('payment_gateways') || [];
    const newGateway: PaymentGatewayConfig = {
      id: `gw-${Date.now()}`,
      code: (req.body.code || 'custom').toLowerCase().trim(),
      name: req.body.name || 'Custom Gateway',
      display_name_en: req.body.display_name_en || req.body.name,
      display_name_bn: req.body.display_name_bn || req.body.name,
      is_enabled: req.body.is_enabled ?? true,
      is_test_mode: req.body.is_test_mode ?? true,
      payment_mode: req.body.payment_mode || 'automatic',
      account_type: req.body.account_type || 'Personal',
      api_key: req.body.api_key || req.body.credentials?.api_key || req.body.credentials?.app_key,
      secret_key: req.body.secret_key || req.body.credentials?.secret_key || req.body.credentials?.app_secret,
      merchant_id: req.body.merchant_id || req.body.credentials?.merchant_id || req.body.credentials?.merchant_number,
      merchant_number: req.body.merchant_number || req.body.credentials?.merchant_number || req.body.merchant_id,
      store_id: req.body.store_id || req.body.credentials?.store_id,
      username: req.body.username || req.body.credentials?.username,
      password: req.body.password || req.body.credentials?.password,
      base_url: req.body.base_url || req.body.credentials?.base_url,
      app_key: req.body.app_key || req.body.api_key || req.body.credentials?.app_key,
      app_secret: req.body.app_secret || req.body.secret_key || req.body.credentials?.app_secret,
      public_key: req.body.public_key || req.body.credentials?.public_key,
      private_key: req.body.private_key || req.body.credentials?.private_key,
      credentials: req.body.credentials || {
        payment_mode: req.body.payment_mode || 'automatic',
        account_type: req.body.account_type || 'Personal',
        merchant_number: req.body.merchant_number || req.body.merchant_id,
        merchant_id: req.body.merchant_id || req.body.merchant_number,
        app_key: req.body.app_key || req.body.api_key,
        app_secret: req.body.app_secret || req.body.secret_key,
        username: req.body.username,
        password: req.body.password,
        base_url: req.body.base_url,
        store_id: req.body.store_id,
      },
      currency: req.body.currency || 'BDT',
      transaction_prefix: req.body.transaction_prefix || 'TX',
      sort_order: req.body.sort_order || gateways.length + 1,
      icon_url: req.body.icon_url,
      instructions_en: req.body.instructions_en,
      instructions_bn: req.body.instructions_bn,
    };
    gateways.push(newGateway);
    db.set('payment_gateways', gateways);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_GATEWAY', 'PaymentGateways', `Added gateway: ${newGateway.name} (${newGateway.payment_mode || 'auto'})`);
    res.status(201).json(newGateway);
  });

  app.put('/api/admin/payment-gateways/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const gateways = db.get('payment_gateways') || [];
    const index = gateways.findIndex(g => g.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Gateway not found' });

    gateways[index] = {
      ...gateways[index],
      ...req.body,
      credentials: {
        ...(gateways[index].credentials || {}),
        ...(req.body.credentials || {}),
        merchant_number: req.body.merchant_number || req.body.credentials?.merchant_number || gateways[index].merchant_number,
        account_type: req.body.account_type || req.body.credentials?.account_type || gateways[index].account_type,
        payment_mode: req.body.payment_mode || req.body.credentials?.payment_mode || gateways[index].payment_mode,
        app_key: req.body.app_key || req.body.api_key || req.body.credentials?.app_key || gateways[index].app_key,
        app_secret: req.body.app_secret || req.body.secret_key || req.body.credentials?.app_secret || gateways[index].app_secret,
      },
    };
    db.set('payment_gateways', gateways);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_GATEWAY', 'PaymentGateways', `Updated gateway: ${gateways[index].name}`);
    res.json(gateways[index]);
  });

  app.delete('/api/admin/payment-gateways/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    let gateways = db.get('payment_gateways') || [];
    gateways = gateways.filter(g => g.id !== req.params.id);
    db.set('payment_gateways', gateways);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_GATEWAY', 'PaymentGateways', `Deleted gateway ${req.params.id}`);
    res.json({ success: true });
  });

  // ==========================================
  // REGISTRATION & BATCH CONFIGURATION
  // ==========================================
  app.get('/api/registration/config', (req, res) => {
    const config = (db.get('registration_config') || {}) as any;
    const settingVal = db.getSetting ? db.getSetting('registration_image_max_size') : null;
    if (settingVal) {
      const parsed = parseFloat(settingVal);
      if (!isNaN(parsed) && parsed > 0) {
        config.max_image_size_mb = parsed;
      }
    }
    res.json(config);
  });

  app.put('/api/admin/registration/config', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const current = db.get('registration_config');
    const updated = { ...current, ...req.body };
    db.set('registration_config', updated);

    // Sync legacy settings
    const legacy = db.get('settings');
    db.set('settings', {
      ...legacy,
      registration_fee: updated.fee_amount,
      currency: updated.currency,
      registration_open: updated.is_enabled,
      registration_deadline: updated.end_date,
    });

    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_REG_CONFIG', 'RegistrationConfig', `Updated registration fee: ৳${updated.fee_amount}, Open: ${updated.is_enabled}`);
    res.json(updated);
  });

  app.put('/api/admin/registration/image-limit', authenticate, requireRole(['super_admin', 'admin']), async (req: AuthRequest, res) => {
    try {
      const { max_image_size_mb, image_accepted_formats } = req.body;
      const mb = parseFloat(max_image_size_mb);
      if (isNaN(mb) || mb < 0.1 || mb > 25) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image size limit. Please specify a numeric value between 0.1 MB and 25 MB.',
        });
      }

      const current = db.get('registration_config') || ({} as any);
      const validFormats = Array.isArray(image_accepted_formats) && image_accepted_formats.length > 0
        ? image_accepted_formats.filter((f: string) => ['image/jpeg', 'image/png', 'image/webp'].includes(f))
        : (current.image_accepted_formats || ['image/jpeg', 'image/png', 'image/webp']);

      const updated = {
        ...current,
        max_image_size_mb: mb,
        image_accepted_formats: validFormats,
      };

      db.set('registration_config', updated);

      if (db.setSetting) {
        await db.setSetting(
          'registration_image_max_size',
          String(mb),
          'registration',
          'Maximum allowed registration photograph file size in Megabytes (MB). Default: 1.5MB.',
          'numeric'
        );
      }

      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'UPDATE_IMAGE_LIMIT',
        'RegistrationConfig',
        `Updated registration image limit to ${mb} MB (${validFormats.join(', ')})`
      );

      res.json({
        success: true,
        message: `Registration image limit updated to ${mb} MB successfully.`,
        max_image_size_mb: mb,
        image_accepted_formats: validFormats,
        config: updated,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Failed to update image size limit: ' + err.message });
    }
  });

  // ==========================================
  // REGISTRATION CONFIRMATION PAGE (CMS)
  // ==========================================
  app.get('/api/registration/confirmation-config', (req, res) => {
    try {
      const config = db.get('registration_confirmation_config') || initialRegistrationConfirmationConfig;
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Failed to retrieve confirmation config: ' + err.message });
    }
  });

  app.put('/api/admin/registration/confirmation-config', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    try {
      const current = db.get('registration_confirmation_config') || initialRegistrationConfirmationConfig;
      const payload = req.body || {};

      // Validate and sanitize return button destination
      let dest = typeof payload.return_button_destination === 'string' ? payload.return_button_destination.trim() : current.return_button_destination;
      // Prohibit unsafe javascript:, data:, unverified external links
      if (/^(javascript:|data:|vbscript:)/i.test(dest)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid return button destination. Safe internal routes starting with "/" are required.',
        });
      }
      if (!dest.startsWith('/') && !dest.startsWith('#')) {
        dest = '/' + dest;
      }

      const sanitizeStr = (val: any, fallback: string) => {
        if (typeof val !== 'string') return fallback;
        // Strip any script tags
        return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
      };

      const updated: RegistrationConfirmationConfig = {
        ...current,
        ...payload,
        heading_en: sanitizeStr(payload.heading_en, current.heading_en),
        heading_bn: sanitizeStr(payload.heading_bn, current.heading_bn),
        subheading_en: sanitizeStr(payload.subheading_en, current.subheading_en),
        subheading_bn: sanitizeStr(payload.subheading_bn, current.subheading_bn),
        confirmation_message_en: sanitizeStr(payload.confirmation_message_en, current.confirmation_message_en),
        confirmation_message_bn: sanitizeStr(payload.confirmation_message_bn, current.confirmation_message_bn),
        supporting_text_en: sanitizeStr(payload.supporting_text_en, current.supporting_text_en),
        supporting_text_bn: sanitizeStr(payload.supporting_text_bn, current.supporting_text_bn),

        next_steps_title_en: sanitizeStr(payload.next_steps_title_en, current.next_steps_title_en),
        next_steps_title_bn: sanitizeStr(payload.next_steps_title_bn, current.next_steps_title_bn),
        next_steps_en: sanitizeStr(payload.next_steps_en, current.next_steps_en),
        next_steps_bn: sanitizeStr(payload.next_steps_bn, current.next_steps_bn),

        payment_instructions_title_en: sanitizeStr(payload.payment_instructions_title_en, current.payment_instructions_title_en),
        payment_instructions_title_bn: sanitizeStr(payload.payment_instructions_title_bn, current.payment_instructions_title_bn),
        payment_instructions_en: sanitizeStr(payload.payment_instructions_en, current.payment_instructions_en),
        payment_instructions_bn: sanitizeStr(payload.payment_instructions_bn, current.payment_instructions_bn),

        token_label_en: sanitizeStr(payload.token_label_en, current.token_label_en),
        token_label_bn: sanitizeStr(payload.token_label_bn, current.token_label_bn),
        token_help_text_en: sanitizeStr(payload.token_help_text_en, current.token_help_text_en),
        token_help_text_bn: sanitizeStr(payload.token_help_text_bn, current.token_help_text_bn),

        info_notes_title_en: sanitizeStr(payload.info_notes_title_en, current.info_notes_title_en),
        info_notes_title_bn: sanitizeStr(payload.info_notes_title_bn, current.info_notes_title_bn),
        info_notes_en: sanitizeStr(payload.info_notes_en, current.info_notes_en),
        info_notes_bn: sanitizeStr(payload.info_notes_bn, current.info_notes_bn),

        support_title_en: sanitizeStr(payload.support_title_en, current.support_title_en),
        support_title_bn: sanitizeStr(payload.support_title_bn, current.support_title_bn),
        support_phone: sanitizeStr(payload.support_phone, current.support_phone),
        support_email: sanitizeStr(payload.support_email, current.support_email),
        support_hours_en: sanitizeStr(payload.support_hours_en, current.support_hours_en),
        support_hours_bn: sanitizeStr(payload.support_hours_bn, current.support_hours_bn),
        support_location_en: sanitizeStr(payload.support_location_en, current.support_location_en),
        support_location_bn: sanitizeStr(payload.support_location_bn, current.support_location_bn),

        return_button_label_en: sanitizeStr(payload.return_button_label_en, current.return_button_label_en),
        return_button_label_bn: sanitizeStr(payload.return_button_label_bn, current.return_button_label_bn),
        return_button_destination: dest,

        verified_heading_en: sanitizeStr(payload.verified_heading_en, current.verified_heading_en),
        verified_heading_bn: sanitizeStr(payload.verified_heading_bn, current.verified_heading_bn),
        verified_message_en: sanitizeStr(payload.verified_message_en, current.verified_message_en),
        verified_message_bn: sanitizeStr(payload.verified_message_bn, current.verified_message_bn),

        show_token_box: payload.show_token_box !== undefined ? Boolean(payload.show_token_box) : current.show_token_box,
        show_download_slip_button: payload.show_download_slip_button !== undefined ? Boolean(payload.show_download_slip_button) : current.show_download_slip_button,
        show_print_button: payload.show_print_button !== undefined ? Boolean(payload.show_print_button) : current.show_print_button,
        show_manual_payment_accounts: payload.show_manual_payment_accounts !== undefined ? Boolean(payload.show_manual_payment_accounts) : current.show_manual_payment_accounts,
        show_payment_instructions: payload.show_payment_instructions !== undefined ? Boolean(payload.show_payment_instructions) : current.show_payment_instructions,
        show_confirm_payment_form: payload.show_confirm_payment_form !== undefined ? Boolean(payload.show_confirm_payment_form) : current.show_confirm_payment_form,
        show_info_notes: payload.show_info_notes !== undefined ? Boolean(payload.show_info_notes) : current.show_info_notes,
        show_support_contact: payload.show_support_contact !== undefined ? Boolean(payload.show_support_contact) : current.show_support_contact,
        show_return_button: payload.show_return_button !== undefined ? Boolean(payload.show_return_button) : current.show_return_button,
      };

      db.set('registration_confirmation_config', updated);
      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'UPDATE_REG_CONFIRMATION_CONFIG',
        'CMS',
        'Updated registration confirmation page CMS settings'
      );

      res.json({
        success: true,
        message: 'Registration confirmation page CMS configuration saved successfully.',
        config: updated,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Failed to update confirmation config: ' + err.message });
    }
  });

  // ==========================================
  // PROGRAM SCHEDULE & FESTIVITIES (CMS)
  // ==========================================
  app.get('/api/program-schedule', (req, res) => {
    const schedule = db.get('program_schedule') || initialProgramSchedule;
    res.json(schedule);
  });

  app.put('/api/admin/program-schedule', authenticate, requireRole(['super_admin', 'admin', 'content_manager', 'event_manager']), (req: AuthRequest, res) => {
    const current = db.get('program_schedule') || initialProgramSchedule;
    const updated = {
      ...current,
      ...req.body,
      items: req.body.items !== undefined ? req.body.items : (current.items || []),
    };
    db.set('program_schedule', updated);
    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'UPDATE_PROGRAM_SCHEDULE',
      'CMS',
      `Updated Day-Long Festivities Schedule. Enabled: ${updated.is_enabled}, Items: ${updated.items?.length}`
    );
    res.json(updated);
  });

  // ==========================================
  // DYNAMIC REGISTRATION FORM FIELDS (100% CMS)
  // ==========================================
  app.get('/api/registration/fields', (req, res) => {
    const regConfig = db.get('registration_config');
    let fields = db.get('registration_form_fields') || regConfig?.fields || initialRegistrationFields;
    if (Array.isArray(fields) && !fields.some((f: any) => f.name === 't_shirt_size')) {
      const defaultTShirt = initialRegistrationFields.find(f => f.name === 't_shirt_size');
      if (defaultTShirt) {
        fields = [...fields, defaultTShirt].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        db.set('registration_form_fields', fields);
      }
    }
    // Return active fields sorted by order
    const active = fields
      .filter((f: any) => f.is_enabled !== false)
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    res.json(active);
  });

  app.get('/api/admin/registration/fields', authenticate, requireRole(['super_admin', 'admin', 'event_manager']), (req, res) => {
    const regConfig = db.get('registration_config');
    let fields = db.get('registration_form_fields') || regConfig?.fields || initialRegistrationFields;
    if (Array.isArray(fields) && !fields.some((f: any) => f.name === 't_shirt_size')) {
      const defaultTShirt = initialRegistrationFields.find(f => f.name === 't_shirt_size');
      if (defaultTShirt) {
        fields = [...fields, defaultTShirt].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        db.set('registration_form_fields', fields);
      }
    }
    res.json([...fields].sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
  });

  app.put('/api/admin/registration/fields', authenticate, requireRole(['super_admin', 'admin', 'event_manager']), (req: AuthRequest, res) => {
    const fields = Array.isArray(req.body) ? req.body : req.body.fields;
    if (!Array.isArray(fields)) {
      return res.status(400).json({ message: 'Fields array is required' });
    }
    db.set('registration_form_fields', fields);

    // Also sync to registration_config.fields
    const regConfig = db.get('registration_config');
    if (regConfig) {
      regConfig.fields = fields;
      db.set('registration_config', regConfig);
    }

    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'UPDATE_REG_FORM_FIELDS',
      'Registration',
      `Updated registration form schema (${fields.length} fields configured)`
    );
    res.json(fields);
  });

  // ==========================================
  // DATABASE STATUS & PORTABILITY (Supabase / cPanel MySQL)
  // ==========================================
  app.get('/api/admin/database/status', authenticate, requireRole(['super_admin', 'admin']), (req, res) => {
    const status = portableDb.getStatus();
    const counts = {
      registrations: (db.get('registrations') || []).length,
      users: (db.get('users') || []).length,
      pages: (db.get('pages') || []).length,
      menus: (db.get('menus') || []).length,
      audit_logs: (db.get('audit_logs') || []).length,
      batches: (db.get('batches') || []).length,
    };
    res.json({
      ...status,
      counts,
      environment: process.env.NODE_ENV || 'development',
      cPanel_ready: true,
      supabase_ready: true,
    });
  });

  app.get(['/api/batches/config', '/api/admin/batch-config'], authenticate, (req, res) => {
    res.json(db.get('batch_config'));
  });

  app.put(['/api/admin/batches/config', '/api/admin/batch-config'], authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const current = db.get('batch_config');
    const updated = { ...current, ...req.body };
    db.set('batch_config', updated);
    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'UPDATE_BATCH_CONFIG',
      'BatchConfig',
      `Updated reference year: ${updated.reference_year}, reference batch: ${updated.reference_batch}`
    );
    res.json(updated);
  });

  app.get(['/api/admin/batches/overrides', '/api/admin/batch-overrides'], authenticate, requireRole(['super_admin', 'admin']), (req, res) => {
    const config = (db.get('batch_config') || {}) as any;
    res.json(config.overrides || []);
  });

  app.post(['/api/admin/batches/overrides', '/api/admin/batch-overrides'], authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const config = db.get('batch_config') || {
      reference_year: 2008,
      reference_batch: 65,
      formula_description: 'Batch = 65 + (Passing Year - 2008)',
      naming_format: 'batch_number' as const,
      overrides: []
    };
    const { passing_year, override_batch_number, batch_name_en, batch_name_bn, reason } = req.body;

    const year = parseInt(passing_year, 10);
    if (isNaN(year)) return res.status(400).json({ message: 'Invalid passing year' });

    config.overrides = (config.overrides || []).filter(o => o.passing_year !== year);
    config.overrides.push({
      passing_year: year,
      override_batch_number: parseInt(override_batch_number, 10),
      batch_name_en,
      batch_name_bn,
      reason,
      created_by: req.user?.name || 'Admin',
      created_at: new Date().toISOString(),
    });

    db.set('batch_config', config);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'BATCH_OVERRIDE', 'BatchConfig', `Overrode batch for year ${year}: ${batch_name_en}`);
    res.json(config);
  });

  app.delete(['/api/admin/batches/overrides/:year', '/api/admin/batch-overrides/:year'], authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const config = db.get('batch_config');
    const year = parseInt(req.params.year, 10);
    config.overrides = (config.overrides || []).filter(o => o.passing_year !== year);
    db.set('batch_config', config);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_BATCH_OVERRIDE', 'BatchConfig', `Removed override for year ${year}`);
    res.json({ success: true, config });
  });

  // ==========================================
  // ROLES & ACCESS CONTROL (RBAC)
  // ==========================================
  app.get('/api/admin/roles', authenticate, requireRole(['super_admin', 'admin']), (req, res) => {
    res.json(db.get('roles') || []);
  });

  app.post('/api/admin/roles', authenticate, requireRole(['super_admin']), (req: AuthRequest, res) => {
    const roles = db.get('roles') || [];
    const newRole: CustomRole = {
      id: `role-${Date.now()}`,
      name: req.body.name,
      description: req.body.description,
      permissions: req.body.permissions || [],
      is_system: false,
      created_at: new Date().toISOString(),
    };
    roles.push(newRole);
    db.set('roles', roles);
    db.logAudit(req.user?.name || 'SuperAdmin', req.user?.email || '', 'CREATE_ROLE', 'RBAC', `Created custom role: ${newRole.name}`);
    res.status(201).json(newRole);
  });

  app.put('/api/admin/roles/:id', authenticate, requireRole(['super_admin']), (req: AuthRequest, res) => {
    const roles = db.get('roles') || [];
    const index = roles.findIndex(r => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Role not found' });

    roles[index] = { ...roles[index], ...req.body };
    db.set('roles', roles);
    db.logAudit(req.user?.name || 'SuperAdmin', req.user?.email || '', 'UPDATE_ROLE', 'RBAC', `Updated role: ${roles[index].name}`);
    res.json(roles[index]);
  });

  app.delete('/api/admin/roles/:id', authenticate, requireRole(['super_admin']), (req: AuthRequest, res) => {
    const roles = db.get('roles') || [];
    const role = roles.find(r => r.id === req.params.id);
    if (role?.is_system) {
      return res.status(400).json({ message: 'System defined default roles cannot be deleted.' });
    }
    const filtered = roles.filter(r => r.id !== req.params.id);
    db.set('roles', filtered);
    db.logAudit(req.user?.name || 'SuperAdmin', req.user?.email || '', 'DELETE_ROLE', 'RBAC', `Deleted role ${req.params.id}`);
    res.json({ success: true });
  });

  // ==========================================
  // USER & ALUMNI PROFILE MANAGEMENT
  // ==========================================
  app.get('/api/admin/users', authenticate, requireRole(['super_admin', 'admin']), (req, res) => {
    const users = db.get('users') || [];
    // Omit sensitive password hashes
    res.json(users.map(({ password_hash, ...u }) => u));
  });

  app.post('/api/admin/users', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const users = db.get('users') || [];
    const { username, email, phone, name, name_bn, role, passing_year, gender, blood_group } = req.body;

    if (!username || !name) {
      return res.status(400).json({ message: 'Username and Name are required.' });
    }

    // Uniqueness check (case-insensitive)
    const cleanUsername = username.trim().toLowerCase();
    if (users.some(u => (u.username || '').trim().toLowerCase() === cleanUsername)) {
      return res.status(409).json({
        message: 'This username is already taken. Please choose another username.',
        message_bn: 'এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হয়েছে। অনুগ্রহ করে অন্য একটি ইউজারনেম বেছে নিন।'
      });
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      username: username.toLowerCase().trim(),
      name: name.trim(),
      name_bn,
      email: email?.trim(),
      phone: phone?.trim(),
      role: role || 'alumni_member',
      passing_year: passing_year ? parseInt(passing_year, 10) : undefined,
      gender,
      blood_group,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    db.set('users', users);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_USER', 'Users', `Created user ${newUser.username} with role ${newUser.role}`);
    res.status(201).json(newUser);
  });

  app.put('/api/admin/users/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const users = db.get('users') || [];
    const index = users.findIndex(u => u.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'User not found' });

    const existing = users[index];
    const { username, ...otherUpdates } = req.body;

    // Check username uniqueness if changing (case-insensitive)
    if (username && username.trim().toLowerCase() !== (existing.username || '').trim().toLowerCase()) {
      const cleanUsername = username.trim().toLowerCase();
      if (users.some(u => u.id !== existing.id && (u.username || '').trim().toLowerCase() === cleanUsername)) {
        return res.status(409).json({
          message: 'This username is already taken. Please choose another username.',
          message_bn: 'এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হয়েছে। অনুগ্রহ করে অন্য একটি ইউজারনেম বেছে নিন।'
        });
      }
      existing.username = cleanUsername;
    }

    const updatedUser = { ...existing, ...otherUpdates };
    users[index] = updatedUser;
    db.set('users', users);

    // Synchronize linked registrations with updated user info
    const registrations = db.get('registrations') || [];
    let regsModified = false;
    registrations.forEach(r => {
      if (r.user_id === updatedUser.id || (r.email && r.email.toLowerCase() === updatedUser.email.toLowerCase())) {
        if (otherUpdates.name) r.full_name = otherUpdates.name;
        if (otherUpdates.phone) r.phone = otherUpdates.phone;
        if (otherUpdates.blood_group) r.blood_group = otherUpdates.blood_group;
        if (otherUpdates.gender) r.gender = otherUpdates.gender;
        if (otherUpdates.photo_url) r.photo_url = otherUpdates.photo_url;
        if (otherUpdates.address) r.address = otherUpdates.address;
        if (otherUpdates.occupation) r.occupation = otherUpdates.occupation;
        if (otherUpdates.designation) r.designation = otherUpdates.designation;
        if (otherUpdates.organization) r.organization = otherUpdates.organization;

        // If passing year changed, auto update batch on linked registrations
        if (otherUpdates.passing_year && otherUpdates.passing_year !== existing.passing_year) {
          const year = parseInt(otherUpdates.passing_year, 10);
          const newBatch = BatchService.getBatchByPassingYear(year);
          r.passing_year = year;
          r.batch_name = newBatch.batch_name;
          r.batch_name_bn = newBatch.batch_name_bn;
        }
        regsModified = true;
      }
    });
    if (regsModified) {
      db.set('registrations', registrations);
    }

    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_USER', 'Users', `Updated user: ${updatedUser.name} (${updatedUser.username})`);
    const { password_hash, ...safeUser } = updatedUser;
    res.json(safeUser);
  });

  app.post('/api/admin/users/:id/reset-password', authenticate, requireRole(['super_admin', 'admin']), async (req: AuthRequest, res) => {
    try {
      const users = db.get('users') || [];
      const user = users.find(u => u.id === req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      // Generate temporary password or use provided custom password
      let tempPassword = '';
      if (req.body.new_password !== undefined && req.body.new_password !== null && String(req.body.new_password).trim() !== '') {
        const customPassword = String(req.body.new_password).trim();
        if (customPassword.length < 6) {
          return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
        }
        tempPassword = customPassword;
      } else {
        tempPassword = `NASH@${crypto.randomBytes(3).toString('hex').toUpperCase()}#`;
      }

      const newHash = bcrypt.hashSync(tempPassword, 10);
      user.password_hash = newHash;
      db.set('users', users);
      await db.updateUserPassword(user.id, newHash);

      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'RESET_USER_PASSWORD',
        'Users',
        `Reset password for user: ${user.name} (${user.username || user.email})`
      );

      res.json({
        success: true,
        message: `Password reset successfully for ${user.name}.`,
        temp_password: tempPassword,
      });
    } catch (err: any) {
      console.error('Admin reset password error:', err);
      res.status(500).json({ success: false, message: 'Failed to reset password.' });
    }
  });

  // Get Detailed User Profile
  app.get('/api/admin/users/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const users = db.get('users') || [];
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const registrations = db.get('registrations') || [];
    const tokens = db.get('tokens') || [];
    const payments = db.get('payments') || [];
    const auditLogs = db.get('audit_logs') || [];

    const userRegistrations = registrations.filter(
      r => r.user_id === user.id || (user.email && r.email?.toLowerCase() === user.email.toLowerCase()) || (user.phone && r.phone === user.phone)
    );
    const regIds = userRegistrations.map(r => r.id);
    const userTokens = tokens.filter(t => regIds.includes(t.registration_id));
    const userPayments = payments.filter(p => regIds.includes(p.registration_id));
    const userAudit = auditLogs.filter(a => a.user_email === user.email || a.action.includes(user.id)).slice(0, 15);

    const { password_hash, ...safeUser } = user;
    res.json({
      user: safeUser,
      registrations: userRegistrations,
      tokens: userTokens,
      payments: userPayments,
      audit: userAudit,
    });
  });

  // Delete User with Historical Record Preservation
  app.delete('/api/admin/users/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    let users = db.get('users') || [];
    const target = users.find(u => u.id === req.params.id);
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Safety check: Cannot delete oneself
    if (req.user?.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot delete your own active administrative account.' });
    }

    // Permission check: Non-super_admin cannot delete super_admin
    if (target.role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only Super Administrators can delete Super Admin accounts.' });
    }

    // Safety check: Cannot delete the last super admin
    if (target.role === 'super_admin' && users.filter(u => u.role === 'super_admin').length <= 1) {
      return res.status(400).json({ message: 'Cannot delete the only Super Admin account in the system.' });
    }

    // PRESERVATION: Detach and preserve all historical records (registrations, tokens, payments)
    const registrations = db.get('registrations') || [];
    let updatedRegistrations = false;
    registrations.forEach(r => {
      if (r.user_id === target.id) {
        // Keep registration completely intact, add historical archiving note
        const dateStr = new Date().toISOString().slice(0, 10);
        r.notes = r.notes ? `${r.notes} | [User @${target.username} deleted on ${dateStr}]` : `[User @${target.username} deleted on ${dateStr}]`;
        updatedRegistrations = true;
      }
    });
    if (updatedRegistrations) {
      db.set('registrations', registrations);
    }

    // Remove user credential access
    users = users.filter(u => u.id !== req.params.id);
    db.set('users', users);

    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'DELETE_USER',
      'Users',
      `Deleted user account @${target.username} (${target.name}, role: ${target.role}). Historical alumni registration and financial records have been preserved.`
    );

    res.json({
      success: true,
      message: `User @${target.username} was deleted. All associated registrations and payment records were preserved.`,
    });
  });

  // ==========================================
  // EVENT INFO & CONTENT
  // ==========================================
  app.get('/api/events/current', (req, res) => {
    const events = db.get('events');
    const settings = db.get('settings');
    const regConfig = db.get('registration_config');
    const current = events.find(e => e.id === settings.current_event_id) || events[0];
    res.json({
      ...current,
      registration_fee: regConfig?.fee_amount || settings.registration_fee || current.registration_fee,
      currency: regConfig?.currency || settings.currency || 'BDT',
    });
  });

  app.get('/api/school-info', (req, res) => {
    res.json(db.get('school_info'));
  });

  app.put('/api/admin/school-info', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const current = db.get('school_info');
    const updated = { ...current, ...req.body };
    db.set('school_info', updated);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_SCHOOL_INFO', 'SchoolInfo', 'Updated school institutional history and modular sections');
    res.json(updated);
  });

  app.get('/api/association-info', (req, res) => {
    res.json(db.get('association_info'));
  });

  // Legacy & current committee support
  app.get('/api/committee', (req, res) => {
    const committees = db.get('committees') || [];
    const members = db.get('committee_members') || [];
    const legacy = db.get('committee') || [];

    // If new committee structure is populated, find current committee members
    const currentComm = committees.find(c => c.is_current && c.is_active) || committees[0];
    if (currentComm && members.length > 0) {
      const commMembers = members.filter(m => m.committee_id === currentComm.id && m.is_active);
      if (commMembers.length > 0) {
        // Map to CommitteeMember structure for seamless backward compatibility
        const mapped = commMembers.sort((a, b) => a.order_index - b.order_index).map(m => ({
          id: m.id,
          name_en: m.custom_name_en,
          name_bn: m.custom_name_bn,
          role_en: m.designation_en,
          role_bn: m.designation_bn,
          designation_en: m.designation_en,
          designation_bn: m.designation_bn,
          batch_year: m.batch_year,
          batch_name: m.batch_name,
          phone: m.phone,
          email: m.email,
          photo: m.photo_url,
          photo_url: m.photo_url,
          order_index: m.order_index,
          is_active: m.is_active,
        }));
        return res.json(mapped);
      }
    }

    res.json(legacy.filter(c => c.is_active).sort((a, b) => a.order_index - b.order_index));
  });

  // Multi-tier Committee Endpoints
  app.get('/api/committees', (req, res) => {
    const committees = db.get('committees') || [];
    res.json(committees.sort((a, b) => a.order_index - b.order_index));
  });

  app.post('/api/admin/committees', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const committees = db.get('committees') || [];
    const newCommittee: Committee = {
      id: `comm-${Date.now()}`,
      name_en: req.body.name_en || 'New Committee',
      name_bn: req.body.name_bn || 'নতুন কমিটি',
      committee_type: req.body.committee_type || 'convening',
      tenure_start: req.body.tenure_start,
      tenure_end: req.body.tenure_end,
      tenure_label: req.body.tenure_label || '2026–2027',
      description_en: req.body.description_en,
      description_bn: req.body.description_bn,
      is_current: Boolean(req.body.is_current),
      is_active: req.body.is_active ?? true,
      order_index: committees.length + 1,
      created_at: new Date().toISOString(),
    };

    if (newCommittee.is_current) {
      committees.forEach(c => { c.is_current = false; });
    }

    committees.push(newCommittee);
    db.set('committees', committees);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_COMMITTEE', 'Committee', `Created committee: ${newCommittee.name_en}`);
    res.status(201).json(newCommittee);
  });

  app.put('/api/admin/committees/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const committees = db.get('committees') || [];
    const index = committees.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Committee not found' });

    if (req.body.is_current) {
      committees.forEach(c => { c.is_current = false; });
    }

    committees[index] = { ...committees[index], ...req.body };
    db.set('committees', committees);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_COMMITTEE', 'Committee', `Updated committee: ${committees[index].name_en}`);
    res.json(committees[index]);
  });

  app.delete('/api/admin/committees/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    let committees = db.get('committees') || [];
    committees = committees.filter(c => c.id !== req.params.id);
    db.set('committees', committees);

    let members = db.get('committee_members') || [];
    members = members.filter(m => m.committee_id !== req.params.id);
    db.set('committee_members', members);

    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_COMMITTEE', 'Committee', `Deleted committee ${req.params.id}`);
    res.json({ success: true });
  });

  // Committee Members
  app.get('/api/committee-members', (req, res) => {
    const { committee_id } = req.query;
    let members = db.get('committee_members') || [];
    if (committee_id) {
      members = members.filter(m => m.committee_id === committee_id);
    }
    res.json(members.sort((a, b) => a.order_index - b.order_index));
  });

  app.post('/api/admin/committee-members', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const members = db.get('committee_members') || [];
    const newMember: CommitteeMemberItem = {
      id: `cm-${Date.now()}`,
      committee_id: req.body.committee_id,
      user_id: req.body.user_id,
      custom_name_en: req.body.custom_name_en,
      custom_name_bn: req.body.custom_name_bn,
      designation_en: req.body.designation_en || 'Member',
      designation_bn: req.body.designation_bn || 'সদস্য',
      batch_year: req.body.batch_year ? parseInt(req.body.batch_year, 10) : undefined,
      batch_name: req.body.batch_name,
      phone: req.body.phone,
      email: req.body.email,
      photo_url: req.body.photo_url,
      bio: req.body.bio,
      order_index: req.body.order_index || (members.length + 1),
      is_active: req.body.is_active ?? true,
    };
    members.push(newMember);
    db.set('committee_members', members);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_COMMITTEE_MEMBER', 'Committee', `Added member: ${newMember.custom_name_en}`);
    res.status(201).json(newMember);
  });

  app.put('/api/admin/committee-members/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const members = db.get('committee_members') || [];
    const index = members.findIndex(m => m.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Member not found' });

    members[index] = { ...members[index], ...req.body };
    db.set('committee_members', members);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_COMMITTEE_MEMBER', 'Committee', `Updated committee member ${req.params.id}`);
    res.json(members[index]);
  });

  app.delete('/api/admin/committee-members/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    let members = db.get('committee_members') || [];
    members = members.filter(m => m.id !== req.params.id);
    db.set('committee_members', members);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_COMMITTEE_MEMBER', 'Committee', `Deleted committee member ${req.params.id}`);
    res.json({ success: true });
  });

  // Committee Designations
  app.get('/api/committee-designations', (req, res) => {
    res.json(db.get('committee_designations') || []);
  });

  app.post('/api/admin/committee-designations', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const designations = db.get('committee_designations') || [];
    const newDesig: CommitteeDesignation = {
      id: `desig-${Date.now()}`,
      title_en: req.body.title_en,
      title_bn: req.body.title_bn,
      default_order: designations.length + 1,
    };
    designations.push(newDesig);
    db.set('committee_designations', designations);
    res.status(201).json(newDesig);
  });

  app.delete('/api/admin/committee-designations/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    let designations = db.get('committee_designations') || [];
    designations = designations.filter(d => d.id !== req.params.id);
    db.set('committee_designations', designations);
    res.json({ success: true });
  });

  // Authorized Registration Booths / Offline Registration Centers
  const getPublicBooths = (req: Request, res: Response) => {
    const centers = db.get('offline_centers') || [];
    // Only return active and non-trashed centers, ordered by order_index
    const activeBooths = centers
      .filter(c => !c.is_trashed && c.is_active !== false)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    res.json(activeBooths);
  };
  app.get('/api/offline-centers', getPublicBooths);
  app.get('/api/booths', getPublicBooths);

  const getAdminBooths = (req: Request, res: Response) => {
    const centers = db.get('offline_centers') || [];
    const includeTrash = req.query.trash === 'true';
    let filtered = centers;
    if (includeTrash) {
      filtered = centers.filter(c => c.is_trashed === true);
    }
    res.json(filtered.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
  };
  app.get('/api/admin/offline-centers', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), getAdminBooths);
  app.get('/api/admin/booths', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), getAdminBooths);

  const createBoothHandler = (req: AuthRequest, res: Response) => {
    const centers = db.get('offline_centers') || [];
    const maxOrder = centers.length > 0 ? Math.max(...centers.map(c => c.order_index || 0)) : 0;
    const newCenter: OfflineRegistrationCenter = {
      id: `booth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name_en: req.body.name_en ? req.body.name_en.trim() : '',
      name_bn: req.body.name_bn ? req.body.name_bn.trim() : (req.body.name_en || '').trim(),
      address_en: req.body.address_en ? req.body.address_en.trim() : '',
      address_bn: req.body.address_bn ? req.body.address_bn.trim() : (req.body.address_en || '').trim(),
      phone: req.body.phone ? req.body.phone.trim() : '',
      contact_person: req.body.contact_person ? req.body.contact_person.trim() : undefined,
      contact_person_bn: req.body.contact_person_bn ? req.body.contact_person_bn.trim() : undefined,
      timings: req.body.timings ? req.body.timings.trim() : 'Daily 9:00 AM – 8:00 PM',
      timings_bn: req.body.timings_bn ? req.body.timings_bn.trim() : undefined,
      description_en: req.body.description_en ? req.body.description_en.trim() : undefined,
      description_bn: req.body.description_bn ? req.body.description_bn.trim() : undefined,
      map_url: req.body.map_url ? req.body.map_url.trim() : undefined,
      order_index: typeof req.body.order_index === 'number' ? req.body.order_index : maxOrder + 1,
      is_active: req.body.is_active !== false,
      is_trashed: false,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    centers.push(newCenter);
    db.set('offline_centers', centers);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_BOOTH', 'Booths', `Added registration booth: ${newCenter.name_en || newCenter.name_bn}`);
    res.status(201).json(newCenter);
  };
  app.post('/api/admin/offline-centers', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), createBoothHandler);
  app.post('/api/admin/booths', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), createBoothHandler);

  // Bulk reorder booths
  const reorderBoothsHandler = (req: AuthRequest, res: Response) => {
    const centers = db.get('offline_centers') || [];
    const { items } = req.body; // Array of { id, order_index } or array of ids
    if (Array.isArray(items)) {
      items.forEach((item: any, idx: number) => {
        const id = typeof item === 'string' ? item : item.id;
        const targetOrder = typeof item === 'object' && typeof item.order_index === 'number' ? item.order_index : idx + 1;
        const target = centers.find(c => c.id === id);
        if (target) {
          target.order_index = targetOrder;
          target.updated_at = new Date().toISOString();
        }
      });
      db.set('offline_centers', centers);
      db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'REORDER_BOOTHS', 'Booths', 'Reordered registration booths display sequence');
    }
    res.json({ success: true, centers });
  };
  app.put('/api/admin/offline-centers/reorder', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), reorderBoothsHandler);
  app.post('/api/admin/offline-centers/reorder', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), reorderBoothsHandler);
  app.put('/api/admin/booths/reorder', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), reorderBoothsHandler);
  app.post('/api/admin/booths/reorder', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), reorderBoothsHandler);

  const updateBoothHandler = (req: AuthRequest, res: Response) => {
    const centers = db.get('offline_centers') || [];
    const index = centers.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Booth not found' });

    centers[index] = {
      ...centers[index],
      ...req.body,
      updated_at: new Date().toISOString(),
    };
    db.set('offline_centers', centers);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_BOOTH', 'Booths', `Updated registration booth: ${centers[index].name_en || centers[index].name_bn}`);
    res.json(centers[index]);
  };
  app.put('/api/admin/offline-centers/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), updateBoothHandler);
  app.put('/api/admin/booths/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), updateBoothHandler);

  // Soft delete / move to trash
  const trashBoothHandler = (req: AuthRequest, res: Response) => {
    const centers = db.get('offline_centers') || [];
    const index = centers.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Booth not found' });

    centers[index].is_trashed = true;
    centers[index].is_active = false;
    centers[index].deleted_at = new Date().toISOString();
    centers[index].updated_at = new Date().toISOString();
    db.set('offline_centers', centers);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'TRASH_BOOTH', 'Booths', `Moved booth ${centers[index].name_en} to trash`);
    res.json({ success: true, message: 'Booth moved to trash', booth: centers[index] });
  };
  app.delete('/api/admin/offline-centers/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), trashBoothHandler);
  app.delete('/api/admin/booths/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), trashBoothHandler);

  // Restore booth from trash
  const restoreBoothHandler = (req: AuthRequest, res: Response) => {
    const centers = db.get('offline_centers') || [];
    const index = centers.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Booth not found' });

    centers[index].is_trashed = false;
    centers[index].is_active = true;
    centers[index].deleted_at = null;
    centers[index].updated_at = new Date().toISOString();
    db.set('offline_centers', centers);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'RESTORE_BOOTH', 'Booths', `Restored booth ${centers[index].name_en} from trash`);
    res.json({ success: true, message: 'Booth restored successfully', booth: centers[index] });
  };
  app.post('/api/admin/offline-centers/:id/restore', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), restoreBoothHandler);
  app.post('/api/admin/booths/:id/restore', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), restoreBoothHandler);

  // Permanent force delete booth
  const forceDeleteBoothHandler = (req: AuthRequest, res: Response) => {
    let centers = db.get('offline_centers') || [];
    const target = centers.find(c => c.id === req.params.id);
    centers = centers.filter(c => c.id !== req.params.id);
    db.set('offline_centers', centers);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'PERMANENT_DELETE_BOOTH', 'Booths', `Permanently deleted booth: ${target?.name_en || req.params.id}`);
    res.json({ success: true, message: 'Booth permanently deleted' });
  };
  app.delete('/api/admin/offline-centers/:id/force', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), forceDeleteBoothHandler);
  app.delete('/api/admin/booths/:id/force', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), forceDeleteBoothHandler);

  app.get('/api/notices', (req, res) => {
    const notices = db.get('notices') || [];
    res.json(notices.filter(n => n.is_active).sort((a, b) => new Date(b.publish_date).getTime() - new Date(a.publish_date).getTime()));
  });

  app.get('/api/news', (req, res) => {
    const news = db.get('news') || [];
    res.json(news.filter(n => n.is_published).sort((a, b) => new Date(b.publish_date).getTime() - new Date(a.publish_date).getTime()));
  });

  // Contact Inquiries / Message Submission
  app.post('/api/contact/messages', (req, res) => {
    const { name, phone, batch, message } = req.body;
    if (!name || !phone || !message) {
      return res.status(400).json({ success: false, message: 'Name, phone, and message are required.' });
    }
    db.logAudit(
      name.trim(),
      phone.trim(),
      'CONTACT_INQUIRY',
      'Contact',
      `Inquiry from ${name.trim()} (Phone: ${phone.trim()}, Batch: ${batch ? batch.trim() : 'N/A'}): ${message.trim().slice(0, 150)}`
    );
    res.status(201).json({ success: true, message: 'Message received successfully! Our team will contact you shortly.' });
  });

  app.get('/api/batches', (req, res) => {
    res.json(BatchService.getAllBatches());
  });

  app.post('/api/batches/calculate', (req, res) => {
    const { passing_year } = req.body;
    const year = parseInt(passing_year, 10);
    if (isNaN(year) || year < 1942 || year > 2035) {
      return res.status(400).json({ message: 'Please enter a valid passing year between 1942 and 2035.' });
    }
    const result = BatchService.getBatchByPassingYear(year);
    res.json(result);
  });

  // ==========================================
  // REGISTRATIONS & PAYMENTS
  // ==========================================
  app.post('/api/registrations', async (req, res) => {
    try {
      const { full_name, dob, gender, passing_year, blood_group, t_shirt_size, phone, email, event_id, address, occupation } = req.body;

      if (!full_name || !dob || !gender || !passing_year || !phone) {
        return res.status(400).json({ message: 'Please fill in all required fields: Full Name, Date of Birth, Gender, Passing Year, and Mobile Number.' });
      }

      // Retrieve dynamic registration configuration & form field schema
      const regConfig = db.get('registration_config');
      if (regConfig && !regConfig.is_enabled) {
        return res.status(400).json({ message: 'Registration for the 85th Anniversary is currently closed.' });
      }

      const regFields = db.get('registration_form_fields') || regConfig?.fields || initialRegistrationFields;
      const tShirtField = Array.isArray(regFields) ? regFields.find((f: any) => f.name === 't_shirt_size') : null;
      const isTShirtEnabled = tShirtField ? (tShirtField.is_enabled !== false && tShirtField.enabled !== false) : true;
      const isTShirtRequired = tShirtField ? (tShirtField.is_required === true || tShirtField.required === true) : true;

      // Dynamic T-shirt size options from database CMS configuration
      const allowedTShirtSizes: string[] = (tShirtField?.options && tShirtField.options.length > 0)
        ? tShirtField.options.map((s: any) => String(s).trim().toUpperCase())
        : (regConfig?.t_shirt_size_options && regConfig.t_shirt_size_options.length > 0)
        ? regConfig.t_shirt_size_options.map((s: any) => String(s).trim().toUpperCase())
        : ['M', 'L', 'XL', 'XXL', 'XXXL'];

      const rawTShirtSize = (t_shirt_size || '').toString().trim().toUpperCase();
      let validTShirtSize: string | undefined = undefined;

      if (isTShirtEnabled) {
        if (isTShirtRequired && !rawTShirtSize) {
          return res.status(400).json({
            message: 'Please select a T-shirt size. (টি-শার্টের সাইজ নির্বাচন করা আবশ্যক)',
            field: 't_shirt_size',
          });
        }
        if (rawTShirtSize) {
          if (!allowedTShirtSizes.includes(rawTShirtSize)) {
            return res.status(400).json({
              message: `Invalid T-shirt size "${rawTShirtSize}". Allowed options: ${allowedTShirtSizes.join(', ')}`,
              field: 't_shirt_size',
            });
          }
          validTShirtSize = rawTShirtSize;
        }
      }

      const year = parseInt(passing_year, 10);
      if (isNaN(year) || year < 1942 || year > 2035) {
        return res.status(400).json({ message: 'Invalid passing year.' });
      }

      const registrations = db.get('registrations');

      // Normalize mobile number (remove spaces, hyphens, plus signs, leading zeros for 880)
      const rawPhone = (phone || '').toString().trim();
      const cleanPhone = rawPhone.replace(/[\s\-\(\)]/g, '');
      const normalizedPhone = cleanPhone.startsWith('+88')
        ? cleanPhone.slice(3)
        : cleanPhone.startsWith('880')
        ? cleanPhone.slice(2)
        : cleanPhone;

      const targetEventId = event_id || regConfig?.event_id || 'event-85th-anniversary';

      // 1. Database-Level Count / Query Check
      let duplicateFound = false;
      let existingRecord: any = null;

      try {
        const queryRes = await portableDb.query(
          `SELECT id, full_name, phone, passing_year, payment_status, token_code 
           FROM event_registrations 
           WHERE event_id = ? AND REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+88', '') = ?`,
          [targetEventId, normalizedPhone]
        );
        if (Array.isArray(queryRes) && queryRes.length > 0) {
          duplicateFound = true;
          existingRecord = queryRes[0];
        }
      } catch (dbErr) {
        // Fallback to database engine records
      }

      // 2. Comprehensive check in database records
      if (!duplicateFound) {
        existingRecord = registrations.find((r: Registration) => {
          const rClean = (r.phone || '').replace(/[\s\-\(\)]/g, '');
          const rNorm = rClean.startsWith('+88')
            ? rClean.slice(3)
            : rClean.startsWith('880')
            ? rClean.slice(2)
            : rClean;
          return (r.event_id === targetEventId || !r.event_id) && rNorm === normalizedPhone;
        });
        if (existingRecord) {
          duplicateFound = true;
        }
      }

      // If duplicate mobile number is found, reject registration with clear instructions
      if (duplicateFound && existingRecord) {
        return res.status(409).json({
          success: false,
          error: 'DUPLICATE_MOBILE_REGISTRATION',
          message: `The mobile number "${phone}" is already registered for this reunion event (${existingRecord.full_name}, Passing Year: ${existingRecord.passing_year}). Duplicate registrations with the same mobile number are strictly prohibited.`,
          existing_registration_id: existingRecord.id,
          token_code: existingRecord.token_code,
          token_url: existingRecord.token_code
            ? `/verify?token=${existingRecord.token_code}`
            : `/verify?search=${encodeURIComponent(normalizedPhone)}`,
          help_action: 'Please verify your existing registration or check your Entry Token status.',
        });
      }

      // Dynamic batch calculation
      const batchInfo = BatchService.getBatchByPassingYear(year);
      const feeAmount = regConfig?.fee_amount || 1000;
      const currency = regConfig?.currency || 'BDT';

      const regId = `REG-85-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

      // Generate unique, collision-safe, database-backed token code immediately server-side
      const tokenCode = TokenService.generateFormattedTokenCode(year, batchInfo.batch_name);

      // Persist photo to disk storage if base64 data URI provided
      const savedPhotoInfo = await FileStorageService.processIncomingPhotoWithMetadata(req.body.photo_url, 'photos');
      const persistentPhotoUrl = savedPhotoInfo ? savedPhotoInfo.url : undefined;

      const newRegistration: Registration = {
        id: regId,
        event_id: targetEventId,
        full_name: full_name.trim(),
        dob,
        gender,
        blood_group: blood_group ? blood_group.trim() : undefined,
        t_shirt_size: validTShirtSize,
        phone: phone.trim(),
        email: email ? email.trim() : undefined,
        photo_url: persistentPhotoUrl,
        passing_year: year,
        batch_id: batchInfo.batch_id,
        batch_name: batchInfo.batch_name,
        batch_name_bn: batchInfo.batch_name_bn,
        address: address ? address.trim() : undefined,
        occupation: occupation ? occupation.trim() : undefined,
        fee_amount: feeAmount,
        currency,
        payment_status: 'pending',
        registration_status: 'pending',
        token_code: tokenCode,
        checked_in: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Auto-create or find user profile first (satisfies event_registrations foreign key: user_id -> users)
      const users = db.get('users');
      const cleanEmail = (email || '').trim().toLowerCase();
      const normPhone = normalizedPhone;

      let user = users.find(u => {
        const uEmail = (u.email || '').trim().toLowerCase();
        const uCleanPhone = (u.phone || '').replace(/[\s\-\(\)]/g, '');
        const uNormPhone = uCleanPhone.startsWith('+88')
          ? uCleanPhone.slice(3)
          : uCleanPhone.startsWith('880')
          ? uCleanPhone.slice(2)
          : uCleanPhone;
        return (cleanEmail && uEmail === cleanEmail) || (normPhone && uNormPhone === normPhone);
      });

      if (!user) {
        user = {
          id: `user-${Date.now()}`,
          username: `alumni_${normPhone.slice(-6) || Math.floor(100000 + Math.random() * 900000)}`,
          name: newRegistration.full_name,
          email: cleanEmail || `${normPhone}@nanupuralumni.local`,
          phone: phone.trim(),
          role: 'alumni_member',
          passing_year: year,
          batch: batchInfo.batch_name,
          gender,
          blood_group,
          status: 'active',
          address: address || undefined,
          occupation: occupation || undefined,
          photo_url: persistentPhotoUrl,
          created_at: new Date().toISOString(),
        };
        users.push(user);
        db.set('users', users);
      } else {
        // Update user's details if missing
        let updatedUser = false;
        if (!user.address && address) { user.address = address; updatedUser = true; }
        if (!user.occupation && occupation) { user.occupation = occupation; updatedUser = true; }
        if (!user.photo_url && persistentPhotoUrl) { user.photo_url = persistentPhotoUrl; updatedUser = true; }
        if (!user.phone && phone) { user.phone = phone.trim(); updatedUser = true; }
        if (updatedUser) db.set('users', users);
      }

      newRegistration.user_id = user.id;

      // 2. Add registration record to database first (satisfies entry_tokens foreign key: registration_id -> event_registrations)
      registrations.unshift(newRegistration);
      db.set('registrations', registrations);

      // 3. Pre-issue EntryToken record in database with status 'pending_payment'
      const issuedToken = await TokenService.issueToken(newRegistration, 'pending_payment');
      newRegistration.token_id = issuedToken.id;
      newRegistration.qr_code_svg = issuedToken.qr_code_svg;
      db.set('registrations', registrations);

      // 4. Automatically add successfully uploaded registration image to the admin Media Library
      if (persistentPhotoUrl && savedPhotoInfo) {
        try {
          const mediaList = db.get('media') || [];
          const mediaId = `med-reg-${regId}`;
          const mediaItem: MediaItem = {
            id: mediaId,
            name: `Photo - ${newRegistration.full_name} (${batchInfo.batch_name})`,
            filename: savedPhotoInfo.filename,
            url: persistentPhotoUrl,
            type: savedPhotoInfo.mimeType || 'image/jpeg',
            size: `${(savedPhotoInfo.sizeBytes / 1024).toFixed(1)} KB`,
            size_bytes: savedPhotoInfo.sizeBytes,
            registration_id: regId,
            user_id: user.id,
            source: 'registration',
            attendee_name: newRegistration.full_name,
            passing_year: newRegistration.passing_year,
            token_code: tokenCode,
            created_at: new Date().toISOString(),
          };
          mediaList.unshift(mediaItem);
          db.set('media', mediaList);
          portableDb.saveMediaItem(mediaItem).catch(err => {
            console.warn('[Database] Media item persistence notice:', err.message);
          });
        } catch (mediaErr: any) {
          console.warn('[MediaSync] Registration photo sync notice:', mediaErr.message);
        }
      }

      // Retrieve CMS-configured manual payment accounts (bKash & Nagad)
      const allGateways = db.get('payment_gateways') || [];
      const manualGateways = allGateways
        .filter((g: PaymentGatewayConfig) => g.is_enabled && (g.payment_mode === 'manual' || g.code === 'bkash' || g.code === 'nagad'))
        .sort((a: PaymentGatewayConfig, b: PaymentGatewayConfig) => a.sort_order - b.sort_order)
        .map((g: PaymentGatewayConfig) => ({
          id: g.id,
          code: g.code,
          name: g.name,
          display_name_en: g.display_name_en,
          display_name_bn: g.display_name_bn,
          account_type: g.account_type || (g.code === 'bkash' ? 'Merchant' : 'Personal'),
          merchant_number: g.merchant_number || g.merchant_id || g.credentials?.merchant_number || (g.code === 'bkash' ? '01819-123456' : '01712-654321'),
          instructions_en: g.instructions_en || 'Send the registration fee to this number using your Token Number as payment reference.',
          instructions_bn: g.instructions_bn || 'পেমেন্ট রেফারেন্স হিসেবে আপনার Token Number ব্যবহার করে নির্ধারিত ফি পাঠান।',
          sort_order: g.sort_order,
        }));

      db.logAudit(
        newRegistration.full_name,
        email || phone,
        'REGISTRATION_SUBMITTED',
        'Registration',
        `Submitted registration for ${batchInfo.batch_name} (Token: ${tokenCode}, Fee: ৳${feeAmount}). Awaiting manual payment confirmation.`
      );

      const confConfig = db.get('registration_confirmation_config') || initialRegistrationConfirmationConfig;

      res.status(201).json({
        success: true,
        registration: newRegistration,
        token_code: tokenCode,
        token: issuedToken,
        confirmation_config: confConfig,
        manual_payment_info: {
          token_code: tokenCode,
          fee_amount: feeAmount,
          currency,
          gateways: manualGateways,
          confirmation_instructions_en: confConfig.payment_instructions_en || '1. Send the registration fee to the displayed bKash/Nagad number.\n2. Use your generated Token Number as the Payment Reference.\n3. After completing the payment, click Confirm Payment below.\n4. Your registration will be confirmed after payment verification.',
          confirmation_instructions_bn: confConfig.payment_instructions_bn || '১. উপরের bKash/Nagad নম্বরে নির্ধারিত রেজিস্ট্রেশন ফি পাঠান।\n২. Payment Reference হিসেবে আপনার Token Number ব্যবহার করুন।\n৩. পেমেন্ট সম্পন্ন করার পর নিচের Confirm Payment বাটন ব্যবহার করুন।\n৪. আপনার পেমেন্ট যাচাই করার পর রেজিস্ট্রেশন চূড়ান্তভাবে নিশ্চিত করা হবে।',
        },
        message: confConfig.confirmation_message_en || 'Your registration form has been successfully submitted. Please complete the manual bKash or Nagad payment using your Token Number as payment reference.',
        message_bn: confConfig.confirmation_message_bn || 'আপনার রেজিস্ট্রেশন ফর্ম সফলভাবে জমা হয়েছে। আপনার পেমেন্ট রেফারেন্স হিসেবে Token Number ব্যবহার করে বিকাশ বা নগদ-এ ফি প্রদান করুন।',
      });
    } catch (err: any) {
      console.error('Registration creation error:', err);
      const isFileErr = err.message && (
        err.message.includes('exceeds maximum allowed limit') ||
        err.message.includes('Invalid image') ||
        err.message.includes('Image format') ||
        err.message.includes('not permitted')
      );
      if (isFileErr) {
        return res.status(400).json({
          success: false,
          field: 'photo_url',
          error: 'INVALID_IMAGE_UPLOAD',
          message: err.message,
        });
      }
      res.status(500).json({ message: err.message || 'Internal server error' });
    }
  });

  app.get('/api/registrations/:id', (req, res) => {
    const registrations = db.get('registrations');
    const reg = registrations.find(r => r.id === req.params.id || r.token_code === req.params.id);
    if (!reg) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    res.json(reg);
  });

  // ==========================================
  // MANUAL PAYMENT SUBMISSION (REGISTRANT)
  // ==========================================
  app.post('/api/payments/manual-submit', (req, res) => PaymentController.storeManualPayment(req, res));
  app.post('/api/payments/confirm', (req, res) => PaymentController.storeManualPayment(req, res));
  app.post('/api/payments/manual', (req, res) => PaymentController.storeManualPayment(req, res));
  app.post('/api/registrations/:id/payment-confirmation', (req, res) => PaymentController.storeManualPayment(req, res));
  app.get('/api/registrations/:id/payment', (req, res) => PaymentController.getPaymentDetails(req, res));

  // ==========================================
  // ADMIN MANUAL PAYMENT REVIEW & VERIFICATION
  // ==========================================
  // Separate admin method to update the registration and payment status after review
  app.post('/api/admin/registrations/:id/review-payment', authenticate, requireRole(['super_admin', 'admin', 'finance_manager']), (req: AuthRequest, res) => PaymentController.updatePaymentStatusAfterReview(req, res));
  app.put('/api/admin/registrations/:id/payment-status', authenticate, requireRole(['super_admin', 'admin', 'finance_manager']), (req: AuthRequest, res) => PaymentController.updatePaymentStatusAfterReview(req, res));
  app.post('/api/admin/payments/review', authenticate, requireRole(['super_admin', 'admin', 'finance_manager']), (req: AuthRequest, res) => PaymentController.updatePaymentStatusAfterReview(req, res));

  // Admin convenience routes for approving and rejecting
  app.post('/api/admin/registrations/:id/verify-payment', authenticate, requireRole(['super_admin', 'admin', 'finance_manager']), (req: AuthRequest, res) => PaymentController.verifyManualPayment(req, res));
  app.post('/api/admin/registrations/:id/reject-payment', authenticate, requireRole(['super_admin', 'admin', 'finance_manager']), (req: AuthRequest, res) => PaymentController.rejectManualPayment(req, res));

  // Admin payment list
  app.get('/api/admin/payments', authenticate, requireRole(['super_admin', 'admin', 'finance_manager']), (req: AuthRequest, res) => PaymentController.getAllPayments(req, res));

  // Initiate Payment (Legacy / Automatic fallback)
  app.post('/api/payments/initiate', async (req, res) => {
    try {
      const result = await PaymentService.initiatePayment(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Verify Payment & Issue Entry Token (Automatic gateway webhook / callback)
  app.post('/api/payments/verify', async (req, res) => {
    try {
      const result = await PaymentService.verifyPayment(req.body);
      res.json(result);
    } catch (err: any) {
      console.error('Payment verification error:', err);
      res.status(400).json({ message: err.message });
    }
  });

  // ==========================================
  // TOKEN & GATEKEEPER CHECK-IN
  // ==========================================
  app.get(['/api/tokens/:code', '/api/tokens/verify/:code', '/api/tokens/lookup/:code'], (req, res) => {
    const result = TokenService.verifyToken(req.params.code);
    res.json(result);
  });

  // Gate Verification (Read-Only preview before check-in)
  app.get('/api/tokens/gate-verify/:identifier', async (req, res) => {
    try {
      const result = await TokenService.verifyGateAttendee(req.params.identifier);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ found: false, canCheckIn: false, message: err.message });
    }
  });

  // Gate Check-in (Mutates check-in status and logs to check_in_logs table)
  app.post('/api/tokens/check-in', async (req, res) => {
    const { token_code, identifier, operator_name, gate_name, verification_method } = req.body;
    const code = token_code || identifier;
    if (!code) {
      return res.status(400).json({ message: 'Token code or identifier is required' });
    }
    try {
      const result = await TokenService.checkIn(
        code,
        operator_name || 'Gate Officer',
        gate_name || 'Main Gate (Gate 1)',
        verification_method || 'qr_scan'
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get('/api/tokens/by-registration/:regId', (req, res) => {
    const tokens = db.get('tokens') || [];
    const token = tokens.find(t => t.registration_id === req.params.regId);
    if (!token) {
      return res.status(404).json({ message: 'Token not found for this registration' });
    }
    res.json(token);
  });

  // Admin Token Format Configuration
  app.get('/api/admin/tokens/config', authenticate, requireRole(['super_admin', 'admin', 'event_manager']), (req, res) => {
    const config = db.get('token_format_config') || initialTokenFormatConfig;
    res.json(config);
  });

  app.put('/api/admin/tokens/config', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    try {
      const current = db.get('token_format_config') || initialTokenFormatConfig;
      const updated: TokenFormatConfig = {
        ...current,
        ...req.body,
        prefix: (req.body.prefix || 'NASHS').trim().toUpperCase(),
        separator: (req.body.separator !== undefined ? req.body.separator : '-').trim(),
        starting_number: Math.max(1, parseInt(req.body.starting_number, 10) || 1),
        padding_length: Math.max(1, Math.min(8, parseInt(req.body.padding_length, 10) || 4)),
        use_batch_number: req.body.use_batch_number !== false,
        reset_per_batch: req.body.reset_per_batch !== false,
        is_active: req.body.is_active !== false,
      };

      db.set('token_format_config', updated);

      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'UPDATE_TOKEN_FORMAT_CONFIG',
        'TokenConfig',
        `Updated registration token serial format: Prefix=${updated.prefix}, Padding=${updated.padding_length}, ResetPerBatch=${updated.reset_per_batch}`
      );

      res.json({
        success: true,
        message: 'Registration token serial format configuration updated successfully.',
        config: updated,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to update token format configuration.' });
    }
  });

  // Admin Token List & Management
  app.get('/api/admin/tokens', authenticate, requireRole(['super_admin', 'admin', 'event_manager', 'finance_manager']), (req, res) => {
    const { search, batch, status } = req.query;
    let list = db.get('tokens') || [];

    if (search) {
      const q = ((search as string) || '').toLowerCase();
      list = list.filter(t =>
        (t.token_code || '').toLowerCase().includes(q) ||
        (t.member_name || '').toLowerCase().includes(q) ||
        (t.registration_id || '').toLowerCase().includes(q)
      );
    }

    if (batch) {
      list = list.filter(t => t.batch_name === batch);
    }

    if (status) {
      list = list.filter(t => t.status === status);
    }

    res.json({
      data: list,
      total: list.length,
    });
  });

  // Official PDF Entry Pass Generator (Server-Side PDFKit)
  app.get(['/api/tokens/:identifier/pdf', '/api/registrations/:identifier/pdf'], async (req, res) => {
    try {
      const identifier = (req.params.identifier || '').trim();
      const tokens = db.get('tokens') || [];
      const registrations = db.get('registrations') || [];
      const gates = db.get('gates') || [];

      // Find token or registration
      let token = tokens.find(
        (t: any) =>
          (t.token_code || '').toUpperCase() === identifier.toUpperCase() ||
          t.id === identifier ||
          t.registration_id === identifier
      );

      let reg = registrations.find(
        (r: any) =>
          r.id === identifier ||
          (r.token_code || '').toUpperCase() === identifier.toUpperCase() ||
          (token && r.id === token.registration_id)
      );

      if (!token && reg) {
        token = tokens.find((t: any) => t.registration_id === reg.id);
      }

      if (!token && !reg) {
        return res.status(404).json({ message: 'Entry pass or registration not found' });
      }

      const tokenCode = token ? token.token_code : reg?.token_code || `NASH-85-${identifier}`;
      const fullName = reg ? reg.full_name : token?.member_name || 'Alumni Member';
      const batchName = reg ? reg.batch_name : token?.batch_name || 'Alumni Batch';
      const batchNameBn = reg ? reg.batch_name_bn : token?.batch_name_bn;
      const passingYear = reg?.passing_year || '';
      const bloodGroup = reg?.blood_group || '';
      const occupation = reg?.occupation || '';
      const phone = reg?.phone || '';

      // Determine Gate from database
      const activeGates = gates.filter((g: any) => g.is_active).sort((a: any, b: any) => a.display_order - b.display_order);
      let gateName = activeGates[0]?.gate_name || 'Gate 01 - Main Gate (VIP & Guests)';
      if (reg?.passing_year && activeGates.length > 1) {
        const year = Number(reg.passing_year);
        if (year <= 1990 && activeGates[1]) gateName = activeGates[1].gate_name;
        else if (year <= 2010 && activeGates[2]) gateName = activeGates[2].gate_name;
        else if (activeGates[3]) gateName = activeGates[3].gate_name;
      }

      const pdfBuffer = await generateEntryPassPDF({
        tokenCode,
        fullName,
        batchName,
        batchNameBn,
        passingYear,
        registrationId: reg?.id,
        bloodGroup,
        tShirtSize: reg?.t_shirt_size || undefined,
        occupation,
        phone,
        eventDate: 'Saturday, 16 January 2027 • 08:00 AM onwards',
        venue: 'Nanupur Abu Sobhan High School Premises, Fatikchhari, Chattogram',
        gateName,
        status: reg?.payment_status || token?.status || 'pending',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="NASH-85-Pass-${tokenCode}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error: any) {
      console.error('Failed to generate PDF pass:', error);
      res.status(500).json({ message: 'Error generating PDF pass', error: error.message });
    }
  });

  // Mail / Email Settings (Database & CMS Driven)
  app.get('/api/admin/mail-settings', authenticate, requireRole(['super_admin', 'admin']), (req, res) => {
    try {
      const settings = MailService.getSettings(true);
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put('/api/admin/mail-settings', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    try {
      const updated = MailService.updateSettings(req.body, req.user);
      res.json({
        success: true,
        message: 'Email configuration successfully saved.',
        settings: updated,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/admin/mail-settings/test', authenticate, requireRole(['super_admin', 'admin']), async (req: AuthRequest, res) => {
    try {
      const toEmail = req.body.to_email || req.user?.email || 'admin@nanupuralumni.org';
      const result = await MailService.sendTestEmail(toEmail, req.body.settings);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Send confirmation email with official PDF pass attachment
  app.post('/api/registrations/:id/send-confirmation-email', async (req, res) => {
    const registrations = db.get('registrations');
    const tokens = db.get('tokens') || [];
    const reg = registrations.find(r => r.id === req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    let token = tokens.find(t => t.registration_id === reg.id || t.token_code === reg.token_code);
    if (!token) {
      token = {
        id: `tok-${Date.now()}`,
        token_code: reg.token_code || `NASH-85-${Date.now().toString().slice(-4)}`,
        registration_id: reg.id,
        event_id: reg.event_id || 'event-85th-anniversary',
        member_name: reg.full_name,
        batch_name: reg.batch_name || 'Alumni',
        status: 'active',
        qr_code_svg: reg.qr_code_svg || '',
        checked_in: false,
        created_at: new Date().toISOString(),
      };
    }

    try {
      const gates = db.get('gates') || [];
      const activeGates = gates.filter((g: any) => g.is_active).sort((a: any, b: any) => a.display_order - b.display_order);
      const gateName = activeGates[0]?.gate_name || 'Gate 01 - Main Gate (VIP, Alumni & Delegates)';

      const pdfBuffer = await generateEntryPassPDF({
        tokenCode: reg.token_code || token.token_code,
        fullName: reg.full_name,
        batchName: reg.batch_name || token.batch_name || 'Alumni Batch',
        batchNameBn: reg.batch_name_bn || token.batch_name_bn,
        passingYear: reg.passing_year,
        registrationId: reg.id,
        bloodGroup: reg.blood_group,
        tShirtSize: reg.t_shirt_size || undefined,
        occupation: reg.occupation,
        phone: reg.phone,
        eventDate: 'Saturday, 16 January 2027 • 08:00 AM onwards',
        venue: 'Nanupur Abu Sobhan High School Premises, Fatikchhari, Chattogram',
        gateName,
        status: reg.payment_status || 'paid',
      });

      const mailResult = await MailService.sendRegistrationConfirmationEmail(reg, token, pdfBuffer);

      res.json({
        success: mailResult.success,
        message: mailResult.success
          ? `Official confirmation email and PDF Entry Pass successfully dispatched to ${reg.email || reg.phone}.`
          : `Email dispatch failed: ${mailResult.error}`,
        mail_result: mailResult,
      });
    } catch (err: any) {
      console.error('Failed to generate PDF pass or send email:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Download / view printable pass HTML
  app.get('/api/registrations/:id/pass-view', (req, res) => {
    const registrations = db.get('registrations');
    const reg = registrations.find(r => r.id === req.params.id);
    if (!reg) return res.status(404).send('Registration not found');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Entry Pass - ${reg.full_name}</title>
  <style>
    body { font-family: sans-serif; background: #f8fafc; padding: 20px; display: flex; justify-content: center; }
    .card { background: white; border: 2px solid #0f4d2a; border-radius: 16px; padding: 24px; max-width: 480px; width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
    .token { font-family: monospace; font-size: 20px; font-weight: bold; color: #0f4d2a; background: #ecfdf5; padding: 8px; border-radius: 8px; text-align: center; margin: 12px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .label { color: #64748b; font-weight: 500; }
    .val { font-weight: 700; color: #0f172a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0; color:#0f4d2a;">Nanupur Abu Sobhan High School</h2>
      <p style="margin:4px 0 0 0; color:#64748b; font-size:12px;">85th Anniversary Celebration & Alumni Reunion 2027</p>
    </div>
    <div class="token">${reg.token_code || 'PENDING ISSUANCE'}</div>
    <div class="row"><span class="label">Name:</span><span class="val">${reg.full_name}</span></div>
    <div class="row"><span class="label">Passing Year / Batch:</span><span class="val">${reg.passing_year} (${reg.batch_name})</span></div>
    <div class="row"><span class="label">T-Shirt Size:</span><span class="val">${reg.t_shirt_size || 'L'}</span></div>
    <div class="row"><span class="label">Mobile:</span><span class="val">${reg.phone}</span></div>
    <div class="row"><span class="label">Payment Status:</span><span class="val" style="color: #059669; text-transform: uppercase;">${reg.payment_status}</span></div>
    <div class="row"><span class="label">Event Date:</span><span class="val">16 January 2027</span></div>
    <div class="row"><span class="label">Venue:</span><span class="val">School Premises, Fatickchhari</span></div>
    <div style="margin-top: 20px; text-align: center;">
      <button onclick="window.print()" style="background:#0f4d2a; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">Print Official Pass</button>
    </div>
  </div>
</body>
</html>`;
    res.send(html);
  });

  // Member Portal
  app.get('/api/member/registrations', authenticate, (req: AuthRequest, res) => {
    const registrations = db.get('registrations');
    const userRegs = registrations.filter(r =>
      r.user_id === req.user?.id ||
      (req.user?.email && r.email === req.user.email) ||
      (req.user?.phone && r.phone === req.user.phone)
    );
    res.json(userRegs);
  });

  app.get('/api/member/profile', authenticate, (req: AuthRequest, res) => {
    const users = db.get('users') || [];
    const user = users.find(u => u.id === req.user?.id);
    if (!user) {
      return res.status(404).json({ message: 'User profile not found' });
    }
    const { password_hash, ...safeUser } = user as any;
    res.json(safeUser);
  });

  app.put('/api/member/profile', authenticate, async (req: AuthRequest, res) => {
    const users = db.get('users') || [];
    const index = users.findIndex(u => u.id === req.user?.id);
    if (index === -1) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    const {
      username,
      name,
      name_bn,
      phone,
      blood_group,
      gender,
      occupation,
      designation,
      organization,
      work_location,
      business_name,
      business_type,
      business_address,
      business_website,
      address,
      bio,
      photo_url,
      privacy,
    } = req.body;

    const existing = users[index];

    // Check username uniqueness if member changes their username
    let validatedUsername = existing.username;
    if (username !== undefined && username !== null) {
      const cleanUsername = username.trim().toLowerCase();
      if (!cleanUsername) {
        return res.status(400).json({ message: 'Username cannot be empty.' });
      }
      if (cleanUsername !== (existing.username || '').trim().toLowerCase()) {
        if (users.some(u => u.id !== existing.id && (u.username || '').trim().toLowerCase() === cleanUsername)) {
          return res.status(409).json({
            message: 'This username is already taken. Please choose another username.',
            message_bn: 'এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হয়েছে। অনুগ্রহ করে অন্য একটি ইউজারনেম বেছে নিন।'
          });
        }
        validatedUsername = cleanUsername;
      }
    }

    const persistentPhotoUrl = photo_url !== undefined
      ? await FileStorageService.processIncomingPhotoUrl(photo_url, 'photos')
      : existing.photo_url;

    const updated = {
      ...existing,
      username: validatedUsername,
      name: name !== undefined ? name.trim() : existing.name,
      name_bn: name_bn !== undefined ? name_bn.trim() : existing.name_bn,
      phone: phone !== undefined ? phone.trim() : existing.phone,
      blood_group: blood_group !== undefined ? blood_group : existing.blood_group,
      gender: gender !== undefined ? gender : existing.gender,
      occupation: occupation !== undefined ? occupation.trim() : existing.occupation,
      designation: designation !== undefined ? designation.trim() : existing.designation,
      organization: organization !== undefined ? organization.trim() : existing.organization,
      work_location: work_location !== undefined ? work_location.trim() : existing.work_location,
      business_name: business_name !== undefined ? business_name.trim() : existing.business_name,
      business_type: business_type !== undefined ? business_type.trim() : existing.business_type,
      business_address: business_address !== undefined ? business_address.trim() : existing.business_address,
      business_website: business_website !== undefined ? business_website.trim() : existing.business_website,
      address: address !== undefined ? address.trim() : existing.address,
      bio: bio !== undefined ? bio.trim() : existing.bio,
      photo_url: persistentPhotoUrl,
      privacy: privacy !== undefined ? privacy : existing.privacy,
    };

    users[index] = updated;
    db.set('users', users);

    // Synchronize linked registrations so user info stays unified across the entire portal
    const registrations = db.get('registrations') || [];
    let regsModified = false;
    registrations.forEach(r => {
      if (r.user_id === updated.id || (r.email && r.email.toLowerCase() === updated.email.toLowerCase())) {
        if (updated.name) r.full_name = updated.name;
        if (updated.phone) r.phone = updated.phone;
        if (updated.blood_group) r.blood_group = updated.blood_group;
        if (updated.gender) r.gender = updated.gender;
        if (updated.photo_url) r.photo_url = updated.photo_url;
        if (updated.address) r.address = updated.address;
        if (updated.occupation) r.occupation = updated.occupation;
        if (updated.designation) r.designation = updated.designation;
        if (updated.organization) r.organization = updated.organization;
        regsModified = true;
      }
    });
    if (regsModified) {
      db.set('registrations', registrations);
    }

    db.logAudit(
      updated.name,
      updated.email,
      'UPDATE_MEMBER_PROFILE',
      'User',
      `Member updated their profile (Career: ${updated.occupation || 'N/A'}, Business: ${updated.business_name || 'N/A'})`
    );

    const { password_hash, ...safeUpdated } = updated as any;
    res.json({ success: true, user: safeUpdated });
  });

  // ==========================================
  // ADMIN DASHBOARD & ADVANCED REPORTING
  // ==========================================
  app.get('/api/admin/dashboard', authenticate, requireRole(['super_admin', 'admin', 'event_manager', 'content_manager', 'finance_manager']), (req, res) => {
    const registrations = db.get('registrations') || [];
    const batches = db.get('batches') || [];
    const tokens = db.get('tokens') || [];
    const events = db.get('events') || [];
    const currentEvent = events[0];

    const totalRegs = registrations.length;
    const paidRegs = registrations.filter(r => r.payment_status === 'paid');
    const pendingRegs = registrations.filter(r => r.payment_status === 'pending');
    const failedRegs = registrations.filter(r => r.payment_status === 'failed');

    const totalRevenue = paidRegs.reduce((sum, r) => sum + (r.fee_amount || 1000), 0);
    const checkedInCount = tokens.filter(t => t.checked_in).length;

    // Batch breakdown using stored passing year
    const batchMap = new Map<string, { count: number; paid: number; year: number }>();
    registrations.forEach(r => {
      const year = r.passing_year || (r.batch_name ? parseInt(r.batch_name.match(/(?:19|20)\d{2}/)?.[0] || '0', 10) : 0);
      const bName = year > 0 ? `SSC Batch ${year}` : (r.batch_name || 'Alumni Batch');
      const entry = batchMap.get(bName) || { count: 0, paid: 0, year: year || 0 };
      entry.count += 1;
      if (r.payment_status === 'paid') {
        entry.paid += 1;
      }
      batchMap.set(bName, entry);
    });

    const batchDistribution = Array.from(batchMap.entries()).map(([batch, stat]) => ({
      batch,
      count: stat.count,
      paid: stat.paid,
      year: stat.year,
    })).sort((a, b) => b.count - a.count).slice(0, 10);

    res.json({
      total_registrations: totalRegs,
      paid_registrations: paidRegs.length,
      pending_payments: pendingRegs.length,
      failed_payments: failedRegs.length,
      total_revenue: totalRevenue,
      active_batches: batches.length,
      tokens_generated: tokens.length,
      checked_in_count: checkedInCount,
      remaining_capacity: Math.max(0, (currentEvent?.max_capacity || 5000) - paidRegs.length),
      recent_registrations: registrations.slice(0, 10),
      batch_distribution: batchDistribution,
    });
  });

  app.get('/api/admin/registrations', authenticate, requireRole(['super_admin', 'admin', 'event_manager', 'finance_manager']), (req, res) => {
    const { search, batch, payment_status, page = 1, limit = 50 } = req.query;
    let list = db.get('registrations') || [];

    if (search) {
      const q = ((search as string) || '').toLowerCase();
      list = list.filter(r =>
        (r.full_name || '').toLowerCase().includes(q) ||
        (r.id || '').toLowerCase().includes(q) ||
        (r.token_code && r.token_code.toLowerCase().includes(q)) ||
        (r.phone && r.phone.includes(q)) ||
        (r.passing_year && r.passing_year.toString().includes(q))
      );
    }

    if (batch) {
      list = list.filter(r => r.batch_name === batch || r.passing_year === parseInt(batch as string, 10));
    }

    if (payment_status) {
      list = list.filter(r => r.payment_status === payment_status);
    }

    const total = list.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginated = list.slice(startIndex, startIndex + Number(limit));

    res.json({
      data: paginated,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  });

  // Admin Single Manual Registration Creation
  app.post('/api/admin/registrations', authenticate, requireRole(['super_admin', 'admin', 'event_manager']), async (req: AuthRequest, res) => {
    const {
      full_name,
      phone,
      email,
      dob,
      gender,
      passing_year,
      blood_group,
      address,
      occupation,
      fee_amount,
      payment_status = 'paid',
      payment_method = 'offline_cash',
      checked_in = false,
      photo_url,
      notes,
    } = req.body;

    if (!full_name || !phone || !passing_year) {
      return res.status(400).json({ message: 'Full name, phone, and passing year are required.' });
    }

    const yearNum = parseInt(passing_year, 10);
    const batchInfo = BatchService.getBatchByPassingYear(yearNum);
    const registrations = db.get('registrations') || [];
    const tokens = db.get('tokens') || [];
    const regConfig = db.get('registration_config');

    const regId = `REG-85-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
    const isPaid = payment_status === 'paid';
    const tokenCode = isPaid ? TokenService.generateFormattedTokenCode(yearNum, batchInfo.batch_name) : undefined;

    let qrCodeSvg: string | undefined;
    if (tokenCode) {
      try {
        qrCodeSvg = await QRCode.toString(`${process.env.APP_URL || ''}/verify?token=${tokenCode}`, {
          type: 'svg',
          margin: 1,
          color: { dark: '#0f4d2a', light: '#ffffff' },
        });
      } catch {
        qrCodeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#ffffff"/><path d="M10 10h30v30h-30z M20 20h10v10h-10z M60 10h30v30h-30z M70 20h10v10h-10z M10 60h30v30h-30z M20 70h10v10h-10z M55 55h10v10h-10z M75 55h15v10h-15z M55 75h10v15h-10z M75 75h15v15h-15z" fill="#0f4d2a"/></svg>`;
      }

      tokens.push({
        id: `tok-${Date.now()}`,
        token_code: tokenCode,
        registration_id: regId,
        event_id: 'event-85th-anniversary',
        member_name: full_name,
        batch_name: batchInfo.batch_name,
        batch_name_bn: batchInfo.batch_name_bn,
        qr_code_svg: qrCodeSvg,
        status: checked_in ? 'used' : 'active',
        checked_in: !!checked_in,
        checked_in_at: checked_in ? new Date().toISOString() : undefined,
        created_at: new Date().toISOString(),
      });
      db.set('tokens', tokens);
    }

    const allowedSizes = ['M', 'L', 'XL', 'XXL', 'XXXL'];
    const validAdminSize = req.body.t_shirt_size && allowedSizes.includes(req.body.t_shirt_size.toString().trim().toUpperCase())
      ? req.body.t_shirt_size.toString().trim().toUpperCase()
      : 'L';

    const savedAdminPhoto = await FileStorageService.processIncomingPhotoWithMetadata(photo_url, 'photos');
    const persistentAdminPhoto = savedAdminPhoto ? savedAdminPhoto.url : undefined;

    const newReg: Registration = {
      id: regId,
      event_id: 'event-85th-anniversary',
      full_name,
      dob: dob || '1990-01-01',
      gender: gender || 'male',
      blood_group: blood_group || undefined,
      t_shirt_size: validAdminSize,
      phone,
      email: email || undefined,
      passing_year: yearNum,
      batch_id: batchInfo.batch_id,
      batch_name: batchInfo.batch_name,
      batch_name_bn: batchInfo.batch_name_bn,
      address: address || undefined,
      occupation: occupation || undefined,
      photo_url: persistentAdminPhoto,
      fee_amount: fee_amount ? Number(fee_amount) : (regConfig?.fee_amount || 1000),
      currency: regConfig?.currency || 'BDT',
      payment_status: payment_status as any,
      payment_method: payment_method as any,
      registration_status: (payment_status === 'paid' ? 'confirmed' : 'pending') as any,
      token_code: tokenCode,
      qr_code_svg: qrCodeSvg,
      checked_in: !!checked_in,
      checked_in_at: checked_in ? new Date().toISOString() : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    registrations.unshift(newReg);
    db.set('registrations', registrations);

    if (persistentAdminPhoto && savedAdminPhoto) {
      try {
        const mediaList = db.get('media') || [];
        const mediaId = `med-reg-${regId}`;
        const mediaItem: MediaItem = {
          id: mediaId,
          name: `Photo - ${full_name} (${batchInfo.batch_name})`,
          filename: savedAdminPhoto.filename,
          url: persistentAdminPhoto,
          type: savedAdminPhoto.mimeType || 'image/jpeg',
          size: `${(savedAdminPhoto.sizeBytes / 1024).toFixed(1)} KB`,
          size_bytes: savedAdminPhoto.sizeBytes,
          registration_id: regId,
          source: 'registration',
          attendee_name: full_name,
          passing_year: yearNum,
          token_code: tokenCode,
          created_at: new Date().toISOString(),
        };
        mediaList.unshift(mediaItem);
        db.set('media', mediaList);
        portableDb.saveMediaItem(mediaItem).catch(() => {});
      } catch {}
    }

    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'CREATE_REGISTRATION',
      'Registration',
      `Manually registered ${newReg.full_name} (${newReg.id}, Batch: ${newReg.batch_name}, Token: ${tokenCode || 'None'})`
    );

    res.status(201).json(newReg);
  });

  app.put('/api/admin/registrations/:id', authenticate, requireRole(['super_admin', 'admin', 'event_manager']), async (req: AuthRequest, res) => {
    const registrations = db.get('registrations') || [];
    const index = registrations.findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const existing = registrations[index];
    const updates = { ...req.body };

    // If passing_year was updated, re-determine batch unless batch_name explicitly provided
    if (updates.passing_year && updates.passing_year !== existing.passing_year && !updates.batch_name) {
      const yearNum = parseInt(updates.passing_year, 10);
      const bInfo = BatchService.getBatchByPassingYear(yearNum);
      updates.batch_id = bInfo.batch_id;
      updates.batch_name = bInfo.batch_name;
      updates.batch_name_bn = bInfo.batch_name_bn;
    }

    if (updates.t_shirt_size) {
      const allowedSizes = ['M', 'L', 'XL', 'XXL', 'XXXL'];
      const upper = updates.t_shirt_size.toString().trim().toUpperCase();
      updates.t_shirt_size = allowedSizes.includes(upper) ? upper : existing.t_shirt_size || 'L';
    }

    const tokens = db.get('tokens') || [];

    // If payment_status is updated to 'paid' and token_code is absent, generate it!
    if (updates.payment_status === 'paid' && !existing.token_code && !updates.token_code) {
      const year = updates.passing_year || existing.passing_year;
      const bName = updates.batch_name || existing.batch_name;
      const tokenCode = TokenService.generateFormattedTokenCode(year, bName);
      let qrCodeSvg: string | undefined;
      try {
        qrCodeSvg = await QRCode.toString(`${process.env.APP_URL || ''}/verify?token=${tokenCode}`, {
          type: 'svg',
          margin: 1,
          color: { dark: '#0f4d2a', light: '#ffffff' },
        });
      } catch {
        qrCodeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#ffffff"/><path d="M10 10h30v30h-30z M20 20h10v10h-10z M60 10h30v30h-30z M70 20h10v10h-10z M10 60h30v30h-30z M20 70h10v10h-10z M55 55h10v10h-10z M75 55h15v10h-15z M55 75h10v15h-10z M75 75h15v15h-15z" fill="#0f4d2a"/></svg>`;
      }
      updates.token_code = tokenCode;
      updates.qr_code_svg = qrCodeSvg;

      tokens.push({
        id: `tok-${Date.now()}`,
        token_code: tokenCode,
        registration_id: existing.id,
        event_id: existing.event_id || 'event-85th-anniversary',
        member_name: existing.full_name,
        batch_name: existing.batch_name,
        batch_name_bn: existing.batch_name_bn,
        qr_code_svg: qrCodeSvg,
        status: updates.checked_in ? 'used' : 'active',
        checked_in: !!updates.checked_in,
        checked_in_at: updates.checked_in ? new Date().toISOString() : undefined,
        created_at: new Date().toISOString(),
      });
      db.set('tokens', tokens);
    }

    // If checked_in changed, sync with tokens
    if (typeof updates.checked_in === 'boolean' && updates.checked_in !== existing.checked_in) {
      updates.checked_in_at = updates.checked_in ? (updates.checked_in_at || new Date().toISOString()) : undefined;
      const tokIdx = tokens.findIndex(t => t.registration_id === existing.id || t.token_code === existing.token_code);
      if (tokIdx !== -1) {
        tokens[tokIdx].checked_in = updates.checked_in;
        tokens[tokIdx].status = updates.checked_in ? 'used' : 'active';
        tokens[tokIdx].checked_in_at = updates.checked_in_at;
        db.set('tokens', tokens);
      }
    }

    // If photo_url is provided, persist it to disk storage and sync Media Library
    if (updates.photo_url !== undefined && updates.photo_url !== existing.photo_url) {
      const savedUpdatedPhoto = await FileStorageService.processIncomingPhotoWithMetadata(updates.photo_url, 'photos');
      if (savedUpdatedPhoto) {
        updates.photo_url = savedUpdatedPhoto.url;
        try {
          const mediaList = db.get('media') || [];
          const mediaId = `med-reg-${existing.id}`;
          const mIdx = mediaList.findIndex(m => m.registration_id === existing.id || m.id === mediaId);
          const mediaItem: MediaItem = {
            id: mediaId,
            name: `Photo - ${updates.full_name || existing.full_name} (${updates.batch_name || existing.batch_name})`,
            filename: savedUpdatedPhoto.filename,
            url: savedUpdatedPhoto.url,
            type: savedUpdatedPhoto.mimeType || 'image/jpeg',
            size: `${(savedUpdatedPhoto.sizeBytes / 1024).toFixed(1)} KB`,
            size_bytes: savedUpdatedPhoto.sizeBytes,
            registration_id: existing.id,
            user_id: existing.user_id,
            source: 'registration',
            attendee_name: updates.full_name || existing.full_name,
            passing_year: updates.passing_year || existing.passing_year,
            token_code: updates.token_code || existing.token_code,
            created_at: new Date().toISOString(),
          };
          if (mIdx !== -1) mediaList[mIdx] = mediaItem;
          else mediaList.unshift(mediaItem);
          db.set('media', mediaList);
          portableDb.saveMediaItem(mediaItem).catch(() => {});
        } catch {}
      }
    }

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    registrations[index] = updated;
    db.set('registrations', registrations);

    // If registration is linked to a user, sync user record so user info stays unified
    if (updated.user_id || updated.email) {
      const users = db.get('users') || [];
      const userIdx = users.findIndex(u => (updated.user_id && u.id === updated.user_id) || (updated.email && u.email.toLowerCase() === updated.email.toLowerCase()));
      if (userIdx !== -1) {
        let userMod = false;
        if (updated.full_name && users[userIdx].name !== updated.full_name) {
          users[userIdx].name = updated.full_name;
          userMod = true;
        }
        if (updated.phone && users[userIdx].phone !== updated.phone) {
          users[userIdx].phone = updated.phone;
          userMod = true;
        }
        if (updated.blood_group && users[userIdx].blood_group !== updated.blood_group) {
          users[userIdx].blood_group = updated.blood_group;
          userMod = true;
        }
        if (updated.photo_url && users[userIdx].photo_url !== updated.photo_url) {
          users[userIdx].photo_url = updated.photo_url;
          userMod = true;
        }
        if (userMod) {
          db.set('users', users);
        }
      }
    }

    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'UPDATE_REGISTRATION',
      'Registration',
      `Updated registration ${updated.id} (${updated.full_name})`
    );

    res.json(updated);
  });

  // Delete Registration
  app.delete('/api/admin/registrations/:id', authenticate, requireRole(['super_admin', 'admin']), async (req: AuthRequest, res) => {
    let registrations = db.get('registrations') || [];
    const target = registrations.find(r => r.id === req.params.id);
    if (!target) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    // Remove registration
    registrations = registrations.filter(r => r.id !== req.params.id);
    db.set('registrations', registrations);
    await db.deleteRecord('registrations', req.params.id);

    // Remove matching token if exists
    let tokens = db.get('tokens') || [];
    tokens = tokens.filter(t => t.registration_id !== req.params.id && t.token_code !== target.token_code);
    db.set('tokens', tokens);
    if (target.token_code) {
      await db.deleteRecord('tokens', target.token_code);
    }
    await db.deleteRecord('tokens', req.params.id);

    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'DELETE_REGISTRATION',
      'Registration',
      `Deleted registration ${target.id} (${target.full_name}, Batch: ${target.batch_name})`
    );

    res.json({ success: true, message: `Registration ${target.id} deleted successfully.` });
  });

  // Manual Bulk Registration Import
  app.post('/api/admin/registrations/import', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const { rows, default_payment_status, default_event_id } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'Rows array is required and cannot be empty.' });
    }

    const registrations = db.get('registrations') || [];
    const tokens = db.get('tokens') || [];
    const users = db.get('users') || [];
    const regConfig = db.get('registration_config');
    const feeAmount = regConfig?.fee_amount || 1000;
    const currency = regConfig?.currency || 'BDT';

    const results = {
      total: rows.length,
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    rows.forEach((row: any, idx: number) => {
      const rowNum = idx + 1;
      const fullName = (row.full_name || row['Full Name'] || row.name || '').trim();
      const phone = (row.phone || row['Mobile'] || row['Phone'] || '').toString().trim();
      const passingYearRaw = row.passing_year || row['Passing Year'] || row.year;
      const passingYear = parseInt(passingYearRaw, 10);
      const email = (row.email || row['Email'] || '').trim();
      const gender = (row.gender || row['Gender'] || 'male').toLowerCase();
      const bloodGroup = (row.blood_group || row['Blood Group'] || '').trim();
      const address = (row.address || row['Address'] || '').trim();
      const occupation = (row.occupation || row['Occupation'] || '').trim();
      const paymentStatus = (row.payment_status || default_payment_status || 'paid').toLowerCase();

      if (!fullName) {
        results.errors.push(`Row ${rowNum}: Missing Full Name`);
        results.skipped++;
        return;
      }
      if (!phone) {
        results.errors.push(`Row ${rowNum}: Missing Phone Number for "${fullName}"`);
        results.skipped++;
        return;
      }
      if (isNaN(passingYear) || passingYear < 1942 || passingYear > 2035) {
        results.errors.push(`Row ${rowNum}: Invalid passing year (${passingYearRaw}) for "${fullName}"`);
        results.skipped++;
        return;
      }

      // Check duplicate
      const duplicate = registrations.find(r => r.phone === phone && r.passing_year === passingYear);
      if (duplicate) {
        results.errors.push(`Row ${rowNum}: Duplicate record found for ${fullName} (${phone}, Year ${passingYear})`);
        results.skipped++;
        return;
      }

      const batchInfo = BatchService.getBatchByPassingYear(passingYear);
      const regId = `REG-85-IMP-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;

      const newReg: Registration = {
        id: regId,
        event_id: default_event_id || 'event-85th-anniversary',
        full_name: fullName,
        dob: row.dob || '1990-01-01',
        gender: gender.includes('f') ? 'female' : 'male',
        blood_group: bloodGroup || undefined,
        phone,
        email: email || undefined,
        passing_year: passingYear,
        batch_id: batchInfo.batch_id,
        batch_name: batchInfo.batch_name,
        batch_name_bn: batchInfo.batch_name_bn,
        address: address || undefined,
        occupation: occupation || undefined,
        fee_amount: feeAmount,
        currency,
        payment_status: paymentStatus === 'paid' ? 'paid' : 'pending',
        registration_status: paymentStatus === 'paid' ? 'confirmed' : 'pending',
        checked_in: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // If paid, issue entry token immediately
      if (paymentStatus === 'paid') {
        const tokenCode = `NASH-85-2027-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const tokenId = `tok-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        newReg.token_id = tokenId;
        newReg.token_code = tokenCode;

        tokens.push({
          id: tokenId,
          token_code: tokenCode,
          registration_id: regId,
          event_id: newReg.event_id,
          member_name: newReg.full_name,
          batch_name: newReg.batch_name,
          batch_name_bn: newReg.batch_name_bn,
          status: 'active',
          qr_code_svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ffffff"/><rect x="10" y="10" width="80" height="80" fill="#0f4d2a" rx="4"/></svg>`,
          checked_in: false,
          created_at: new Date().toISOString(),
        });
      }

      // Ensure user account exists
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPhone = (phone || '').replace(/[\s\-\(\)]/g, '');
      const normPhone = cleanPhone.startsWith('+88')
        ? cleanPhone.slice(3)
        : cleanPhone.startsWith('880')
        ? cleanPhone.slice(2)
        : cleanPhone;

      let user = users.find(u => {
        const uEmail = (u.email || '').trim().toLowerCase();
        const uCleanPhone = (u.phone || '').replace(/[\s\-\(\)]/g, '');
        const uNormPhone = uCleanPhone.startsWith('+88')
          ? uCleanPhone.slice(3)
          : uCleanPhone.startsWith('880')
          ? uCleanPhone.slice(2)
          : uCleanPhone;
        return (cleanEmail && uEmail === cleanEmail) || (normPhone && uNormPhone === normPhone);
      });

      if (!user) {
        user = {
          id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          username: `alumni_${normPhone.slice(-6) || Math.floor(100000 + Math.random() * 900000)}`,
          name: fullName,
          email: cleanEmail || `${normPhone}@nanupuralumni.local`,
          phone: phone.trim(),
          role: 'alumni_member',
          passing_year: passingYear,
          batch: batchInfo.batch_name,
          gender: newReg.gender,
          blood_group: newReg.blood_group,
          status: 'active',
          created_at: new Date().toISOString(),
        };
        users.push(user);
      }
      newReg.user_id = user.id;

      registrations.unshift(newReg);
      results.imported++;
    });

    db.set('registrations', registrations);
    db.set('tokens', tokens);
    db.set('users', users);

    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'IMPORT_REGISTRATIONS',
      'Registration',
      `Imported ${results.imported} registrations from bulk upload (${results.skipped} skipped)`
    );

    res.json({
      success: true,
      results,
      message: `Successfully processed: ${results.imported} imported, ${results.skipped} skipped.`,
    });
  });

  app.get('/api/admin/payments', authenticate, requireRole(['super_admin', 'admin', 'finance_manager']), (req, res) => {
    res.json(db.get('payments') || []);
  });

  // Committee Admin
  app.post('/api/admin/committee', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const committee = db.get('committee') || [];
    const newMember = {
      ...req.body,
      id: `comm-${Date.now()}`,
      order_index: committee.length + 1,
      is_active: true,
    };
    committee.push(newMember);
    db.set('committee', committee);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_COMMITTEE_MEMBER', 'Committee', `Added ${newMember.name_en}`);
    res.status(201).json(newMember);
  });

  app.put('/api/admin/committee/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const committee = db.get('committee') || [];
    const index = committee.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Member not found' });

    committee[index] = { ...committee[index], ...req.body };
    db.set('committee', committee);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_COMMITTEE_MEMBER', 'Committee', `Updated ${committee[index].name_en}`);
    res.json(committee[index]);
  });

  app.delete('/api/admin/committee/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    let committee = db.get('committee') || [];
    committee = committee.filter(c => c.id !== req.params.id);
    db.set('committee', committee);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_COMMITTEE_MEMBER', 'Committee', `Deleted member ${req.params.id}`);
    res.json({ success: true });
  });

  // Notices Admin
  app.post('/api/admin/notices', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const notices = db.get('notices') || [];
    const newNotice = {
      ...req.body,
      id: `not-${Date.now()}`,
      publish_date: req.body.publish_date || new Date().toISOString().split('T')[0],
      is_active: true,
    };
    notices.unshift(newNotice);
    db.set('notices', notices);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_NOTICE', 'Notice', `Created notice: ${newNotice.title_en}`);
    res.status(201).json(newNotice);
  });

  app.put('/api/admin/notices/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const notices = db.get('notices') || [];
    const index = notices.findIndex(n => n.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Notice not found' });

    notices[index] = { ...notices[index], ...req.body };
    db.set('notices', notices);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_NOTICE', 'Notice', `Updated notice: ${notices[index].title_en}`);
    res.json(notices[index]);
  });

  app.delete('/api/admin/notices/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    let notices = db.get('notices') || [];
    notices = notices.filter(n => n.id !== req.params.id);
    db.set('notices', notices);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_NOTICE', 'Notice', `Deleted notice ${req.params.id}`);
    res.json({ success: true });
  });

  // File & Photo Upload Endpoint
  app.post('/api/upload/photo', async (req, res) => {
    try {
      const { image, data, folder = 'photos' } = req.body;
      const payload = image || data;
      if (!payload) {
        return res.status(400).json({ success: false, message: 'No image data provided.' });
      }
      const saved = await FileStorageService.saveBase64Image(payload, folder);
      if (!saved) {
        return res.status(400).json({ success: false, message: 'Invalid image format or data.' });
      }
      res.json({
        success: true,
        url: saved.url,
        filename: saved.filename,
        mime_type: saved.mimeType,
        size_bytes: saved.sizeBytes,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'File upload failed.' });
    }
  });

  // ==========================================
  // MEDIA LIBRARY (WordPress-Style Media Management)
  // ==========================================
  app.get('/api/admin/media', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), async (req, res) => {
    try {
      const mediaList: MediaItem[] = db.get('media') || [];
      const registrations: Registration[] = db.get('registrations') || [];

      // Auto-index: Ensure any registration with a photo is represented in the Media Library
      let addedAny = false;
      for (const reg of registrations) {
        if (reg.photo_url && (reg.photo_url.startsWith('/uploads/') || reg.photo_url.startsWith('data:image/'))) {
          const existingMedia = mediaList.find(m => m.registration_id === reg.id || m.url === reg.photo_url);
          if (!existingMedia) {
            const filename = path.basename(reg.photo_url.split('?')[0]);
            let sizeStr = '120.0 KB';
            let sizeBytes = 122880;
            try {
              const fullDiskPath = path.join(process.cwd(), 'public', reg.photo_url.replace(/^\//, ''));
              if (fs.existsSync(fullDiskPath)) {
                sizeBytes = fs.statSync(fullDiskPath).size;
                sizeStr = `${(sizeBytes / 1024).toFixed(1)} KB`;
              }
            } catch {}

            const newMedia: MediaItem = {
              id: `med-reg-${reg.id}`,
              name: `Photo - ${reg.full_name} (${reg.batch_name || reg.passing_year})`,
              filename,
              url: reg.photo_url,
              type: reg.photo_url.endsWith('.png') ? 'image/png' : reg.photo_url.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
              size: sizeStr,
              size_bytes: sizeBytes,
              registration_id: reg.id,
              user_id: reg.user_id,
              source: 'registration',
              attendee_name: reg.full_name,
              passing_year: reg.passing_year,
              token_code: reg.token_code,
              created_at: reg.created_at || new Date().toISOString(),
            };
            mediaList.unshift(newMedia);
            portableDb.saveMediaItem(newMedia).catch(() => {});
            addedAny = true;
          }
        }
      }

      if (addedAny) {
        db.set('media', mediaList);
      }

      // Sort by created_at descending
      const sorted = [...mediaList].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      res.json(sorted);
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Failed to retrieve media library: ' + err.message });
    }
  });

  // Admin Media Upload (Manual Add)
  app.post('/api/admin/media', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), async (req: AuthRequest, res) => {
    try {
      const media = db.get('media') || [];
      const { name, data, image, url, folder = 'media', source = 'admin_upload' } = req.body;
      const rawPayload = data || image || url;

      if (!rawPayload) {
        return res.status(400).json({ message: 'No media content or image data provided.' });
      }

      let finalUrl = url;
      let finalFilename = 'media-file.jpg';
      let finalSize = '1.0 MB';
      let sizeBytes = 1048576;
      let mimeType = 'image/jpeg';

      if (rawPayload.startsWith('data:image/')) {
        const saved = await FileStorageService.saveBase64Image(rawPayload, folder);
        if (!saved) {
          return res.status(400).json({ message: 'Invalid image format or data.' });
        }
        finalUrl = saved.url;
        finalFilename = saved.filename;
        finalSize = `${(saved.sizeBytes / 1024).toFixed(1)} KB`;
        sizeBytes = saved.sizeBytes;
        mimeType = saved.mimeType;
      }

      const newItem: MediaItem = {
        id: `med-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        name: name || finalFilename,
        filename: finalFilename,
        url: finalUrl,
        type: mimeType,
        size: finalSize,
        size_bytes: sizeBytes,
        source,
        created_at: new Date().toISOString(),
      };

      media.unshift(newItem);
      db.set('media', media);
      portableDb.saveMediaItem(newItem).catch(() => {});

      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'UPLOAD_MEDIA',
        'Media',
        `Uploaded media item "${newItem.name}" (${newItem.url})`
      );

      res.status(201).json(newItem);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to save media item' });
    }
  });

  // Replace / Update Media Item
  app.put('/api/admin/media/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), async (req: AuthRequest, res) => {
    try {
      const media = db.get('media') || [];
      const index = media.findIndex(m => m.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ message: 'Media item not found.' });
      }

      const existing = media[index];
      const { name, data, image } = req.body;
      const rawPayload = data || image;

      let updated = { ...existing };
      if (name) updated.name = name;

      // Handle file replacement
      if (rawPayload && typeof rawPayload === 'string' && rawPayload.startsWith('data:image/')) {
        const folder = existing.source === 'registration' ? 'photos' : 'media';
        const saved = await FileStorageService.saveBase64Image(rawPayload, folder);
        if (saved) {
          // Safely delete previous file from disk if it was stored locally
          if (existing.url && existing.url.startsWith('/uploads/')) {
            await FileStorageService.deleteFile(existing.url);
          }

          updated.url = saved.url;
          updated.filename = saved.filename;
          updated.size = `${(saved.sizeBytes / 1024).toFixed(1)} KB`;
          updated.size_bytes = saved.sizeBytes;
          updated.type = saved.mimeType;
          updated.updated_at = new Date().toISOString();

          // If linked to a registration, update the registration record as well!
          if (existing.registration_id) {
            const registrations = db.get('registrations') || [];
            const rIdx = registrations.findIndex(r => r.id === existing.registration_id);
            if (rIdx !== -1) {
              registrations[rIdx].photo_url = saved.url;
              db.set('registrations', registrations);
            }
          }
        }
      }

      media[index] = updated;
      db.set('media', media);
      portableDb.saveMediaItem(updated).catch(() => {});

      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'UPDATE_MEDIA',
        'Media',
        `Updated media item "${updated.name}" (${updated.id})`
      );

      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to update media item.' });
    }
  });

  // Delete Media Item
  app.delete('/api/admin/media/:id', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), async (req: AuthRequest, res) => {
    try {
      const media = db.get('media') || [];
      const item = media.find(m => m.id === req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Media item not found.' });
      }

      // Safely delete file from disk storage
      if (item.url && item.url.startsWith('/uploads/')) {
        await FileStorageService.deleteFile(item.url);
      }

      // If linked to a registration, clear the photo reference cleanly so no broken links remain
      if (item.registration_id) {
        const registrations = db.get('registrations') || [];
        const rIdx = registrations.findIndex(r => r.id === item.registration_id);
        if (rIdx !== -1) {
          registrations[rIdx].photo_url = undefined;
          db.set('registrations', registrations);
        }
      }

      // Remove from database and memory
      const updatedMedia = media.filter(m => m.id !== req.params.id);
      db.set('media', updatedMedia);
      await portableDb.deleteMediaItem(req.params.id);

      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'DELETE_MEDIA',
        'Media',
        `Deleted media item "${item.name}" (${item.url})`
      );

      res.json({ success: true, message: 'Media item deleted successfully from storage and database.' });
    } catch (err: any) {
      res.status(500).json({ message: 'Failed to delete media item: ' + err.message });
    }
  });

  // Download Media Item
  app.get('/api/admin/media/:id/download', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req, res) => {
    try {
      const media: MediaItem[] = db.get('media') || [];
      const item = media.find(m => m.id === req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Media item not found.' });
      }

      if (!item.url || !item.url.startsWith('/uploads/')) {
        return res.status(400).json({ message: 'This media item cannot be downloaded directly.' });
      }

      const relative = item.url.replace(/^\/uploads\//, '').split('?')[0];
      const diskPath = path.join(process.cwd(), 'public', 'uploads', relative);

      if (!fs.existsSync(diskPath)) {
        return res.status(404).json({ message: 'Media file does not exist on server storage.' });
      }

      const filename = item.filename || path.basename(diskPath);
      res.setHeader('Content-Type', item.type || 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const fileStream = fs.createReadStream(diskPath);
      fileStream.pipe(res);
    } catch (err: any) {
      res.status(500).json({ message: 'Download error: ' + err.message });
    }
  });

  // Audit Logs
  app.get('/api/admin/audit-logs', authenticate, requireRole(['super_admin', 'admin']), (req, res) => {
    res.json(db.get('audit_logs') || []);
  });

  // ==========================================
  // DATABASE ARCHITECTURE, DIAGNOSTICS & EXPORT
  // ==========================================
  app.get('/api/admin/database/status', authenticate, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
      const diagnostic = portableDb.getDiagnosticInfo();
      const status = portableDb.getStatus();
      const stats = db.getTableStats();
      
      res.json({
        success: true,
        active_driver: status.driver,
        configured_driver: status.configuredDriver,
        is_connected: status.isConnected,
        is_external: status.driver !== 'local',
        diagnostic,
        status,
        table_counts: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Failed to retrieve database status: ' + err.message });
    }
  });

  app.post('/api/admin/database/test-connection', authenticate, requireRole(['super_admin', 'admin']), async (req: AuthRequest, res) => {
    try {
      const result = await portableDb.testLiveConnection();
      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'DATABASE_DIAGNOSTIC_TEST',
        'Database',
        `Ran live database connection test on driver: ${result.driver} (Success: ${result.success}, Latency: ${result.latency_ms}ms)`
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/database/reconnect', authenticate, requireRole(['super_admin', 'admin']), async (req: AuthRequest, res) => {
    try {
      await portableDb.reconnect();
      const diagnostic = portableDb.getDiagnosticInfo();
      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'DATABASE_RECONNECT',
        'Database',
        `Reconnected database pool to driver: ${diagnostic.driver}`
      );
      res.json({ success: true, message: 'Database pool re-initialized', diagnostic });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Reconnect failed: ' + err.message });
    }
  });

  app.post('/api/admin/database/diagnose-tables', authenticate, requireRole(['super_admin', 'admin']), async (req: AuthRequest, res) => {
    const autoMigrate = req.body?.migrate === true;
    const testResults: Array<{ step: string; status: 'PASS' | 'WARN' | 'FAIL'; duration_ms: number; message: string }> = [];

    try {
      const activeDriver = portableDb.getStatus().driver;

      // Test 1: Handshake
      const startHs = Date.now();
      const liveCheck = await portableDb.testLiveConnection();
      testResults.push({
        step: 'Backend Database Handshake',
        status: liveCheck.success ? 'PASS' : 'FAIL',
        duration_ms: Date.now() - startHs,
        message: liveCheck.success ? `Connected to ${liveCheck.driver} (${liveCheck.server_version}) in ${liveCheck.latency_ms}ms` : (liveCheck.error || 'Connection failed'),
      });

      if (activeDriver === 'supabase') {
        // Test 2: Registrations Schema & Compatibility
        const startRegSchema = Date.now();
        const regTables = await portableDb.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name IN ('registrations', 'event_registrations')
        `);
        const regTableNames = regTables.map((r: any) => r.table_name);
        const hasEventReg = regTableNames.includes('event_registrations');
        const hasReg = regTableNames.includes('registrations');

        if (hasEventReg && !hasReg && autoMigrate) {
          await portableDb.query('CREATE OR REPLACE VIEW registrations AS SELECT * FROM event_registrations');
          testResults.push({
            step: "Table Mapping: 'registrations' <-> 'event_registrations'",
            status: 'PASS',
            duration_ms: Date.now() - startRegSchema,
            message: "Auto-migrated: Created view 'registrations' -> 'event_registrations' for Eloquent compatibility.",
          });
        } else if (hasEventReg && !hasReg) {
          testResults.push({
            step: "Table Mapping: 'registrations' <-> 'event_registrations'",
            status: 'WARN',
            duration_ms: Date.now() - startRegSchema,
            message: "Found 'event_registrations' table, but 'registrations' alias view is missing. Pass { migrate: true } to create view.",
          });
        } else {
          testResults.push({
            step: "Table Mapping: 'registrations'",
            status: 'PASS',
            duration_ms: Date.now() - startRegSchema,
            message: `Active registration table/view confirmed (${regTableNames.join(', ')})`,
          });
        }

        // Test 3: CMS Pages Schema & Compatibility
        const startCmsSchema = Date.now();
        const cmsTables = await portableDb.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name IN ('pages', 'cms_pages')
        `);
        const cmsTableNames = cmsTables.map((r: any) => r.table_name);
        const hasPages = cmsTableNames.includes('pages');
        const hasCmsPages = cmsTableNames.includes('cms_pages');

        if (autoMigrate) {
          if (hasPages) {
            await portableDb.query(`
              ALTER TABLE pages ADD COLUMN IF NOT EXISTS content_en TEXT;
              ALTER TABLE pages ADD COLUMN IF NOT EXISTS content_bn TEXT;
              ALTER TABLE pages ADD COLUMN IF NOT EXISTS featured_image TEXT;
              ALTER TABLE pages ADD COLUMN IF NOT EXISTS seo_meta JSONB;
            `);
          }
          await portableDb.query('CREATE OR REPLACE VIEW cms_pages AS SELECT * FROM pages');
          testResults.push({
            step: "Table Mapping: 'pages' / 'cms_pages'",
            status: 'PASS',
            duration_ms: Date.now() - startCmsSchema,
            message: "Auto-migrated: Verified 'pages' columns and 'cms_pages' Eloquent compatibility view.",
          });
        } else if (hasPages && !hasCmsPages) {
          testResults.push({
            step: "Table Mapping: 'cms_pages' Eloquent Alias View",
            status: 'WARN',
            duration_ms: Date.now() - startCmsSchema,
            message: "Found 'pages' table, but 'cms_pages' alias view is missing. Pass { migrate: true } to create view.",
          });
        } else {
          testResults.push({
            step: "Table Mapping: 'pages' / 'cms_pages'",
            status: 'PASS',
            duration_ms: Date.now() - startCmsSchema,
            message: `Active CMS pages tables/views confirmed (${cmsTableNames.join(', ')})`,
          });
        }

        // Test 4: Registrations Read / Write / Update / Delete
        const startRwReg = Date.now();
        const testId = `DIAG-API-${Date.now()}`;
        const testPhone = `01788${Math.floor(100000 + Math.random() * 900000)}`;
        await portableDb.query(`
          INSERT INTO event_registrations (
            id, event_id, full_name, dob, gender, phone, email, fee_amount, payment_status, registration_status, token_code, created_at, updated_at
          ) VALUES (
            $1, 'event-85th-anniversary', 'Admin Diagnostic Alumni', '1990-01-01', 'male', $2, 'admin.diag@nashalumni.org', 1000, 'pending', 'pending', 'DIAG-CODE', NOW(), NOW()
          )
        `, [testId, testPhone]);

        const selReg = await portableDb.query('SELECT id, full_name, payment_status FROM event_registrations WHERE id = $1', [testId]);
        const readOk = selReg.length === 1 && selReg[0].full_name === 'Admin Diagnostic Alumni';

        await portableDb.query("UPDATE event_registrations SET payment_status = 'paid' WHERE id = $1", [testId]);
        const updReg = await portableDb.query('SELECT payment_status FROM event_registrations WHERE id = $1', [testId]);
        const updateOk = updReg.length === 1 && updReg[0].payment_status === 'paid';

        await portableDb.query('DELETE FROM event_registrations WHERE id = $1', [testId]);

        testResults.push({
          step: "Registrations Live Read / Write Cycle",
          status: readOk && updateOk ? 'PASS' : 'FAIL',
          duration_ms: Date.now() - startRwReg,
          message: readOk && updateOk ? 'Successfully performed INSERT -> SELECT -> UPDATE -> DELETE on event_registrations' : 'Registration read/write verification failed',
        });

        // Test 5: CMS Pages Read / Write / Update / Delete
        const startRwCms = Date.now();
        const testPageId = `diag-page-api-${Date.now()}`;
        const testSlug = `diag-slug-api-${Date.now()}`;
        await portableDb.query(`
          INSERT INTO pages (
            id, slug, title_en, title_bn, sections, status, created_at, updated_at
          ) VALUES (
            $1, $2, 'Diagnostic Admin Page', 'ডায়াগনস্টিক অ্যাডমিন পাতা', '[]'::jsonb, 'published', NOW(), NOW()
          )
        `, [testPageId, testSlug]);

        const selPage = await portableDb.query('SELECT id, title_en FROM pages WHERE slug = $1', [testSlug]);
        const pageReadOk = selPage.length === 1 && selPage[0].title_en === 'Diagnostic Admin Page';

        await portableDb.query("UPDATE pages SET status = 'archived' WHERE id = $1", [testPageId]);
        await portableDb.query('DELETE FROM pages WHERE id = $1', [testPageId]);

        testResults.push({
          step: "CMS Pages Live Read / Write Cycle",
          status: pageReadOk ? 'PASS' : 'FAIL',
          duration_ms: Date.now() - startRwCms,
          message: pageReadOk ? 'Successfully performed INSERT -> SELECT -> UPDATE -> DELETE on pages' : 'CMS page read/write verification failed',
        });
      }

      // Test 6: Controller Mapping Pipeline
      const startCtrl = Date.now();
      const ctrlTestId = `CTRL-CHK-${Date.now()}`;
      const regs = db.get('registrations') || [];
      db.set('registrations', [{ id: ctrlTestId, full_name: 'Controller Check' } as any, ...regs]);
      const verifyReg = (db.get('registrations') || []).find((r: any) => r.id === ctrlTestId);
      db.set('registrations', (db.get('registrations') || []).filter((r: any) => r.id !== ctrlTestId));

      testResults.push({
        step: "Application Controller Pipeline",
        status: verifyReg ? 'PASS' : 'FAIL',
        duration_ms: Date.now() - startCtrl,
        message: verifyReg ? 'Controller storage and hydration state verified' : 'Controller state failed',
      });

      db.logAudit(
        req.user?.name || 'Admin',
        req.user?.email || '',
        'DATABASE_TABLE_DIAGNOSTICS',
        'Database',
        `Executed live read/write diagnostics for registrations & cms_pages (All Passed: ${testResults.every(r => r.status === 'PASS')})`
      );

      res.json({
        success: true,
        summary: {
          total: testResults.length,
          passed: testResults.filter(r => r.status === 'PASS').length,
          warnings: testResults.filter(r => r.status === 'WARN').length,
          failed: testResults.filter(r => r.status === 'FAIL').length,
        },
        results: testResults,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Diagnostic execution failed: ' + err.message });
    }
  });

  app.get('/api/admin/database/export', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const format = ((req.query.format as string) || 'sql').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];

    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'DATABASE_EXPORT',
      'Database',
      `Exported full system database backup in format: ${format.toUpperCase()}`
    );

    if (format === 'json') {
      const jsonData = db.exportAsJSON();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="nash_alumni_db_backup_${dateStr}.json"`);
      return res.send(jsonData);
    }

    if (format === 'csv') {
      const csvData = db.exportRegistrationsCSV();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="nash_alumni_registrations_${dateStr}.csv"`);
      return res.send(csvData);
    }

    if (format === 'mysql' || format === 'cpanel' || format === 'mysql_sql') {
      const sqlData = db.exportAsSQL('mysql');
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="nash_alumni_cpanel_mysql_dump_${dateStr}.sql"`);
      return res.send(sqlData);
    }

    if (format === 'postgres' || format === 'cloud' || format === 'postgres_sql' || format === 'sql') {
      const sqlData = db.exportAsSQL('postgres');
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="nash_alumni_cloudsql_postgres_dump_${dateStr}.sql"`);
      return res.send(sqlData);
    }
  });

  app.post('/api/admin/database/export', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const format = ((req.body?.format as string) || 'sql').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];

    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'DATABASE_EXPORT',
      'Database',
      `Exported full system database backup via API in format: ${format.toUpperCase()}`
    );

    if (format === 'json') {
      const jsonData = db.exportAsJSON();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="nash_alumni_db_backup_${dateStr}.json"`);
      return res.send(jsonData);
    }

    if (format === 'csv') {
      const csvData = db.exportRegistrationsCSV();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="nash_alumni_registrations_${dateStr}.csv"`);
      return res.send(csvData);
    }

    if (format === 'mysql' || format === 'cpanel' || format === 'mysql_sql') {
      const sqlData = db.exportAsSQL('mysql');
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="nash_alumni_cpanel_mysql_dump_${dateStr}.sql"`);
      return res.send(sqlData);
    }

    const sqlData = db.exportAsSQL('postgres');
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nash_alumni_cloudsql_postgres_dump_${dateStr}.sql"`);
    return res.send(sqlData);
  });

  // Download complete turnkey cPanel deployment package
  app.get('/api/admin/database/download-cpanel-package', (req, res) => {
    const zipPath = path.join(process.cwd(), 'nash_alumni_cpanel_production.zip');
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ success: false, message: 'cPanel deployment package not found on server.' });
    }
    const stat = fs.statSync(zipPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'attachment; filename="nash_alumni_cpanel_production.zip"');
    const fileStream = fs.createReadStream(zipPath);
    fileStream.pipe(res);
  });

  // ==========================================
  // API 404 & ERROR HANDLER (Ensures /api requests ALWAYS return JSON, never HTML)
  // ==========================================
  app.all(['/api', '/api/*'], (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(404).json({
      error: 'Not Found',
      message: `API route ${req.method} ${req.path} not found`,
      path: req.path,
    });
  });

  // Global API error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[Server Error] ${req.method} ${req.path}:`, err);
    if (req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(err.status || err.statusCode || 500).json({
        error: err.name || 'Internal Server Error',
        message: err.message || 'An unexpected error occurred',
      });
    }
    next(err);
  });

  // ==========================================
  // STATIC ASSETS & VITE MIDDLEWARE & SPA FALLBACK
  // ==========================================
  const publicPath = path.join(process.cwd(), 'public');
  app.use(express.static(publicPath));

  const hasDist = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr: any) {
      console.warn('[Vite Middleware] Could not load vite dynamic import, falling back to static/dist:', viteErr.message);
      if (hasDist) {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.error('[Production Server] dist directory not found! Run npm run build before starting in production.');
    }
  }

  if (process.env.VERCEL !== '1') {
    const listenPort = process.env.PORT || PORT;
    // Support Passenger unix socket or named pipe
    if (typeof listenPort === 'string' && (listenPort.startsWith('/') || listenPort.startsWith('\\\\.\\pipe\\') || listenPort.includes('passenger'))) {
      app.listen(listenPort, () => {
        console.log(`Server running on Passenger socket: ${listenPort}`);
      });
    } else {
      app.listen(listenPort, () => {
        console.log(`Server running on port ${listenPort}`);
      });
    }
  }

  return app;
}

let appPromise: Promise<express.Express> | null = null;
export function getApp() {
  if (!appPromise) {
    appPromise = startServer();
  }
  return appPromise;
}

if (process.env.VERCEL !== '1') {
  startServer();
}

export default getApp;
