# cPanel Production Deployment & Server Architecture Guide
**Nanupur Abu Sobhan High School Alumni Association & 85th Reunion Platform**

This guide provides complete, step-by-step instructions for deploying and running this production full-stack platform on standard **cPanel Shared/VPS Hosting** with **Apache, PHP, MySQL/MariaDB**, or **cPanel Node.js Application Manager (Phusion Passenger)**.

---

## 1. Hosting Environment Prerequisites

Before starting deployment, confirm the following with your hosting provider:

### Mandatory Requirements:
- **Web Server**: Apache 2.4+ with `mod_rewrite`, `mod_headers`, and `mod_ssl` enabled
- **Database**: MySQL 8.0+ or MariaDB 10.3+ with `utf8mb4` charset support
- **PHP Version**: PHP 8.1, 8.2, or 8.3
  - Core Extensions: `pdo_mysql`, `mbstring`, `openssl`, `json`, `curl`, `fileinfo`, `gd`
- **Memory & Limits**: Minimum 256MB PHP `memory_limit`, `upload_max_filesize = 12M`, `post_max_size = 15M`
- **SSL Certificate**: AutoSSL / Let's Encrypt enabled for secure HTTPS

### Deployment Options:
- **Architecture Option 1 (Recommended - Turnkey Node.js App)**: cPanel "Setup Node.js App" / CloudLinux Passenger with Node.js 18.x or 20.x. Uses `app.js` / `server.js` to execute the production full-stack server.
- **Architecture Option 2 (Standard Apache + PHP / MySQL)**: Standard shared hosting without Node.js. Uses `index.php` as the frontend router and Laravel API endpoint processor, connecting directly to cPanel MySQL.

---

## 2. Prepare the Domain & Document Root

1. Log into your cPanel account.
2. In the **Domains** section, ensure your primary domain (`yourdomain.com`) or subdomain (`alumni.yourdomain.com`) is pointed correctly.
3. Determine your document root:
   - For primary domain: `/home/username/public_html`
   - For subdomain / addon domain: `/home/username/alumni.yourdomain.com`
4. In the **Security** section, open **SSL/TLS Status** and ensure an active SSL certificate is installed. Run **AutoSSL** if needed.

---

## 3. Create the Database in cPanel

1. In cPanel, open **MySQL® Databases** (or **MySQL Database Wizard**).
2. **Create New Database**:
   - Example name: `cpaneluser_nashalumni`
3. **Create Database User**:
   - Example username: `cpaneluser_dbuser`
   - Set a strong password (at least 16 characters).
   - *Tip:* If the password contains special characters like `#`, `$`, or `@`, always wrap it in double quotes in your `.env` file.
4. **Assign User to Database**:
   - Select your user and database, then click **Add**.
   - Check **ALL PRIVILEGES** and click **Make Changes**.
5. **Import Schema via phpMyAdmin**:
   - Return to the cPanel home screen and click **phpMyAdmin**.
   - Select your newly created database (`cpaneluser_nashalumni`) from the left sidebar.
   - Click the **Operations** tab. Ensure **Collation** is set to `utf8mb4_unicode_ci` (required for accurate Bengali Unicode text) and click **Go**.
   - Click the **Import** tab at the top.
   - Click **Browse...**, select `database_setup.sql` from your computer, and click **Import** (or **Go**).
   - This creates all 18 tables, milestone batches, default settings, and seeds the initial administrator account.

---

## 4. Upload the Application Package

1. Download the pre-built deployment archive:
   - **File:** `nash_alumni_cpanel_production.zip`
2. In cPanel, open **File Manager**.
3. Navigate to your target deployment directory:
   - If using **Option 1 (Node.js App)**: Upload to an application folder outside the public root, e.g. `/home/username/nash_alumni`
   - If using **Option 2 (Apache / PHP)**: Upload directly into `public_html/` (or your subdomain root).
