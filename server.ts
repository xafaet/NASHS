import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db, portableDb } from './server/db';
import { initialProgramSchedule, initialRegistrationFields } from './server/seedData';
import { AuthService, authenticate, requireRole, requirePermission, AuthRequest } from './server/auth';
import { BatchService } from './server/services/batchService';
import { PaymentService, PaymentManager } from './server/services/paymentService';
import { TokenService } from './server/services/tokenService';
import { InstallerService } from './server/installer';
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
  BatchConfig,
  CustomRole,
  NewsPost,
  GateItem,
} from './src/types';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { generateEntryPassPDF } from './server/services/pdfService';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
  // INSTALLATION & DATABASE SETUP WIZARD
  // ==========================================
  app.get('/api/setup/status', (req, res) => {
    res.json(InstallerService.getStatus());
  });

  app.post('/api/setup/test-connection', async (req, res) => {
    try {
      const result = await InstallerService.testConnection(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Database connection test failed' });
    }
  });

  app.post('/api/setup/install', async (req, res) => {
    try {
      const result = await InstallerService.install(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Installation failed' });
    }
  });

  // Installation Gate Middleware:
  // If application is not installed, block non-setup API calls so wizard cannot be bypassed
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') && !req.path.startsWith('/api/setup') && req.path !== '/api/health') {
      const status = InstallerService.getStatus();
      if (!status.is_installed) {
        return res.status(503).json({
          error: 'APP_NOT_INSTALLED',
          message: 'The application is not yet installed. Please complete the setup wizard.',
          setup_url: '/setup',
        });
      }
    }
    next();
  });

  // ==========================================
  // AUTHENTICATION & IDENTITY
  // ==========================================
  app.post('/api/auth/login', (req, res) => {
    const { emailOrPhone, username, password } = req.body;
    const users = db.get('users');

    const identifier = (username || emailOrPhone || '').toLowerCase().trim();

    const user = users.find(u =>
      (u.username && u.username.toLowerCase() === identifier) ||
      (u.email && u.email.toLowerCase() === identifier) ||
      (u.phone && u.phone === identifier)
    );

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials. User not found.' });
    }

    if (user.status === 'suspended' || user.status === 'blocked' || user.status === 'inactive') {
      return res.status(403).json({ message: `Account is ${user.status}. Please contact the alumni association secretariat.` });
    }

    const token = AuthService.generateToken(user);
    res.json({
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
  });

  app.post('/api/auth/quick-login', (req, res) => {
    const { role } = req.body;
    const users = db.get('users');
    let target = users.find(u => u.role === role);

    if (!target) {
      target = users[0];
    }

    const token = AuthService.generateToken(target);
    const { password_hash, ...safeUser } = target;
    res.json({
      token,
      user: safeUser,
    });
  });

  app.post('/api/auth/change-password', authenticate, (req: AuthRequest, res) => {
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

    user.password_hash = bcrypt.hashSync(new_password, 10);
    db.set('users', users);
    db.logAudit(user.name, user.email, 'CHANGE_PASSWORD', 'Auth', 'User changed their own account password');
    res.json({ success: true, message: 'Password updated successfully.' });
  });

  app.get('/api/auth/me', authenticate, (req: AuthRequest, res) => {
    res.json({ user: req.user });
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
  app.get('/api/payment-gateways', (req, res) => {
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
    res.json(db.get('registration_config'));
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
    const fields = db.get('registration_form_fields') || regConfig?.fields || initialRegistrationFields;
    // Return active fields sorted by order
    const active = fields
      .filter((f: any) => f.is_enabled !== false)
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    res.json(active);
  });

  app.get('/api/admin/registration/fields', authenticate, requireRole(['super_admin', 'admin', 'event_manager']), (req, res) => {
    const regConfig = db.get('registration_config');
    const fields = db.get('registration_form_fields') || regConfig?.fields || initialRegistrationFields;
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

  app.get('/api/batches/config', (req, res) => {
    res.json(db.get('batch_config'));
  });

  app.put('/api/admin/batches/config', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
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

  app.post('/api/admin/batches/overrides', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
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

  app.delete('/api/admin/batches/overrides/:year', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
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

    // Uniqueness check
    if (users.some(u => u.username?.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ message: 'Username is already taken.' });
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

    // Check username uniqueness if changing
    if (username && username.toLowerCase() !== existing.username?.toLowerCase()) {
      if (users.some(u => u.id !== existing.id && u.username?.toLowerCase() === username.toLowerCase())) {
        return res.status(409).json({ message: 'Username is already in use by another account.' });
      }
      existing.username = username.toLowerCase().trim();
    }

    const updatedUser = { ...existing, ...otherUpdates };
    users[index] = updatedUser;
    db.set('users', users);

    // If passing year changed, auto update batch on linked registrations
    if (otherUpdates.passing_year && otherUpdates.passing_year !== existing.passing_year) {
      const year = parseInt(otherUpdates.passing_year, 10);
      const newBatch = BatchService.getBatchByPassingYear(year);
      const registrations = db.get('registrations') || [];
      registrations.forEach(r => {
        if (r.user_id === updatedUser.id) {
          r.passing_year = year;
          r.batch_name = newBatch.batch_name;
          r.batch_name_bn = newBatch.batch_name_bn;
        }
      });
      db.set('registrations', registrations);
    }

    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_USER', 'Users', `Updated user: ${updatedUser.name} (${updatedUser.username})`);
    const { password_hash, ...safeUser } = updatedUser;
    res.json(safeUser);
  });

  app.post('/api/admin/users/:id/reset-password', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const users = db.get('users') || [];
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate temporary password
    const tempPassword = `NASH@${crypto.randomBytes(3).toString('hex').toUpperCase()}#`;
    user.password_hash = bcrypt.hashSync(tempPassword, 10);
    db.set('users', users);

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

  // Offline Registration Centers
  app.get('/api/offline-centers', (req, res) => {
    const centers = db.get('offline_centers') || [];
    res.json(centers.filter(c => c.is_active).sort((a, b) => a.order_index - b.order_index));
  });

  app.get('/api/admin/offline-centers', authenticate, requireRole(['super_admin', 'admin']), (req, res) => {
    const centers = db.get('offline_centers') || [];
    res.json(centers.sort((a, b) => a.order_index - b.order_index));
  });

  app.post('/api/admin/offline-centers', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const centers = db.get('offline_centers') || [];
    const newCenter: OfflineRegistrationCenter = {
      id: `off-${Date.now()}`,
      name_en: req.body.name_en,
      name_bn: req.body.name_bn,
      address_en: req.body.address_en,
      address_bn: req.body.address_bn,
      phone: req.body.phone,
      contact_person: req.body.contact_person,
      timings: req.body.timings,
      map_url: req.body.map_url,
      order_index: centers.length + 1,
      is_active: req.body.is_active ?? true,
    };
    centers.push(newCenter);
    db.set('offline_centers', centers);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'CREATE_OFFLINE_CENTER', 'Centers', `Added center: ${newCenter.name_en}`);
    res.status(201).json(newCenter);
  });

  app.put('/api/admin/offline-centers/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    const centers = db.get('offline_centers') || [];
    const index = centers.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Center not found' });

    centers[index] = { ...centers[index], ...req.body };
    db.set('offline_centers', centers);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPDATE_OFFLINE_CENTER', 'Centers', `Updated center: ${centers[index].name_en}`);
    res.json(centers[index]);
  });

  app.delete('/api/admin/offline-centers/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    let centers = db.get('offline_centers') || [];
    centers = centers.filter(c => c.id !== req.params.id);
    db.set('offline_centers', centers);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'DELETE_OFFLINE_CENTER', 'Centers', `Deleted center ${req.params.id}`);
    res.json({ success: true });
  });

  app.get('/api/notices', (req, res) => {
    const notices = db.get('notices') || [];
    res.json(notices.filter(n => n.is_active).sort((a, b) => new Date(b.publish_date).getTime() - new Date(a.publish_date).getTime()));
  });

  app.get('/api/news', (req, res) => {
    const news = db.get('news') || [];
    res.json(news.filter(n => n.is_published).sort((a, b) => new Date(b.publish_date).getTime() - new Date(a.publish_date).getTime()));
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
      const { full_name, dob, gender, passing_year, blood_group, phone, email, event_id, address, occupation } = req.body;

      if (!full_name || !dob || !gender || !passing_year || !phone) {
        return res.status(400).json({ message: 'Please fill in all required fields: Full Name, Date of Birth, Gender, Passing Year, and Mobile Number.' });
      }

      const year = parseInt(passing_year, 10);
      if (isNaN(year) || year < 1942 || year > 2035) {
        return res.status(400).json({ message: 'Invalid passing year.' });
      }

      const regConfig = db.get('registration_config');
      if (regConfig && !regConfig.is_enabled) {
        return res.status(400).json({ message: 'Registration for the 85th Anniversary is currently closed.' });
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

      const newRegistration: Registration = {
        id: regId,
        event_id: event_id || regConfig?.event_id || 'event-85th-anniversary',
        full_name: full_name.trim(),
        dob,
        gender,
        blood_group: blood_group ? blood_group.trim() : undefined,
        phone: phone.trim(),
        email: email ? email.trim() : undefined,
        photo_url: req.body.photo_url || undefined,
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
        checked_in: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      registrations.unshift(newRegistration);
      db.set('registrations', registrations);

      // Auto-create user profile if does not exist
      const users = db.get('users');
      let user = users.find(u => (email && u.email === email) || u.phone === phone);
      if (!user) {
        user = {
          id: `user-${Date.now()}`,
          username: `alumni_${phone.slice(-6)}`,
          name: newRegistration.full_name,
          email: email || `${phone}@nanupuralumni.local`,
          phone,
          role: 'alumni_member',
          passing_year: year,
          batch: batchInfo.batch_name,
          gender,
          blood_group,
          status: 'active',
          address: address || undefined,
          occupation: occupation || undefined,
          photo_url: req.body.photo_url || undefined,
          created_at: new Date().toISOString(),
        };
        users.push(user);
        db.set('users', users);
      } else {
        // Update user's details if missing
        let updatedUser = false;
        if (!user.address && address) { user.address = address; updatedUser = true; }
        if (!user.occupation && occupation) { user.occupation = occupation; updatedUser = true; }
        if (!user.photo_url && req.body.photo_url) { user.photo_url = req.body.photo_url; updatedUser = true; }
        if (updatedUser) db.set('users', users);
      }

      newRegistration.user_id = user.id;

      db.logAudit(
        newRegistration.full_name,
        email || phone,
        'REGISTRATION_SUBMITTED',
        'Registration',
        `Initiated registration for ${batchInfo.batch_name} (Fee: ৳${feeAmount})`
      );

      res.status(201).json({
        success: true,
        registration: newRegistration,
        message: 'Registration initiated successfully. Please proceed to payment.',
      });
    } catch (err: any) {
      console.error('Registration creation error:', err);
      res.status(500).json({ message: err.message || 'Internal server error' });
    }
  });

  app.get('/api/registrations/:id', (req, res) => {
    const registrations = db.get('registrations');
    const reg = registrations.find(r => r.id === req.params.id);
    if (!reg) {
      return res.status(404).json({ message: 'Registration not found' });
    }
    res.json(reg);
  });

  // Initiate Payment
  app.post('/api/payments/initiate', async (req, res) => {
    try {
      const result = await PaymentService.initiatePayment(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Verify Payment & Issue Entry Token
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
  app.get('/api/tokens/verify/:code', (req, res) => {
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
    const tokens = db.get('tokens');
    const token = tokens.find(t => t.registration_id === req.params.regId);
    if (!token) {
      return res.status(404).json({ message: 'Token not found for this registration' });
    }
    res.json(token);
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
        occupation,
        phone,
        eventDate: 'Saturday, 16 January 2027 • 08:00 AM onwards',
        venue: 'Nanupur Abu Sobhan High School Premises, Fatikchhari, Chattogram',
        gateName,
        status: token?.status || 'active',
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

  // Send / simulate confirmation email with printable token pass
  app.post('/api/registrations/:id/send-confirmation-email', (req, res) => {
    const registrations = db.get('registrations');
    const reg = registrations.find(r => r.id === req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    db.logAudit(
      'System Mailer',
      reg.email || reg.phone,
      'SEND_CONFIRMATION_EMAIL',
      'Registration',
      `Sent confirmation email with printable pass (Token: ${reg.token_code || 'N/A'}) to ${reg.email || reg.phone}`
    );

    res.json({
      success: true,
      message: `Official confirmation email and PDF Entry Pass successfully dispatched to ${reg.email || reg.phone}.`,
    });
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

  app.put('/api/member/profile', authenticate, (req: AuthRequest, res) => {
    const users = db.get('users') || [];
    const index = users.findIndex(u => u.id === req.user?.id);
    if (index === -1) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    const {
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
    const updated = {
      ...existing,
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
      photo_url: photo_url !== undefined ? photo_url : existing.photo_url,
      privacy: privacy !== undefined ? privacy : existing.privacy,
    };

    users[index] = updated;
    db.set('users', users);

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

    // Batch breakdown
    const batchMap = new Map<string, { count: number; paid: number }>();
    registrations.forEach(r => {
      const bName = r.batch_name || `Batch ${r.passing_year}`;
      const entry = batchMap.get(bName) || { count: 0, paid: 0 };
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
  app.post('/api/admin/registrations', authenticate, requireRole(['super_admin', 'admin', 'event_manager']), (req: AuthRequest, res) => {
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
    const tokenCode = isPaid ? `NASH-85-2027-${Math.random().toString(36).substring(2, 8).toUpperCase()}` : undefined;

    let qrCodeSvg: string | undefined;
    if (tokenCode) {
      qrCodeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#ffffff"/><path d="M10 10h30v30h-30z M20 20h10v10h-10z M60 10h30v30h-30z M70 20h10v10h-10z M10 60h30v30h-30z M20 70h10v10h-10z M55 55h10v10h-10z M75 55h15v10h-15z M55 75h10v15h-10z M75 75h15v15h-15z" fill="#0f4d2a"/></svg>`;
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

    const newReg: Registration = {
      id: regId,
      event_id: 'event-85th-anniversary',
      full_name,
      dob: dob || '1990-01-01',
      gender: gender || 'male',
      blood_group: blood_group || undefined,
      phone,
      email: email || undefined,
      passing_year: yearNum,
      batch_id: batchInfo.batch_id,
      batch_name: batchInfo.batch_name,
      batch_name_bn: batchInfo.batch_name_bn,
      address: address || undefined,
      occupation: occupation || undefined,
      photo_url: photo_url || undefined,
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

    db.logAudit(
      req.user?.name || 'Admin',
      req.user?.email || '',
      'CREATE_REGISTRATION',
      'Registration',
      `Manually registered ${newReg.full_name} (${newReg.id}, Batch: ${newReg.batch_name})`
    );

    res.status(201).json(newReg);
  });

  app.put('/api/admin/registrations/:id', authenticate, requireRole(['super_admin', 'admin', 'event_manager']), (req: AuthRequest, res) => {
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

    const tokens = db.get('tokens') || [];

    // If payment_status is updated to 'paid' and token_code is absent, generate it!
    if (updates.payment_status === 'paid' && !existing.token_code && !updates.token_code) {
      const tokenCode = `NASH-85-2027-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const qrCodeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#ffffff"/><path d="M10 10h30v30h-30z M20 20h10v10h-10z M60 10h30v30h-30z M70 20h10v10h-10z M10 60h30v30h-30z M20 70h10v10h-10z M55 55h10v10h-10z M75 55h15v10h-15z M55 75h10v15h-10z M75 75h15v15h-15z" fill="#0f4d2a"/></svg>`;
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

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    registrations[index] = updated;
    db.set('registrations', registrations);

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
  app.delete('/api/admin/registrations/:id', authenticate, requireRole(['super_admin', 'admin']), (req: AuthRequest, res) => {
    let registrations = db.get('registrations') || [];
    const target = registrations.find(r => r.id === req.params.id);
    if (!target) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    // Remove registration
    registrations = registrations.filter(r => r.id !== req.params.id);
    db.set('registrations', registrations);

    // Remove matching token if exists
    let tokens = db.get('tokens') || [];
    tokens = tokens.filter(t => t.registration_id !== req.params.id && t.token_code !== target.token_code);
    db.set('tokens', tokens);

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
      let user = users.find(u => (email && u.email === email) || u.phone === phone);
      if (!user) {
        user = {
          id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          username: `alumni_${phone.slice(-6)}`,
          name: fullName,
          email: email || `${phone}@nanupuralumni.local`,
          phone,
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

  app.get('/api/admin/tokens', authenticate, requireRole(['super_admin', 'admin', 'event_manager']), (req, res) => {
    res.json(db.get('tokens') || []);
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

  // Media Library
  app.get('/api/admin/media', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req, res) => {
    res.json(db.get('media') || []);
  });

  app.post('/api/admin/media', authenticate, requireRole(['super_admin', 'admin', 'content_manager']), (req: AuthRequest, res) => {
    const media = db.get('media') || [];
    const newItem = {
      id: `med-${Date.now()}`,
      name: req.body.name || 'uploaded-file.jpg',
      url: req.body.url || 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1600&q=80',
      type: req.body.type || 'image',
      size: req.body.size || '1.5 MB',
      created_at: new Date().toISOString(),
    };
    media.unshift(newItem);
    db.set('media', media);
    db.logAudit(req.user?.name || 'Admin', req.user?.email || '', 'UPLOAD_MEDIA', 'Media', `Uploaded media item: ${newItem.name}`);
    res.status(201).json(newItem);
  });

  // Audit Logs
  app.get('/api/admin/audit-logs', authenticate, requireRole(['super_admin', 'admin']), (req, res) => {
    res.json(db.get('audit_logs') || []);
  });

  // ==========================================
  // VITE MIDDLEWARE & SPA FALLBACK
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
