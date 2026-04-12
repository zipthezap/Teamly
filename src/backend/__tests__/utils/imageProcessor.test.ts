import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

vi.mock('sharp');
vi.mock('fs/promises');
vi.mock('../../config/upload', () => ({
  UPLOAD_CONFIG: {
    IMAGE: { MAX_WIDTH: 2048, MAX_HEIGHT: 2048 },
    UPLOAD_DIR: {
      BASE: 'uploads',
      PROFILES: 'uploads/profiles',
      GROUPS: 'uploads/groups',
      TEMP: 'uploads/temp',
    },
  },
}));

import sharp from 'sharp';
import * as fs from 'fs/promises';
import {
  validateFileSignature,
  validateImage,
  processImage,
  generateUniqueFilename,
  deleteFile,
  deleteOldPicture,
  ensureUploadDirectories,
} from '../../utils/imageProcessor';

const mockSharpInstance = {
  metadata: vi.fn(),
  rotate: vi.fn().mockReturnThis(),
  resize: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  png: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  toFile: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sharp).mockReturnValue(mockSharpInstance as any);
  vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
  vi.mocked(fs.unlink).mockResolvedValue(undefined as any);
  mockSharpInstance.toFile.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// validateFileSignature
// ---------------------------------------------------------------------------

describe('validateFileSignature', () => {
  it('accepts JPEG magic bytes', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]) as any,
    );
    expect(await validateFileSignature('image.jpg')).toBe(true);
  });

  it('accepts PNG magic bytes', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]) as any,
    );
    expect(await validateFileSignature('image.png')).toBe(true);
  });

  it('accepts WebP magic bytes (RIFF....WEBP)', async () => {
    const buf = Buffer.alloc(12);
    // RIFF at bytes 0-3
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
    // WEBP at bytes 8-11
    buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50;
    vi.mocked(fs.readFile).mockResolvedValue(buf as any);
    expect(await validateFileSignature('image.webp')).toBe(true);
  });

  it('rejects random bytes', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]) as any,
    );
    expect(await validateFileSignature('file.bin')).toBe(false);
  });

  it('returns false when fs.readFile throws', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    expect(await validateFileSignature('missing.jpg')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateImage
// ---------------------------------------------------------------------------

describe('validateImage', () => {
  const validJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  it('returns invalid when file signature is rejected', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]) as any);
    const result = await validateImage('file.bin');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid file type/);
  });

  it('returns invalid for unsupported format (gif)', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validJpegBytes as any);
    mockSharpInstance.metadata.mockResolvedValue({ format: 'gif', width: 200, height: 200 });
    const result = await validateImage('image.gif');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid image format/);
  });

  it('returns invalid when dimensions are missing', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validJpegBytes as any);
    mockSharpInstance.metadata.mockResolvedValue({ format: 'jpeg' });
    const result = await validateImage('image.jpg');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Unable to read/);
  });

  it('returns invalid when dimensions exceed maximum', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validJpegBytes as any);
    mockSharpInstance.metadata.mockResolvedValue({ format: 'jpeg', width: 3000, height: 200 });
    const result = await validateImage('image.jpg');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/exceed maximum/);
  });

  it('returns invalid when image is too small (width < 50)', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validJpegBytes as any);
    mockSharpInstance.metadata.mockResolvedValue({ format: 'jpeg', width: 20, height: 200 });
    const result = await validateImage('image.jpg');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too small/);
  });

  it('returns invalid when image is too small (height < 50)', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validJpegBytes as any);
    mockSharpInstance.metadata.mockResolvedValue({ format: 'jpeg', width: 200, height: 20 });
    const result = await validateImage('image.jpg');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too small/);
  });

  it('returns valid for a well-formed 200x200 JPEG', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validJpegBytes as any);
    mockSharpInstance.metadata.mockResolvedValue({ format: 'jpeg', width: 200, height: 200 });
    const result = await validateImage('image.jpg');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns invalid (corrupted) when sharp throws', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(validJpegBytes as any);
    mockSharpInstance.metadata.mockRejectedValue(new Error('corrupt image data'));
    const result = await validateImage('image.jpg');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/corrupted/);
  });
});

// ---------------------------------------------------------------------------
// processImage
// ---------------------------------------------------------------------------

