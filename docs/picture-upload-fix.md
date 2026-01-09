# Picture Upload Fix

## Problem
The frontend was unable to fetch uploaded images, resulting in:
```
GET http://localhost:3000/uploads/groups/group_xxx.jpg 
net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin 404 (Not Found)
```

## Root Causes

### 1. Port Conflict (Development Mode)
- **Frontend Vite dev server**: Configured to run on port 3000
- **Backend server**: Also configured to run on port 3000
- **Result**: When frontend tried to fetch `localhost:3000/uploads/...`, it hit its own dev server instead of the backend

### 2. Docker Configuration Issues
- **Missing volume mount**: Uploads directory was not mounted as a volume
- **Ephemeral storage**: Uploaded files would be lost when container restarts
- **Missing directory structure**: Dockerfile didn't create uploads subdirectories

## Solutions Implemented

### 1. Fixed Port Conflict
**File**: `src/frontend/vite.config.ts`
```typescript
server: {
  port: 3001,  // Changed from 3000 to 3001
}
```

### 2. Added Docker Volume Mount
**File**: `docker-compose.yml`
```yaml
backend:
  volumes:
    - uploads_data:/app/uploads
volumes:
  uploads_data:
```

### 3. Created Directory Structure in Dockerfile
**File**: `Dockerfile.backend`
```dockerfile
RUN mkdir -p /app/uploads/profiles /app/uploads/groups /app/uploads/temp
```

### 4. Added .gitkeep Files
Created `.gitkeep` files in:
- `uploads/profiles/.gitkeep`
- `uploads/groups/.gitkeep`
- `uploads/temp/.gitkeep`

This preserves the directory structure in version control.

### 5. Updated Documentation
- Updated `README.md` with correct ports and environment variables
- Updated `src/frontend/README.md` with Vite commands
- Updated `src/frontend/.env.example` to include `VITE_API_URL`

## How It Works Now

### Development Mode
1. **Backend** runs on `http://localhost:3000`
2. **Frontend** runs on `http://localhost:3001`
3. Frontend fetches images from `http://localhost:3000/uploads/...` (backend)
4. No port conflict!

### Docker Mode
1. **Backend** runs on port 3000 (container and host)
2. **Frontend** runs on port 80 (container and host)
3. Uploads persist in `uploads_data` volume
4. Directory structure is created on container start

## Testing the Fix

### Development Mode
```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend
cd src/frontend
npm run dev
```

Then:
1. Navigate to `http://localhost:3001`
2. Upload a profile or group picture
3. Verify the image displays correctly

### Docker Mode
```bash
docker-compose up --build
```

Then:
1. Navigate to `http://localhost`
2. Upload a profile or group picture
3. Verify the image displays correctly
4. Restart containers and verify images persist

## Additional Notes

- The backend serves static files from `/uploads` route
- Files are stored with secure naming: `profile_timestamp_randomhash.ext`
- Images are processed and optimized before storage
- CORS is configured to allow cross-origin requests in development
