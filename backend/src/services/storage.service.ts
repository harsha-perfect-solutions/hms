import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageResult {
  storedName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface IStorageService {
  saveFile(buffer: Buffer, originalName: string, reportedMimeType: string): Promise<StorageResult>;
  getFilePath(storedName: string): string;
  deleteFile(storedName: string): Promise<void>;
  validateFile(buffer: Buffer, originalName: string, reportedMimeType: string): void;
}

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export class LocalStorageService implements IStorageService {
  private readonly storageRoot: string;

  constructor(customStorageDir?: string) {
    this.storageRoot = customStorageDir || path.resolve(process.cwd(), 'uploads', 'complaints');
    if (!fs.existsSync(this.storageRoot)) {
      fs.mkdirSync(this.storageRoot, { recursive: true });
    }
  }

  /**
   * Validates file size, extension, MIME type, and magic bytes.
   */
  public validateFile(buffer: Buffer, originalName: string, reportedMimeType: string): void {
    if (!buffer || buffer.length === 0) {
      throw new Error('File content is empty.');
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error('File size exceeds the 5MB limit.');
    }

    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Invalid file extension "${ext}". Only JPG, PNG, and WebP images are permitted.`);
    }

    const normalizedMime = reportedMimeType.toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
      throw new Error(`Invalid MIME type "${reportedMimeType}". Only JPEG, PNG, and WebP images are permitted.`);
    }

    // Verify magic bytes
    if (!this.verifyMagicBytes(buffer, normalizedMime)) {
      throw new Error('File content does not match the expected image signature.');
    }
  }

  /**
   * Magic number inspection to protect against MIME spoofing
   */
  private verifyMagicBytes(buffer: Buffer, mime: string): boolean {
    if (buffer.length < 12) return false;

    // JPEG: FF D8 FF
    if (mime === 'image/jpeg') {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (mime === 'image/png') {
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    }

    // WebP: RIFF .... WEBP
    if (mime === 'image/webp') {
      const isRiff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
      const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
      return isRiff && isWebp;
    }

    return false;
  }

  /**
   * Sanitizes original filename for safe database metadata storage
   */
  public sanitizeFilename(originalName: string): string {
    // Strip path components
    const base = path.basename(originalName);
    // Replace dangerous characters, non-ascii, and control chars
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
    return cleaned || 'attachment';
  }

  /**
   * Securely saves file to local disk with unique UUID filename
   */
  public async saveFile(buffer: Buffer, originalName: string, reportedMimeType: string): Promise<StorageResult> {
    this.validateFile(buffer, originalName, reportedMimeType);

    const ext = path.extname(originalName).toLowerCase();
    const safeOriginal = this.sanitizeFilename(originalName);
    const uniqueId = crypto.randomUUID();
    const storedName = `${uniqueId}${ext}`;

    const destination = path.join(this.storageRoot, storedName);

    // Path traversal check
    const relative = path.relative(this.storageRoot, destination);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Illegal file storage path detected.');
    }

    await fs.promises.writeFile(destination, buffer);

    return {
      storedName,
      fileName: safeOriginal,
      fileSize: buffer.length,
      mimeType: reportedMimeType.toLowerCase(),
    };
  }

  /**
   * Resolves safe absolute path to stored file, preventing path traversal
   */
  public getFilePath(storedName: string): string {
    const cleanStoredName = path.basename(storedName);
    const target = path.resolve(this.storageRoot, cleanStoredName);

    const relative = path.relative(this.storageRoot, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid or unsafe file path.');
    }

    if (!fs.existsSync(target)) {
      throw new Error('Requested attachment file does not exist on storage.');
    }

    return target;
  }

  /**
   * Deletes a stored file
   */
  public async deleteFile(storedName: string): Promise<void> {
    try {
      const filePath = this.getFilePath(storedName);
      await fs.promises.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }
}

export const storageService = new LocalStorageService();
