import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../db';

export interface SavedFileInfo {
  url: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export class FileStorageService {
  private static uploadBaseDir = path.join(process.cwd(), 'public', 'uploads');

  /**
   * Ensure necessary upload directories exist
   */
  public static ensureUploadDirs() {
    const subdirs = ['photos', 'documents', 'committee', 'logos'];
    for (const dir of subdirs) {
      const fullPath = path.join(this.uploadBaseDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
  }

  /**
   * Validate file signature (magic bytes) to ensure authenticity
   */
  public static validateImageMagicBytes(buffer: Buffer): { valid: boolean; detectedMime?: string; ext?: string } {
    if (!buffer || buffer.length < 12) {
      return { valid: false };
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { valid: true, detectedMime: 'image/jpeg', ext: '.jpg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { valid: true, detectedMime: 'image/png', ext: '.png' };
    }

    // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { valid: true, detectedMime: 'image/webp', ext: '.webp' };
    }

    // GIF (optional support): 47 49 46 38
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    ) {
      return { valid: true, detectedMime: 'image/gif', ext: '.gif' };
    }

    return { valid: false };
  }

  /**
   * Saves a base64 encoded image string to persistent disk storage.
   * Enforces database-driven size limits, mime validation, and magic byte verification.
   */
  public static async saveBase64Image(
    dataUriOrBase64: string,
    subfolder = 'photos',
    customMaxSizeBytes?: number
  ): Promise<SavedFileInfo | null> {
    if (!dataUriOrBase64 || typeof dataUriOrBase64 !== 'string') {
      return null;
    }

    this.ensureUploadDirs();

    // Determine configured image size limit from database settings table (default 1.5 MB = 1,572,864 bytes)
    let configuredLimitMb = 1.5;
    try {
      const settingVal = (db as any)?.getSetting ? (db as any).getSetting('registration_image_max_size') : null;
      if (settingVal) {
        const parsed = parseFloat(settingVal);
        if (!isNaN(parsed) && parsed > 0) configuredLimitMb = parsed;
      } else if (db?.get('registration_config')?.max_image_size_mb) {
        configuredLimitMb = Number(db.get('registration_config').max_image_size_mb);
      }
    } catch {
      configuredLimitMb = db?.get('registration_config')?.max_image_size_mb || 1.5;
    }
    const maxSizeBytes = customMaxSizeBytes || Math.round(configuredLimitMb * 1024 * 1024);

    // Check if it has data URI prefix
    const matches = dataUriOrBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let rawBase64 = dataUriOrBase64;
    let declaredMime = 'image/jpeg';

    if (matches && matches.length === 3) {
      declaredMime = matches[1];
      rawBase64 = matches[2];
    } else if (dataUriOrBase64.startsWith('data:')) {
      // Malformed data URI
      return null;
    }

    // Convert to buffer
    const buffer = Buffer.from(rawBase64, 'base64');

    // Check size limit against database configuration
    if (buffer.length > maxSizeBytes) {
      const allowedMb = (maxSizeBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
      const actualMb = (buffer.length / (1024 * 1024)).toFixed(2);
      throw new Error(`File size (${actualMb} MB) exceeds maximum allowed limit of ${allowedMb} MB.`);
    }

    // Validate magic bytes
    const magicCheck = this.validateImageMagicBytes(buffer);
    if (!magicCheck.valid || !magicCheck.ext) {
      throw new Error('Invalid image file format. Only JPEG, PNG, and WebP images are permitted.');
    }

    // Verify against allowed formats in configuration if configured
    const configuredFormats = db?.get('registration_config')?.image_accepted_formats;
    if (Array.isArray(configuredFormats) && configuredFormats.length > 0 && magicCheck.detectedMime) {
      if (!configuredFormats.includes(magicCheck.detectedMime)) {
        throw new Error(`Image format "${magicCheck.detectedMime}" is not permitted. Allowed formats: JPG, PNG, WebP.`);
      }
    }

    const uniqueId = crypto.randomBytes(12).toString('hex');
    const filename = `${subfolder.replace(/[^a-z0-9]/gi, '')}_${Date.now()}_${uniqueId}${magicCheck.ext}`;
    const targetDir = path.join(this.uploadBaseDir, subfolder);
    const targetPath = path.join(targetDir, filename);

    await fs.promises.writeFile(targetPath, buffer);

    const publicUrl = `/uploads/${subfolder}/${filename}`;

    return {
      url: publicUrl,
      storagePath: targetPath,
      filename,
      mimeType: magicCheck.detectedMime || declaredMime,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Intercepts photo_url fields in request payloads:
   * If base64 data URI is supplied, it automatically persists it to disk
   * and returns the clean relative file URL (e.g. /uploads/photos/photo_123.jpg).
   * If already a persistent URL, validates and returns it as-is.
   */
  public static async processIncomingPhotoUrl(
    photoUrl: string | undefined | null,
    subfolder = 'photos',
    customMaxSizeBytes?: number
  ): Promise<string | undefined> {
    if (!photoUrl || typeof photoUrl !== 'string') {
      return undefined;
    }

    const trimmed = photoUrl.trim();
    if (!trimmed) {
      return undefined;
    }

    // If already stored on disk or a valid relative/absolute path
    if (trimmed.startsWith('/uploads/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    // If base64 data URI, persist to disk
    if (trimmed.startsWith('data:image/')) {
      try {
        const saved = await this.saveBase64Image(trimmed, subfolder, customMaxSizeBytes);
        if (saved) {
          return saved.url;
        }
      } catch (err: any) {
        console.warn('[FileStorageService] Failed to persist incoming image:', err.message);
        throw err;
      }
    }

    return trimmed;
  }
}
