#!/usr/bin/env python3
"""
Nanupur Abu Sobhan High School Alumni Platform
Production cPanel Deployment ZIP Packager
"""
import os
import zipfile
import shutil

OUTPUT_ZIP = "nash_alumni_cpanel_production.zip"

INCLUDE_FILES = [
    ".env.example",
    "env.example",
    "env-template.txt",
    ".htaccess",
    "htaccess-backup.txt",
    "app.js",
    "server.js",
    "database_setup.sql",
    "README_cPanel_Installation.txt",
    "composer.json",
    "package.json",
    "CPANEL_DEPLOYMENT_GUIDE.md",
    "server.ts",
]

INCLUDE_DIRS = [
    "dist",
    "server",
    "app",
    "routes",
    "database",
    "scripts",
]

EXCLUDE_PATTERNS = [
    ".env",
    "node_modules",
    ".git",
    ".cache",
    "__pycache__",
    ".DS_Store",
    "test-output",
    "db.json",
    "installed.json",
]

def should_exclude(filepath):
    normalized = filepath.replace("\\", "/")
    basename = os.path.basename(normalized)
    
    # Explicitly allow safe example templates
    if basename == ".env.example":
        return False
        
    # Block actual env files with secrets
    if basename == ".env" or basename.startswith(".env.") or basename.endswith(".env"):
        return True
        
    for pattern in ["node_modules", ".git", ".cache", "__pycache__", ".DS_Store", "db.json", "installed.json"]:
        if pattern in normalized:
            return True
            
    return False

def build_package():
    print(f"Creating production cPanel deployment package: {OUTPUT_ZIP}...")
    
    total_files = 0
    total_uncompressed_bytes = 0

    with zipfile.ZipFile(OUTPUT_ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
        # Add root files
        for fname in INCLUDE_FILES:
            if os.path.exists(fname) and not should_exclude(fname):
                zipf.write(fname, fname)
                total_files += 1
                total_uncompressed_bytes += os.path.getsize(fname)
                print(f"  + Added file: {fname}")

        # Add directories
        for dname in INCLUDE_DIRS:
            if not os.path.exists(dname):
                continue
            for root, dirs, files in os.walk(dname):
                # Filter out excluded directories in-place
                dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d))]
                for f in files:
                    full_path = os.path.join(root, f)
                    if not should_exclude(full_path):
                        arcname = full_path
                        zipf.write(full_path, arcname)
                        total_files += 1
                        total_uncompressed_bytes += os.path.getsize(full_path)

        # Add empty data and uploads placeholder structure
        zipf.writestr("data/.gitkeep", "")
        zipf.writestr("data/uploads/.gitkeep", "")
        total_files += 2

    zip_size = os.path.getsize(OUTPUT_ZIP)
    print("\n==================================================================")
    print(" 📦 CPANEL DEPLOYMENT PACKAGE SUCCESSFULLY BUILT")
    print("==================================================================")
    print(f"  Archive:            {OUTPUT_ZIP}")
    print(f"  Total Files:        {total_files}")
    print(f"  Compressed Size:    {zip_size / (1024 * 1024):.2f} MB ({zip_size:,} bytes)")
    print(f"  Uncompressed Size:  {total_uncompressed_bytes / (1024 * 1024):.2f} MB")
    print("==================================================================")

if __name__ == "__main__":
    build_package()
