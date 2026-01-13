# Group Picture Upload Feature

## Overview

The Teamly application includes a complete and secure group picture upload feature that allows group administrators to upload, update, and delete group pictures.

## Features

### Frontend

- **Edit Group Page**: Admins can upload or change group pictures when editing their groups
- **Create Group Page**: Users can upload a group picture when creating a new group
- **Group Header**: Displays the group picture on the group details page
- **Image Upload Component**: Reusable component with preview, validation, and error handling

### Backend

- **Upload Endpoint**: `POST /api/groups/:id/picture`
- **Delete Endpoint**: `DELETE /api/groups/:id/picture`
- **Admin-Only Access**: Only group admins can upload or delete group pictures
- **File Validation**: Validates file type, size, and dimensions
- **Image Processing**: Resizes, optimizes, and strips EXIF data for security

## Security Features

1. **Access Control**
   - Only group administrators can upload or delete group pictures
   - Authentication required for all picture operations

2. **File Validation**
   - MIME type checking (image/jpeg, image/png, image/webp)
   - File extension validation (.jpg, .jpeg, .png, .webp)
   - Magic number validation to prevent file type spoofing
   - File size limit: 5MB
   - Image dimension limits: 2048x2048px max, 50x50px min

3. **Image Processing**
   - Automatic EXIF data removal for privacy
   - Image resizing to 800x600px for groups
   - JPEG optimization with mozjpeg
   - Quality set to 85 for optimal balance

4. **Path Security**
   - Path traversal protection
   - Sanitized filenames
   - Unique filename generation

5. **Rate Limiting**
   - Upload rate limiting to prevent abuse
   - Separate limits for authenticated users

## Usage

### For Administrators

#### Uploading a Group Picture

1. Navigate to the group details page
2. Click the "Edit" button (pencil icon)
3. On the Edit Group page, click the "Upload" or "Change" button in the Group Picture section
4. Select an image file (JPEG, PNG, or WebP, max 5MB)
5. The image will be automatically uploaded and displayed
6. Click "Update Group" to save other changes

#### Deleting a Group Picture

1. Navigate to the Edit Group page
2. Click the delete button (trash icon) next to the group picture
3. The picture will be removed immediately

### For Developers

#### API Usage

**Upload Group Picture**
```bash
POST /api/groups/:id/picture
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body:
  groupPicture: <file>
```

**Delete Group Picture**
```bash
DELETE /api/groups/:id/picture
Authorization: Bearer <token>
```

#### Frontend Integration

```typescript
import { groupsAPI } from '../services/api';

// Upload picture
const handlePictureUpload = async (file: File) => {
  const response = await groupsAPI.uploadGroupPicture(groupId, file);
  console.log('Uploaded:', response.data.group.picture);
};

// Delete picture
const handleDeletePicture = async () => {
  const response = await groupsAPI.deleteGroupPicture(groupId);
  console.log('Deleted');
};
```

## File Structure

### Backend
- `src/backend/controllers/groupController.ts` - Upload/delete handlers
- `src/backend/middleware/upload.ts` - Multer configuration
- `src/backend/utils/imageProcessor.ts` - Image processing utilities
- `src/backend/config/upload.ts` - Upload configuration
- `src/backend/routes/groupRoutes.ts` - Route definitions

### Frontend
- `src/frontend/src/pages/EditGroup.tsx` - Group editing page
- `src/frontend/src/pages/CreateGroup.tsx` - Group creation page
- `src/frontend/src/components/ImageUpload.tsx` - Reusable upload component
- `src/frontend/src/components/GroupDetails/GroupHeader.tsx` - Picture display
- `src/frontend/src/services/api.ts` - API service methods
- `src/frontend/src/utils/imageUtils.ts` - Image URL utilities

### Upload Directories
- `uploads/groups/` - Processed group pictures
- `uploads/profiles/` - User profile pictures
- `uploads/temp/` - Temporary uploads during processing

## Configuration

### Backend Configuration (`src/backend/config/upload.ts`)

```typescript
UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
  IMAGE: {
    GROUP_WIDTH: 800,
    GROUP_HEIGHT: 600,
    JPEG_QUALITY: 85,
  }
}
```

### Frontend Configuration

Image validation in `ImageUpload.tsx`:
- Allowed types: JPEG, PNG, WebP
- Max file size: 5MB
- Client-side validation before upload

## Error Handling

The system provides clear error messages for:
- Invalid file types
- File size exceeded
- Missing admin permissions
- Image processing failures
- Network errors

## Status

✅ **Fully Implemented and Functional**

All components are working correctly:
- Upload functionality
- Delete functionality
- Admin access control
- File validation
- Image processing
- Error handling
- Security measures

## Testing

To test the feature:

1. Start the application
2. Log in as a user
3. Create a group (user becomes admin)
4. Navigate to edit the group
5. Upload a group picture
6. Verify the picture displays on the group page
7. Try deleting the picture
8. Verify the picture is removed

## Troubleshooting

**Picture not displaying:**
- Check VITE_API_URL environment variable is set correctly
- Verify the server is serving static files from `/uploads`
- Check browser console for CORS errors

**Upload failing:**
- Verify file size is under 5MB
- Check file type is JPEG, PNG, or WebP
- Ensure you are a group administrator
- Check server logs for detailed error messages

**Permissions error:**
- Only group admins can upload/delete pictures
- Verify your user has admin role in the group

## Future Enhancements

Potential improvements:
- Image cropping interface
- Multiple image upload
- Image gallery for groups
- Thumbnail generation
- CDN integration for better performance