describe('processImage', () => {
  const baseOptions = { width: 400, height: 400 };

  it('calls sharp with inputPath and chains rotate/resize/toFile', async () => {
    await processImage('input.jpg', 'output.jpg', baseOptions);
    expect(vi.mocked(sharp)).toHaveBeenCalledWith('input.jpg');
    expect(mockSharpInstance.rotate).toHaveBeenCalled();
    expect(mockSharpInstance.resize).toHaveBeenCalledWith(400, 400, expect.any(Object));
    expect(mockSharpInstance.toFile).toHaveBeenCalledWith('output.jpg');
  });

  it('uses jpeg() with quality and progressive when format is jpeg', async () => {
    await processImage('input.jpg', 'output.jpg', { ...baseOptions, format: 'jpeg', quality: 90 });
    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 90, progressive: true }),
    );
    expect(mockSharpInstance.png).not.toHaveBeenCalled();
    expect(mockSharpInstance.webp).not.toHaveBeenCalled();
  });

  it('uses png() when format is png', async () => {
    await processImage('input.png', 'output.png', { ...baseOptions, format: 'png' });
    expect(mockSharpInstance.png).toHaveBeenCalled();
    expect(mockSharpInstance.jpeg).not.toHaveBeenCalled();
  });

  it('uses webp() when format is webp', async () => {
    await processImage('input.webp', 'output.webp', { ...baseOptions, format: 'webp' });
    expect(mockSharpInstance.webp).toHaveBeenCalled();
    expect(mockSharpInstance.jpeg).not.toHaveBeenCalled();
  });

  it('throws "Failed to process image" when toFile rejects', async () => {
    mockSharpInstance.toFile.mockRejectedValue(new Error('disk full'));
    await expect(processImage('input.jpg', 'output.jpg', baseOptions)).rejects.toThrow(
      'Failed to process image',
    );
  });
});

// ---------------------------------------------------------------------------
// generateUniqueFilename
// ---------------------------------------------------------------------------

describe('generateUniqueFilename', () => {
  it('returns a string ending with the original extension', () => {
    const name = generateUniqueFilename('photo.jpg');
    expect(name.endsWith('.jpg')).toBe(true);
  });

  it('includes a timestamp-like numeric portion', () => {
    const name = generateUniqueFilename('photo.png');
    // format: <timestamp>_<hex>.<ext>
    expect(/\d{10,}/.test(name)).toBe(true);
  });

  it('produces different filenames on consecutive calls', () => {
    const a = generateUniqueFilename('photo.jpg');
    const b = generateUniqueFilename('photo.jpg');
    expect(a).not.toBe(b);
  });

  it('prepends the prefix when provided', () => {
    const name = generateUniqueFilename('photo.jpg', 'user_');
    expect(name.startsWith('user_')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deleteFile
// ---------------------------------------------------------------------------

describe('deleteFile', () => {
  it('calls fs.unlink with the given file path', async () => {
    await deleteFile('uploads/profiles/photo.jpg');
    expect(vi.mocked(fs.unlink)).toHaveBeenCalledWith('uploads/profiles/photo.jpg');
  });

  it('does not rethrow when fs.unlink throws', async () => {
    vi.mocked(fs.unlink).mockRejectedValue(new Error('ENOENT'));
    await expect(deleteFile('missing.jpg')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deleteOldPicture
// ---------------------------------------------------------------------------

describe('deleteOldPicture', () => {
  it('is a no-op when pictureUrl is null', async () => {
    await deleteOldPicture(null);
    expect(vi.mocked(fs.unlink)).not.toHaveBeenCalled();
  });

  it('deletes from profiles directory for a /profiles/ URL', async () => {
    await deleteOldPicture('/uploads/profiles/photo.jpg');
    const expectedPath = path.join('uploads/profiles', 'photo.jpg');
    expect(vi.mocked(fs.unlink)).toHaveBeenCalledWith(expectedPath);
  });

  it('deletes from groups directory for a /groups/ URL', async () => {
    await deleteOldPicture('/uploads/groups/banner.jpg');
    const expectedPath = path.join('uploads/groups', 'banner.jpg');
    expect(vi.mocked(fs.unlink)).toHaveBeenCalledWith(expectedPath);
  });

  it('defaults to profiles directory when no /groups/ in URL', async () => {
    await deleteOldPicture('/uploads/misc/image.png');
    const expectedPath = path.join('uploads/profiles', 'image.png');
    expect(vi.mocked(fs.unlink)).toHaveBeenCalledWith(expectedPath);
  });
});

// ---------------------------------------------------------------------------
// ensureUploadDirectories
// ---------------------------------------------------------------------------

describe('ensureUploadDirectories', () => {
  it('calls fs.mkdir 4 times with { recursive: true }', async () => {
    await ensureUploadDirectories();
    expect(vi.mocked(fs.mkdir)).toHaveBeenCalledTimes(4);
    for (const call of vi.mocked(fs.mkdir).mock.calls) {
      expect(call[1]).toEqual({ recursive: true });
    }
  });

  it('calls mkdir for each configured upload directory', async () => {
    await ensureUploadDirectories();
    const dirs = vi.mocked(fs.mkdir).mock.calls.map((c) => c[0]);
    expect(dirs).toContain('uploads');
    expect(dirs).toContain('uploads/profiles');
    expect(dirs).toContain('uploads/groups');
    expect(dirs).toContain('uploads/temp');
  });

  it('rethrows when fs.mkdir throws', async () => {
    vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error('EACCES'));
    await expect(ensureUploadDirectories()).rejects.toThrow('EACCES');
  });
});
