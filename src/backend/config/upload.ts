/**
 * File Upload Configuration
 * Secure configuration for image uploads
 */

export const UPLOAD_CONFIG = {
  // Maximum file size: 5MB
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  
  // Allowed MIME types
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  
  // Allowed file extensions
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
  
  // Image processing options
  IMAGE: {
    // Maximum dimensions
    MAX_WIDTH: 2048,
    MAX_HEIGHT: 2048,
    
    // Profile picture dimensions
    PROFILE_WIDTH: 400,
    PROFILE_HEIGHT: 400,
    
    // Group picture dimensions
    GROUP_WIDTH: 800,
    GROUP_HEIGHT: 600,
    
    // Thumbnail dimensions
    THUMBNAIL_WIDTH: 150,
    THUMBNAIL_HEIGHT: 150,
    
    // JPEG quality (1-100)
    JPEG_QUALITY: 85,
    
    // WebP quality (1-100)
    WEBP_QUALITY: 85,
  },
  
  // Upload directories
  UPLOAD_DIR: {
    BASE: 'uploads',
    PROFILES: 'uploads/profiles',
    GROUPS: 'uploads/groups',
    TEMP: 'uploads/temp',
  },
};

// Magic numbers for file type validation
export const FILE_SIGNATURES = {
  JPEG: [0xff, 0xd8, 0xff],
  PNG: [0x89, 0x50, 0x4e, 0x47],
  WEBP: [0x52, 0x49, 0x46, 0x46], // RIFF header, followed by WEBP
};