4. Right-click `nash_alumni_cpanel_production.zip` and select **Extract**.
5. Verify the extracted files:
   - `index.php` (PHP router and Laravel controller gateway)
   - `index.html` (Application HTML entry point)
   - `app.js` and `server.js` (cPanel Node.js startup files)
   - `.htaccess` (Apache routing, HTTPS enforcement, and security guards)
   - `dist/` (Compiled production frontend assets and `server.cjs`)
   - `app/` (Laravel Controllers, including `DatabaseDiagnosticController.php`)
   - `routes/` (Laravel route definitions)
   - `database/` (SQL migrations)
   - `storage/` (Logs and internal secure storage)
   - `public/` (Uploads, logos, and favicon)
   - `.env.example` (Configuration template)

---

## 5. Configure the Environment (`.env`)

1. In cPanel File Manager, make sure **Show Hidden Files (dotfiles)** is enabled in **Settings** (top-right).
2. Locate `.env.example`, right-click it, and select **Copy** to create `.env`.
3. Right-click `.env` and select **Edit**.
4. Configure your production parameters:

```env
# Application General Configuration
APP_NAME="Nanupur Abu Sobhan High School Alumni Association"
APP_ENV=production
APP_KEY=base64:7K5pLmNpR9vW2x8Q4z1sA6dF3gH8jK0lZ5xV3bN2m1Q=
APP_DEBUG=false
APP_URL=https://yourdomain.com

# Database Configuration (cPanel Hosted MySQL / MariaDB)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=cpaneluser_nashalumni
DB_USERNAME=cpaneluser_dbuser
DB_PASSWORD="your_actual_cpanel_mysql_password"
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci

# Authentication Secret (Used for JWT sessions and token signing)
JWT_SECRET=generate-a-random-64-character-secret-string-here

# cPanel Webmail / SMTP Configuration
MAIL_MAILER=smtp
MAIL_HOST=mail.yourdomain.com
MAIL_PORT=465
MAIL_USERNAME=noreply@yourdomain.com
MAIL_PASSWORD="your_cpanel_email_password"
MAIL_ENCRYPTION=ssl
MAIL_FROM_ADDRESS=noreply@yourdomain.com
MAIL_FROM_NAME="NASH 85th Anniversary Secretariat"
MAIL_REPLY_TO=info@yourdomain.com

# File Storage Configuration
FILESYSTEM_DISK=public
UPLOAD_MAX_FILESIZE=10M
POST_MAX_SIZE=12M

# Cache & Session
SESSION_DRIVER=file
QUEUE_CONNECTION=sync
```

5. Click **Save Changes** and close the editor.

---

## 6. Startup & Execution

### For Architecture Option 1: cPanel Node.js Application Manager
1. In cPanel, click **Setup Node.js App** (or **CloudLinux NodeJS Selector**).
2. Click **Create Application**:
   - **Node.js version**: `20.x` (or `18.x`)
   - **Application mode**: `Production`
   - **Application root**: `/home/username/nash_alumni`
   - **Application URL**: Select your domain (`yourdomain.com`)
   - **Application startup file**: `app.js` *(Do NOT enter server.ts)*
3. Click **Create**.
4. On the application details page, click **Run NPM Install** (or access terminal and run `npm install --production`).
5. Click **Restart Application**.

### For Architecture Option 2: Standard Apache / PHP Shared Hosting
1. No Node.js process is required.
2. The provided `index.php` and `.htaccess` automatically route all incoming requests.
3. Static frontend assets are delivered with 30-day immutable caching headers, and API requests to `/api/*` are handled directly by the backend controllers.

---

## 7. File Permissions & Security Hardening

In cPanel File Manager or Terminal, verify standard secure permissions:

| File / Directory | Recommended Permission | Purpose |
| :--- | :--- | :--- |
| `.env` | `0600` or `0640` | Strictly readable only by your user/server; never public |
| `storage/` | `0750` | Contains logs; protected by internal `storage/.htaccess` |
| `public/uploads/` | `0755` | Writable directory for user registration photos and logos |
| `dist/` | `0755` | Readable production web assets |
| `index.php` / `app.js` | `0644` | Execution entry point |

