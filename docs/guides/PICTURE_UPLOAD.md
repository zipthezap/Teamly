# Picture Upload Feature

## Overview
This feature enables secure picture uploads for user profiles and group pictures with comprehensive security measures.

## Security Features

### 1. File Validation
- **MIME Type Validation**: Only accepts image/jpeg, image/png, and image/webp
- **Extension Validation**: Only .jpg, .jpeg, .png, and .webp extensions allowed
- **Magic Number Validation**: Validates actual file content using magic numbers to prevent file type spoofing
- **Size Limits**: Maximum 5MB per upload
- **Dimension Validation**: Images must be between 50x50px and 2048x2048px

### 2. Image Processing
- **EXIF Stripping**: Removes all metadata including GPS data for privacy
- **Auto-resize**: Resizes images to optimal dimensions
  - Profile pictures: 400x400px
  - Group pictures: 800x600px
- **Optimization**: Compresses images with quality settings (85% JPEG quality)
- **Format Conversion**: Converts all uploads to JPEG for consistency

### 3. Access Control
- **Authentication Required**: All upload endpoints require authentication
- **Authorization**: Group picture uploads restricted to group admins only
- **Rate Limiting**: 10 uploads per hour per IP address

### 4. Storage Security
- **Unique Filenames**: Generated using timestamp + cryptographic random hash
- **Path Traversal Prevention**: Sanitizes all filenames
- **Separate Directories**: Profiles and groups stored in separate directories
- **Static File Security**: Serves only image files with proper Content-Type headers

## API Endpoints

### Profile Picture
- **Upload/Update**: `POST /api/auth/profile/picture`
  - Requires: Authentication
  - Field name: `profilePicture`
  - Returns: Updated user object with picture URL

- **Delete**: `DELETE /api/auth/profile/picture`
  - Requires: Authentication
  - Returns: Updated user object with picture removed

### Group Picture
- **Upload/Update**: `POST /api/groups/:id/picture`
  - Requires: Authentication + Admin role in group
  - Field name: `groupPicture`
  - Returns: Updated group object with picture URL

- **Delete**: `DELETE /api/groups/:id/picture`
  - Requires: Authentication + Admin role in group
  - Returns: Updated group object with picture removed

## Usage Example

### Using curl
```bash
# Upload profile picture
curl -X POST http://localhost:3000/api/auth/profile/picture \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "profilePicture=@/path/to/image.jpg"

# Upload group picture
curl -X POST http://localhost:3000/api/groups/GROUP_ID/picture \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "groupPicture=@/path/to/image.jpg"
```

### Using JavaScript fetch
```javascript
const formData = new FormData();
formData.append('profilePicture', file);

const response = await fetch('/api/auth/profile/picture', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

## Configuration

Environment variables (in `.env`):
```
# Maximum file upload size in MB (default: 5)
MAX_FILE_UPLOAD_SIZE_MB=5

# Upload directory (default: uploads)
UPLOAD_DIR=uploads
```

## File Structure
```
uploads/
├── profiles/    # User profile pictures
├── groups/      # Group pictures
└── temp/        # Temporary files during processing
```

## Security Considerations

1. **Dependencies**: Using multer v2.0.2+ which has no known vulnerabilities
2. **No Execution**: Uploaded files cannot be executed as code
3. **Content-Type Enforcement**: Server enforces correct Content-Type headers
4. **X-Content-Type-Options**: Set to 'nosniff' to prevent MIME type sniffing
5. **Rate Limiting**: Prevents abuse and DoS attacks
6. **Clean-up**: Failed uploads are automatically cleaned up

## Monitoring

The system logs all upload operations including:
- Successful uploads
- Failed validations
- File deletions
- Security violations (path traversal attempts, invalid file types)

Check logs with context: `ImageProcessor`, `UploadMiddleware`, `AuthController`, `GroupController`
