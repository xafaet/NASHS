#!/usr/bin/env python3
"""
Nanupur Abu Sobhan High School Alumni Platform & 85th Reunion
Production cPanel Deployment Package Builder
Creates a turnkey ZIP archive for direct deployment to cPanel File Manager or Git.
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
    "index.php",
    "app.js",
    "server.js",
    "database_setup.sql",
    "README_cPanel_Installation.txt",
    "CPANEL_DEPLOYMENT_GUIDE.md",
    "composer.json",
    "package.json",
]

INCLUDE_DIRS = [
    "dist",
    "server",
    "app",
    "routes",
    "database",
    "storage",
    "public",
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
    
    # Explicitly allow safe example templates and gitignores
    if basename in [".env.example", ".gitignore", ".htaccess", ".gitkeep"]:
        return False
        
    # Block actual env files with secrets
    if basename == ".env" or (basename.startswith(".env.") and not basename.endswith(".example")):
        return True
        
    for pattern in ["node_modules", ".git", ".cache", "__pycache__", ".DS_Store", "db.json", "installed.json"]:
        if pattern in normalized:
            return True
            
    return False

def build_package():
    print(f"==================================================================")
    print(f" Packaging cPanel Production Distribution: {OUTPUT_ZIP}...")
    print(f"==================================================================")
    
    total_files = 0
    total_uncompressed_bytes = 0

    # Ensure storage logs directory structure exists before packaging
    os.makedirs("storage/logs", exist_ok=True)
    os.makedirs("data/uploads", exist_ok=True)

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

        # Write compiled production index.html to zip root (Prevents loading uncompiled main.tsx)
        if os.path.exists("dist/index.html"):
            zipf.write("dist/index.html", "index.html")
            total_files += 1
            total_uncompressed_bytes += os.path.getsize("dist/index.html")
            print("  + Added compiled production index.html to package root (replacing dev source)")

        # Mirror compiled production assets to root assets/ so both /assets/* and dist/assets/* resolve directly
        if os.path.exists("dist/assets"):
            for asset_file in os.listdir("dist/assets"):
                full_asset = os.path.join("dist/assets", asset_file)
                if os.path.isfile(full_asset):
                    zipf.write(full_asset, f"assets/{asset_file}")
                    total_files += 1
                    total_uncompressed_bytes += os.path.getsize(full_asset)
                    print(f"  + Mirrored compiled asset: assets/{asset_file}")

        # Add empty data and uploads placeholder structure
        zipf.writestr("data/.gitkeep", "")
        zipf.writestr("data/uploads/.gitkeep", "")
        zipf.writestr("storage/logs/.gitkeep", "")
        total_files += 3

    zip_size = os.path.getsize(OUTPUT_ZIP)
    print("\n==================================================================")
    print(" 📦 CPANEL DEPLOYMENT ARCHIVE SUCCESSFULLY GENERATED")
    print("==================================================================")
    print(f"  Archive:            {OUTPUT_ZIP}")
    print(f"  Total Files:        {total_files}")
    print(f"  Compressed Size:    {zip_size / (1024 * 1024):.2f} MB ({zip_size:,} bytes)")
    print(f"  Uncompressed Size:  {total_uncompressed_bytes / (1024 * 1024):.2f} MB")
    print(f"  Target cPanel Path: public_html/ or /home/username/app")
    print("==================================================================")

if __name__ == "__main__":
    build_package()