*Security Note:* The included `.htaccess` automatically denies access to `.env*`, `storage/`, `data/`, `database/`, and package manifests.

---

## 8. Verification & Sanity Checklist

After deployment, test the following endpoints in your browser:

1. **System Health Check**:
   - Visit: `https://yourdomain.com/api/health`
   - Expected Output: `{"status":"ok","service":"Nanupur Abu Sobhan High School Alumni Platform",...}`
2. **Database Connection & Origin Diagnostic**:
   - Visit: `https://yourdomain.com/api/system/db-diagnostic`
   - Expected Output: Status `OPERATIONAL`, `connected: true`, active driver `mysql`, and password masked.
3. **Public Homepage**:
   - Visit: `https://yourdomain.com/`
   - Verify that the hero banner, 85th celebration countdown, and navigation links load smoothly.
4. **Alumni Registration Flow**:
   - Navigate to `/register`.
   - Submit a test registration with passing year, phone number, and photo upload.
   - Confirm that the registration is saved and redirects to the Confirmation Slip page with the working **"Return to Website"** button.
5. **Admin Portal**:
   - Click **Admin Portal** or visit `/admin`.
   - Log in using default credentials:
     - **Username:** `super_admin`
     - **Password:** `admin123`
   - **Critical:** Immediately navigate to **Admin -> Users & Roles** and update the Super Admin password!

---

## 9. Comprehensive Troubleshooting Guide

### Issue A: "Access denied for user 'root'@'localhost' (using password: NO)"
- **Root Cause**: Application cannot find `DB_USERNAME` or `DB_PASSWORD` in `.env`, or a stale configuration cache is active.
- **Fix**:
  1. Open `.env` in cPanel File Manager and ensure `DB_USERNAME` and `DB_PASSWORD` are set with your exact cPanel database credentials.
  2. If using Laravel CLI, run `php artisan config:clear`.
  3. Run `/api/system/db-diagnostic` to inspect the exact origin of each variable and view the recommendations.

### Issue B: 404 Error on Direct URL Access or Page Refresh (e.g. `/register` or `/admin`)
- **Root Cause**: Apache `mod_rewrite` is disabled or `.htaccess` is missing.
- **Fix**: Ensure the `.htaccess` file is present in your document root. The rewrite rule `RewriteRule ^ index.php [QSA,L]` routes all non-file requests to the router.

### Issue C: HTTP 500 Internal Server Error
- **Root Cause**: Syntax error in `.env`, missing PHP extension, or permission issue.
- **Fix**:
  1. Inspect `storage/logs/database-connection-diagnostic.log` or cPanel **Errors** log.
  2. Verify that PHP 8.1+ with `pdo_mysql` is enabled under cPanel **Select PHP Version**.

### Issue D: Photo Upload Fails with "File size exceeds limit"
- **Root Cause**: Uploaded image exceeds PHP `upload_max_filesize` or CMS limit.
- **Fix**:
  1. In cPanel **MultiPHP INI Editor**, set `upload_max_filesize = 12M` and `post_max_size = 15M`.
  2. In the Admin Portal (**Registration Form Builder**), check the database-driven photo limit (default: 1.5MB).

---

## 10. Maintenance & Backup Procedures

1. **Database Backups**:
   - Access **Admin Portal -> Database Architecture & Diagnostics**.
   - Click **Export cPanel MySQL** to download a full `.sql` dump.
   - Alternatively, open cPanel **phpMyAdmin**, click **Export**, and download the `.sql` backup.
2. **cPanel Ready Archive Updates**:
   - Download `nash_alumni_cpanel_production.zip` anytime from the Admin Portal under **Database Backups -> Download Ready cPanel ZIP**.
3. **Updating Code on cPanel**:
   - Extract the new zip file over the existing installation. Your database records in MySQL and uploaded photos in `public/uploads/` remain completely safe and untouched.
