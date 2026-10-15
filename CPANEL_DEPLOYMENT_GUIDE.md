# cPanel Production Deployment & Server Architecture Guide
**Nanupur Abu Sobhan High School Alumni Association & 85th Reunion Platform**

This guide provides end-to-end instructions for deploying and running this production full-stack platform on standard **cPanel Shared/VPS Hosting** with **Apache, PHP, MySQL/MariaDB**, and **SSL/HTTPS**.

---

## 1. Hosting Environment Prerequisites

- **Web Server**: Apache 2.4+ with `mod_rewrite`, `mod_headers`, `mod_ssl`
- **Database**: MySQL 8.0+ or MariaDB 10.3+ with `utf8mb4` charset support
- **PHP Version**: PHP 8.1, 8.2, or 8.3
  - Extensions: `pdo_mysql`, `mbstring`, `openssl`, `json`, `curl`, `fileinfo`, `gd` or `imagick`, `zip`
- **Node.js**: (Optional / Recommended if using cPanel Setup Node.js App / CloudLinux Passenger): Node.js 18.x or 20.x
- **SSL Certificate**: AutoSSL / Let's Encrypt enabled for HTTPS

---

## 2. Directory Structure & Upload to cPanel

On standard cPanel accounts:
- Application source files reside in `/home/{username}/alumni_app/` (or directly inside `public_html/`)
- Public web root points to `public_html/`

### Option A: Standard Full-Stack / Node.js cPanel Application Manager (Recommended)
1. In cPanel, navigate to **Setup Node.js App** (or CloudLinux Node Selector).
2. Click **Create Application**:
   - **Node.js version**: 20.x (or 18.x)
   - **Application mode**: `Production`
   - **Application root**: `/home/{username}/nash_alumni`
   - **Application URL**: `yourdomain.com` (or `alumni.yourdomain.com`)
   - **Application startup file**: `app.js` *(Note: Do NOT set to server.ts. Use app.js or server.js)*
3. Upload and extract `nash_alumni_cpanel_production.zip` into `/home/{username}/nash_alumni`.
4. Copy `.env.example` to `.env` in the application root, and set your database and `JWT_SECRET`.
5. Click **Run NPM Install** (or execute `npm install --production` in terminal).
6. Click **Restart Application**.

### Option B: Apache Static Client + PHP / MySQL API
If deploying via standard PHP/Apache:
- Built static frontend files in `dist/` go into `public_html/`
- `.htaccess` provided in `/public/.htaccess` and `/.htaccess` handles routing, HTTPS redirect, and UTF-8 charset.

---

## 3. Database Setup (cPanel MySQL / MariaDB)

1. Open cPanel and navigate to **MySQL® Databases** (or **MySQL Database Wizard**).
2. **Create New Database**: e.g., `cpaneluser_nashalumni`.
3. **Create Database User**: e.g., `cpaneluser_dbuser` with a secure password.
4. **Add User To Database**: Grant **ALL PRIVILEGES**.
5. Open **phpMyAdmin** from cPanel:
   - Select your database: `cpaneluser_nashalumni`.
   - Go to the **Operations** tab and ensure **Collation** is set to `utf8mb4_unicode_ci` (critical for accurate Bengali typography).
   - Go to the **Import** tab and import `server/db/schema.sql` (or allow the First-Time Web Installation Wizard to automatically create the schema).

---

## 4. Environment Configuration (`.env`)

Copy `.env.example` to `.env` in the application root directory:

```env
APP_NAME="Nanupur Abu Sobhan High School Alumni Association"
APP_ENV=production
APP_KEY=base64:7K5pLmNpR9vW2x8Q4z1sA6dF3gH8jK0lZ5xV3bN2m1Q=
APP_DEBUG=false
APP_URL=https://nanupuralumni.org

# Database Configuration (cPanel MySQL / MariaDB)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=cpaneluser_nashalumni
DB_USERNAME=cpaneluser_dbuser
DB_PASSWORD=your_secure_mysql_password
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci

# JWT Secret for Session & Tokens
JWT_SECRET=super-secure-jwt-secret-key-nash-85

# Mail / SMTP Configuration (cPanel Webmail)
MAIL_MAILER=smtp
MAIL_HOST=mail.nanupuralumni.org
MAIL_PORT=465
MAIL_USERNAME=noreply@nanupuralumni.org
MAIL_PASSWORD=your_cpanel_email_password
MAIL_ENCRYPTION=ssl
MAIL_FROM_ADDRESS=noreply@nanupuralumni.org
MAIL_FROM_NAME="NASH 85th Anniversary Secretariat"
MAIL_REPLY_TO=info@nanupuralumni.org

# Storage & File Upload
FILESYSTEM_DISK=public
UPLOAD_MAX_FILESIZE=10M
POST_MAX_SIZE=12M
SESSION_DRIVER=file
QUEUE_CONNECTION=sync
```

