# Backend Improvements - Quick Reference

## Quick Start

### 1. Using Async Handler

```typescript
import { asyncHandler } from '../middleware/asyncHandler';

// Wrap your async route handlers - errors are caught automatically
export const myRoute = asyncHandler(async (req, res) => {
  const data = await someAsyncOperation();
  res.json(data);
});
```

### 2. Throwing Semantic Errors

```typescript
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors';

// Throw appropriate errors - they're handled automatically
if (!user) throw new NotFoundError('User not found');
if (!email) throw new BadRequestError('Email is required');
if (!authorized) throw new ForbiddenError('Access denied');
```

### 3. Using Configuration

```typescript
import { config } from '../config/appConfig';

const port = config.port;
const isProduction = config.isProduction;
```

### 4. Validation Helpers

```typescript
import { isRequired, validateEmail, validateUUID } from '../utils/validation';

isRequired(email, 'Email');
validateEmail(email, 'Email');
validateUUID(id, 'User ID');
```

## Error Classes

| Class | Status | Use When |
|-------|--------|----------|
| `BadRequestError` | 400 | Invalid input or malformed request |
| `UnauthorizedError` | 401 | Authentication required or failed |
| `ForbiddenError` | 403 | User lacks permission |
| `NotFoundError` | 404 | Resource doesn't exist |
| `ConflictError` | 409 | Resource already exists or conflict |
| `ValidationError` | 422 | Data validation failed |
| `InternalServerError` | 500 | Unexpected server error |

## Request Context

Every request automatically has:
- `req.id` - Unique request identifier
- `req.startTime` - Request start timestamp
- `X-Request-ID` header in response

Use request ID to trace requests through logs:
```
[2024-01-08T12:00:00.000Z] [INFO] [RequestContext] GET /api/users/123
{
  "requestId": "a1b2c3d4e5f6...",
  "duration": "45ms"
}
```

## Health Check

```bash
curl http://localhost:3000/health
```

Returns:
```json
{
  "status": "ok",
  "message": "Teamly API is running",
  "database": "connected",
  "timestamp": "2024-01-08T12:00:00.000Z"
}
```

## Environment Variables

### New Optional Variables

```bash
# Performance
SLOW_REQUEST_THRESHOLD_MS=1000
REQUEST_BODY_SIZE_LIMIT=10mb

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=300
AUTH_RATE_LIMIT_MAX_REQUESTS=5

# Feature Flags
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_TWO_FACTOR=true
```

## Code Reduction Example

### Before (15 lines)
```typescript
export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(user);
  } catch (error) {
    logger.error('Failed', 'Controller', { error });
    res.status(500).json({ error: 'Failed' });
  }
};
```

### After (9 lines - 40% reduction)
```typescript
export const getUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  isRequired(id, 'User ID');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('User not found');
  res.json(user);
});
```

## Migration Checklist

- [ ] Import `asyncHandler` from middleware
- [ ] Import error classes from utils/errors
- [ ] Wrap async handlers with `asyncHandler()`
- [ ] Replace `res.status().json()` with `throw new ErrorClass()`
- [ ] Remove try-catch blocks
- [ ] Use validation helpers for input validation
- [ ] Use `config` instead of `process.env` directly
- [ ] Test the migrated endpoints

## Benefits Summary

✅ **40% less boilerplate code**
✅ **Automatic error handling and logging**
✅ **Request tracking with unique IDs**
✅ **Performance monitoring**
✅ **Automatic input sanitization**
✅ **Type-safe configuration**
✅ **Better error semantics**
✅ **Graceful shutdown**

## Documentation

- **Full Guide**: [docs/BACKEND_IMPROVEMENTS.md](./BACKEND_IMPROVEMENTS.md)
- **Changelog**: [docs/CHANGELOG_BACKEND_IMPROVEMENTS.md](./CHANGELOG_BACKEND_IMPROVEMENTS.md)
- **Migration Example**: [docs/examples/CONTROLLER_MIGRATION_EXAMPLE.ts](./examples/CONTROLLER_MIGRATION_EXAMPLE.ts)

## Support

All improvements are:
- ✅ Backward compatible
- ✅ Tested and validated
- ✅ Production-ready
- ✅ Security-scanned (CodeQL passed)
