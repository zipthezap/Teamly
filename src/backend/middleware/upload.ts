/**
 * File Upload Middleware
 * Secure file upload handling with validation
 */

import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { UPLOAD_CONFIG } from '../config/upload';
import { generateUniqueFilename } from '../utils/imageProcessor';
import { logger } from '../utils/logger';

// Configure storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Store in temp directory first for validation
    cb(null, UPLOAD_CONFIG.UPLOAD_DIR.TEMP);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename
    const filename = generateUniqueFilename(file.originalname, 'temp_');
    cb(null, filename);
  },
});

// File filter for validation
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  try {
    // Check MIME type
    if (!UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      logger.warn('Invalid file MIME type', 'UploadMiddleware', { 
        mimetype: file.mimetype,
        userId: (req as any).user?.id 
      });
      return cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
    
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
      logger.warn('Invalid file extension', 'UploadMiddleware', { 
        extension: ext,
        userId: (req as any).user?.id 
      });
      return cb(new Error('Invalid file extension. Only .jpg, .jpeg, .png, and .webp are allowed.'));
    }
    
    // Sanitize filename to prevent path traversal
    const sanitizedOriginalName = path.basename(file.originalname);
    if (sanitizedOriginalName !== file.originalname) {
      logger.warn('Attempted path traversal in filename', 'UploadMiddleware', { 
        originalname: file.originalname,
        userId: (req as any).user?.id 
      });
      return cb(new Error('Invalid filename.'));
    }
    
    cb(null, true);
  } catch (error) {
    logger.error('Error in file filter', 'UploadMiddleware', { error });
    cb(new Error('Error validating file.'));
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE,
    files: 1, // Only allow one file at a time
    fields: 10, // Limit number of fields to prevent DoS
    parts: 20, // Limit number of parts
  },
});

/**
 * Wrapper for handling multer errors properly
 */
const multerErrorHandler = (uploadMiddleware: any) => {
  return (req: Request, res: any, next: any) => {
    uploadMiddleware(req, res, (error: any) => {
      if (error instanceof multer.MulterError) {
        logger.warn('Multer error', 'UploadMiddleware', { 
          error: error.message, 
          code: error.code,
          userId: (req as any).user?.id 
        });
        
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: `File too large. Maximum size is ${UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB.` 
          });
        }
        
        if (error.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Too many files. Only one file allowed.' });
        }
        
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: 'Unexpected field name.' });
        }
        
        return res.status(400).json({ error: 'File upload error.' });
      }
      
      if (error) {
        logger.error('Upload error', 'UploadMiddleware', { error, userId: (req as any).user?.id });
        return res.status(400).json({ error: error.message || 'File upload failed.' });
      }
      
      next();
    });
  };
};

/**
 * Middleware for uploading profile picture with error handling
 */
export const uploadProfilePicture = multerErrorHandler(upload.single('profilePicture'));

/**
 * Middleware for uploading group picture with error handling
 */
export const uploadGroupPicture = multerErrorHandler(upload.single('groupPicture'));