---

## 5. File Upload Permissions & Persistent Storage

Uploaded photos, PDFs, and assets are stored persistently:
- Directory: `/data/uploads/` and `/public/uploads/`
- Set appropriate permissions via cPanel File Manager:
  - Directories: `755` (`drwxr-xr-x`)
  - Files: `644` (`-rw-r--r--`)

---

## 6. Email & SMTP Setup (cPanel Webmail)

1. In cPanel, navigate to **Email Accounts**.
2. Create an account, e.g. `noreply@nanupuralumni.org`.
3. In **Email Settings** (or the web Admin Portal under **Settings > Email Configuration**):
   - **SMTP Host**: `mail.nanupuralumni.org`
   - **Port**: `465` (SSL) or `587` (TLS)
   - **Encryption**: `SSL`
   - **Username**: `noreply@nanupuralumni.org`
   - **Password**: Password set in cPanel
4. Click **Test Email Delivery** in the Admin Portal to verify connectivity.
5. Official registration confirmation PDFs are automatically emailed to attendees once manual payment is confirmed by an admin.

---

## 7. cPanel Scheduled Tasks (Cron Jobs)

To automate payment reconciliation, token expirations, and background queue workers:
1. Navigate to cPanel **Cron Jobs**.
2. Add a new cron job running every minute:
   ```bash
   * * * * * cd /home/{username}/nash_alumni && php artisan schedule:run >> /dev/null 2>&1
   ```
   Or for Node runner:
   ```bash
   * * * * * cd /home/{username}/nash_alumni && /usr/local/bin/node scripts/scheduled-tasks.js >> /dev/null 2>&1
   ```

---

## 8. How to Generate / Set JWT_SECRET on cPanel

A secure 256-bit `JWT_SECRET` signs session tokens for attendees and administrators.

### Method 1: Using cPanel Terminal / SSH (Fastest)
Run either of these commands in your cPanel Terminal:
```bash
openssl rand -hex 32
```
or
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the 64-character output and paste it into your `.env` file:
```env
JWT_SECRET=4f8b9e2a3c7d1e5f8a0b2c4d6e8f1a3b5c7d9e0f2a4b6c8d0e1f3a5b7c9d1e3f
```

### Method 2: Without Terminal (cPanel File Manager)
You can use any secure 32+ character random string or generate one using an online secure generator like [jwtsecret.com](https://jwtsecret.com) or [randomkeygen.com](https://randomkeygen.com) (select "CodeIgniter / 256-bit Key"). Paste it as your `JWT_SECRET` in `.env`.

---

## 9. Troubleshooting Common cPanel Issues

### "An error occurred during installation of modules. The operation was performed, but check availability of application has failed... content type doesn't equal to content type after operation 'text/plain; charset=UTF-8'"
**Root Cause**: When you click **Run NPM Install** in cPanel's *Setup Node.js App*, cPanel executes `npm install` and immediately pings your application. If **Application startup file** was set to `server.ts` or a missing file, Node.js crashes on startup with an unhandled exception (`Unknown file extension .ts`) and outputs a plain text crash trace (`text/plain`), triggering this warning.

**Fix**:
1. In cPanel **Setup Node.js App**, set **Application startup file** to `app.js` (or `server.js`).
2. Ensure you have copied `.env.example` to `.env` in the application directory.
3. Click **Save** in the Node.js App interface, then click **Restart Application**.
4. The error will disappear and the application will start immediately.

---

## 10. Verification & Diagnostics

To verify the database connection and schema on your cPanel server:
```bash
php scripts/laravel_db_diagnostic.php
```
This tests:
- Database connectivity & server version
- Table existence (`site_settings`, `users`, `event_registrations`, `batches`, `events`, `payments`, `tokens`)
- `t_shirt_size` field presence
- Bengali Unicode (UTF-8MB4) read/write integrity
