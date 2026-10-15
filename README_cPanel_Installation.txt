========================================================================
NANUPUR ABU SOBHAN HIGH SCHOOL ALUMNI ASSOCIATION & 85TH REUNION PLATFORM
cPanel Production Installation Guide (Beginner / Quick-Start)
========================================================================

Follow these 6 simple steps to install on your cPanel hosting:

STEP 1: CREATE THE DATABASE IN cPANEL
--------------------------------------
1. Log in to your cPanel dashboard.
2. Click on "MySQL Databases" (or "MySQL Database Wizard").
3. Create a new database, e.g. "nash_alumni".
   (Your full database name will look like: username_nash_alumni)
4. Under "Add New User", create a username, e.g. "nash_user" and enter a strong password.
   (Save this password somewhere safe!)
5. Under "Add User to Database", select your user and database, click "Add",
   and check the box "ALL PRIVILEGES". Click "Make Changes".

STEP 2: IMPORT THE DATABASE TABLES
-----------------------------------
1. Back on the cPanel main page, click "phpMyAdmin".
2. On the left side, click your new database name (e.g. username_nash_alumni).
3. Click the "Import" tab at the top.
4. Click "Choose File" and select "database_setup.sql" from this folder.
5. Scroll down and click "Import" (or "Go"). All tables are now created!

STEP 3: CREATE THE NODE.JS APPLICATION IN cPANEL
-------------------------------------------------
1. Back on the cPanel main page, click "Setup Node.js App".
2. Click "Create Application" (blue button).
3. Set the fields:
   - Node.js version: Choose 20.x (or 18.x)
   - Application mode: Production
   - Application root: The folder name where you uploaded these files (e.g., nash_alumni or public_html)
   - Application URL: Choose your domain or subdomain from the dropdown
   - Application startup file: app.js
     (IMPORTANT: Type exactly "app.js", do NOT type "server.ts")
4. Click "Create" in the top right.

STEP 4: SET UP YOUR ENVIRONMENT FILE (.env)
--------------------------------------------
1. In cPanel, click "File Manager".
2. Open the application folder.
3. Look for "env.example" (or "env-template.txt").
4. Copy or rename it to ".env" (with a dot at the beginning).
   * Note: In File Manager, if you cannot see ".env", click "Settings" in the top-right corner
     and check "Show Hidden Files (dotfiles)", then click Save.
5. Right-click ".env" and click "Edit".
6. Fill in your database details:
   DB_DATABASE=username_nash_alumni
   DB_USERNAME=username_nash_user
   DB_PASSWORD=your_actual_password_from_step_1
   APP_URL=https://yourdomain.com
7. Click "Save Changes".

STEP 5: RUN NPM INSTALL & RESTART
----------------------------------
1. Go back to "Setup Node.js App" in cPanel.
2. Click the edit icon (pencil) next to your application.
3. Click the "Run NPM Install" button.
4. Click the "Restart" button.

STEP 6: OPEN YOUR WEBSITE & LOG IN
-----------------------------------
1. Visit your domain in your browser: https://yourdomain.com
2. Your website is LIVE!
3. To access the Admin Portal, click "Login" in the navigation bar.
4. Follow the on-screen Setup Wizard to set your administrator name, username, and password!
========================================================================
