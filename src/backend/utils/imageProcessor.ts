/**
 * Image Processing Utility
 * Handles secure image processing, resizing, and optimization
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { UPLOAD_CONFIG } from '../config/upload';
import { logger } from './logger';

export interface ProcessImageOptions {
  width: number;
  height: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

/**
 * Validate file signature using magic numbers
 * Prevents file type spoofing by checking actual file content
 */
export async function validateFileSignature(filePath: string): Promise<boolean> {
  try {
    const buffer = await fs.readFile(filePath);
    const header = Array.from(buffer.slice(0, 12));
    
    // Check JPEG signature
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return true;
    }
    
    // Check PNG signature
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
      return true;
    }
    
    // Check WebP signature (RIFF....WEBP)
    if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
        header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error validating file signature', 'ImageProcessor', { error, filePath });
    return false;
  }
}

/**
 * Validate image dimensions and format
 */
export async function validateImage(filePath: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // First check file signature
    const validSignature = await validateFileSignature(filePath);
    if (!validSignature) {
      return { valid: false, error: 'Invalid file type. File content does not match expected image format.' };
    }
    
    const metadata = await sharp(filePath).metadata();
    
    // Validate format
    if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
      return { valid: false, error: 'Invalid image format. Only JPEG, PNG, and WebP are allowed.' };
    }
    
    // Validate dimensions
    if (!metadata.width || !metadata.height) {
      return { valid: false, error: 'Unable to read image dimensions.' };
    }
    
    if (metadata.width > UPLOAD_CONFIG.IMAGE.MAX_WIDTH || metadata.height > UPLOAD_CONFIG.IMAGE.MAX_HEIGHT) {
      return { 
        valid: false, 
        error: `Image dimensions exceed maximum allowed size of ${UPLOAD_CONFIG.IMAGE.MAX_WIDTH}x${UPLOAD_CONFIG.IMAGE.MAX_HEIGHT}px.` 
      };
    }
    
    // Check for minimum dimensions
    if (metadata.width < 50 || metadata.height < 50) {
      return { valid: false, error: 'Image is too small. Minimum dimensions are 50x50px.' };
    }
    
    return { valid: true };
  } catch (error) {
    logger.error('Error validating image', 'ImageProcessor', { error, filePath });
    return { valid: false, error: 'Failed to validate image. The file may be corrupted.' };
  }
}

/**
 * Process and optimize image
 * - Strips EXIF data for privacy
 * - Resizes to specified dimensions
 * - Optimizes for web
 */
export async function processImage(
  inputPath: string,
  outputPath: string,
  options: ProcessImageOptions
): Promise<void> {
  try {
    const { width, height, fit = 'cover', quality = 85, format = 'jpeg' } = options;
    
    let pipeline = sharp(inputPath)
      // Auto-rotate based on EXIF orientation
      // Note: Sharp automatically removes EXIF data during processing
      .rotate()
      .resize(width, height, {
        fit,
        withoutEnlargement: true,
      });
    
    // Apply format-specific optimizations
    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({
        quality,
        progressive: true,
        mozjpeg: true,
      });
    } else if (format === 'png') {
      pipeline = pipeline.png({
        quality,
        compressionLevel: 9,
        progressive: true,
      });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({
        quality,
      });
    }
    
    await pipeline.toFile(outputPath);
    
    logger.info('Image processed successfully', 'ImageProcessor', { 
      inputPath, 
      outputPath, 
      width, 
      height 
    });
  } catch (error) {
    logger.error('Error processing image', 'ImageProcessor', { error, inputPath, outputPath });
    throw new Error('Failed to process image');
  }
}

/**
 * Generate a unique filename
 */
export function generateUniqueFilename(originalName: string, prefix: string = ''): string {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  return `${prefix}${timestamp}_${randomHash}${ext}`;
}

/**
 * Ensure upload directories exist
 */
export async function ensureUploadDirectories(): Promise<void> {
  try {
    await fs.mkdir(UPLOAD_CONFIG.UPLOAD_DIR.BASE, { recursive: true });
    await fs.mkdir(UPLOAD_CONFIG.UPLOAD_DIR.PROFILES, { recursive: true });
    await fs.mkdir(UPLOAD_CONFIG.UPLOAD_DIR.GROUPS, { recursive: true });
    await fs.mkdir(UPLOAD_CONFIG.UPLOAD_DIR.TEMP, { recursive: true });
    logger.info('Upload directories created successfully', 'ImageProcessor');
  } catch (error) {
    logger.error('Error creating upload directories', 'ImageProcessor', { error });
    throw error;
  }
}

/**
 * Delete a file safely
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    logger.info('File deleted successfully', 'ImageProcessor', { filePath });
  } catch (error) {
    // Log but don't throw - file might already be deleted
    logger.warn('Error deleting file', 'ImageProcessor', { error, filePath });
  }
}

/**
 * Delete old profile or group picture
 */
export async function deleteOldPicture(pictureUrl: string | null): Promise<void> {
  if (!pictureUrl) return;
  
  try {
    // Extract filename from URL (assumes format like /uploads/profiles/filename.jpg)
    const filename = path.basename(pictureUrl);
    
    // Determine directory based on URL
    let directory = UPLOAD_CONFIG.UPLOAD_DIR.PROFILES;
    if (pictureUrl.includes('/groups/')) {
      directory = UPLOAD_CONFIG.UPLOAD_DIR.GROUPS;
    }
    
    const filePath = path.join(directory, filename);
    await deleteFile(filePath);
  } catch (error) {
    logger.warn('Error deleting old picture', 'ImageProcessor', { error, pictureUrl });
  }
}
