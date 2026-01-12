# Error Handling Guide

This document describes the comprehensive error handling approach implemented across the Teamly application.

## Overview

The application uses a layered error handling strategy:
1. **Route Layer**: AsyncHandler wrapper catches all async errors
2. **Controller Layer**: Helper utilities for common error scenarios
3. **Service Layer**: ApiError subclasses for domain-specific errors
4. **Middleware Layer**: Centralized error handler and Prisma error conversion
5. **Frontend Layer**: Error boundaries, hooks, and utility functions

## Backend Error Handling

### Error Classes

Located in `src/backend/utils/errors.ts`:

```typescript
// Base error class
ApiError(message, statusCode, isOperational, code)

// Specific error types
BadRequestError(message, code)       // 400
UnauthorizedError(message, code)     // 401
ForbiddenError(message, code)        // 403
NotFoundError(message, code)         // 404
ConflictError(message, code)         // 409
ValidationError(message, code)       // 422
TooManyRequestsError(message, code)  // 429
InternalServerError(message, code)   // 500
ServiceUnavailableError(message, code) // 503
```

### Route Layer

All routes use the `asyncHandler` wrapper to automatically catch async errors:

```typescript
import { asyncHandler } from '../middleware/asyncHandler';

router.post('/events', asyncHandler(eventController.createEvent));
router.get('/events/:id', asyncHandler(eventController.getEvent));
```

### Controller Layer

Controllers use helper utilities from `src/backend/utils/controllerHelpers.ts`:

```typescript
import { 
  requireFields, 
  ensureResourceExists, 
  ensurePermission,
  sendSuccess 
} from '../utils/controllerHelpers';

export const getEvent = async (req: Request, res: Response) => {
  // Validate required fields
  requireFields(req.body, ['title', 'eventType', 'startTime']);
  
  // Fetch resource
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  
  // Ensure it exists (throws NotFoundError if null)
  ensureResourceExists(event, 'Event');
  
  // Check permissions (throws ForbiddenError if false)
  ensurePermission(event.creatorId === req.user.id, 'You can only edit your own events');
  
  // Send success response
  sendSuccess(res, event);
};
```

### Service Layer

Services throw ApiError subclasses for domain-specific errors:

```typescript
import { BadRequestError, NotFoundError } from '../utils/errors';

export const generateBrackets = async (tournamentId: string) => {
  const teams = await prisma.tournamentTeam.findMany({ where: { tournamentId } });
  
  if (teams.length < 2) {
    throw new BadRequestError(
      'At least 2 teams are required to generate brackets',
      'INSUFFICIENT_TEAMS'
    );
  }
  
  // ... rest of logic
};
```

### Database Error Handling

Prisma errors are automatically converted to ApiErrors by the error handler middleware:

```typescript
// In middleware/errorHandler.ts
export const errorHandler = (err, req, res, next) => {
  // Convert Prisma errors to ApiErrors
  if (isPrismaError(err)) {
    error = prismaErrorHandler(err);
  }
  // ... rest of error handling
};
```

Common Prisma error conversions:
- `P2002` (Unique constraint) → 409 Conflict
- `P2003` (Foreign key violation) → 400 Bad Request
- `P2025` (Record not found) → 404 Not Found
- `P1001/P1002` (Connection error) → 503 Service Unavailable
- `P2024` (Timeout) → 504 Gateway Timeout

### Error Response Format

All errors return a consistent JSON format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "stack": "Stack trace (development only)"
}
```

## Frontend Error Handling

### Error Utility Functions

Located in `src/frontend/src/utils/errorHandler.ts`:

```typescript
import { getErrorMessage, getUserFriendlyMessage, handleError } from '../utils/errorHandler';

// Get error message
const message = getErrorMessage(error);

// Get user-friendly message
const friendlyMessage = getUserFriendlyMessage(error);

// Handle error with options
handleError(error, {
  context: 'CreateEvent',
  showToast: (msg) => toast.error(msg),
  onAuthError: () => navigate('/login'),
  onNetworkError: () => setIsOffline(true)
});
```

### Error Boundary Component

Wrap components with ErrorBoundary to catch React errors:

```typescript
import ErrorBoundary from './components/common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}
```

### Custom Hooks

#### useErrorHandler

Basic error state management:

```typescript
import { useErrorHandler } from '../hooks/useErrorHandler';

function MyComponent() {
  const { error, message, hasError, handleError, clearError } = useErrorHandler({
    showToast: (msg) => toast.error(msg)
  });

  const handleSubmit = async () => {
    try {
      await api.createEvent(data);
    } catch (err) {
      handleError(err, 'CreateEvent');
    }
  };
}
```

#### useAsyncError

For async operations with loading state:

```typescript
import { useAsyncError } from '../hooks/useErrorHandler';

function MyComponent() {
  const { execute, isPending, error } = useAsyncError();

  const loadData = () => {
    execute(
      () => api.getEvents(),
      {
        onSuccess: (events) => setEvents(events),
        context: 'LoadEvents'
      }
    );
  };
}
```

#### useFormError

For form validation errors:

```typescript
import { useFormError } from '../hooks/useErrorHandler';

function MyForm() {
  const { handleFormError, fieldErrors, setFieldError } = useFormError();

  const handleSubmit = async () => {
    try {
      await api.createEvent(formData);
    } catch (err) {
      handleFormError(err); // Automatically extracts field errors
    }
  };

  return (
    <form>
      <input name="title" />
      {fieldErrors.title && <span>{fieldErrors.title}</span>}
    </form>
  );
}
```

### API Configuration

The API service (`src/frontend/src/services/api.ts`) includes:
- Request timeout (30 seconds)
- Automatic auth token injection
- Auto-redirect on 401 errors
- Development error logging

## Best Practices

### DO

✅ Always use `asyncHandler` wrapper on routes
✅ Throw ApiError subclasses from services
✅ Use helper utilities in controllers for common validations
✅ Provide specific error codes for client handling
✅ Log errors with appropriate context
✅ Use error boundaries in React components
✅ Provide user-friendly error messages

### DON'T

❌ Don't use generic `throw new Error()` in services
❌ Don't catch and silently ignore errors
❌ Don't send different error formats from different endpoints
❌ Don't expose sensitive information in error messages
❌ Don't forget to clean up resources on error
❌ Don't use generic error messages like "Something went wrong"

## Error Codes

### Authentication & Authorization (1000-1099)
- `AUTH_1000` - Unauthorized
- `AUTH_1001` - Invalid token
- `AUTH_1002` - Token expired
- `AUTH_1003` - Insufficient permissions
- `AUTH_1004` - Account locked
- `AUTH_1005` - Invalid credentials

### Validation (2000-2099)
- `VALID_2000` - Validation error
- `VALID_2001` - Invalid input
- `VALID_2002` - Required field missing
- `VALID_2003` - Invalid format

### Resource (3000-3099)
- `RES_3000` - Resource not found
- `RES_3001` - Resource already exists
- `RES_3002` - Resource conflict

### Database (4000-4099)
- `DB_4000` - Database error
- `DB_4001` - Query timeout
- `DB_4002` - Connection error

### Rate Limiting (5000-5099)
- `RATE_5000` - Rate limit exceeded

### Server (9000-9099)
- `SERVER_9000` - Internal server error
- `SERVER_9001` - Service unavailable
- `SERVER_9002` - External service error

## Testing Error Handling

### Backend Tests

```typescript
// Test error throwing
it('should throw BadRequestError for invalid input', async () => {
  await expect(
    service.createEvent({ /* invalid data */ })
  ).rejects.toThrow(BadRequestError);
});

// Test error responses
it('should return 400 for missing required fields', async () => {
  const response = await request(app)
    .post('/api/events')
    .send({ /* missing fields */ });
    
  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('error');
  expect(response.body).toHaveProperty('code');
});
```

### Frontend Tests

```typescript
// Test error handling
it('should display error message on API failure', async () => {
  server.use(
    rest.post('/api/events', (req, res, ctx) => {
      return res(ctx.status(400), ctx.json({ error: 'Invalid data' }));
    })
  );

  render(<CreateEvent />);
  // ... trigger submission
  
  expect(await screen.findByText('Invalid data')).toBeInTheDocument();
});
```

## Monitoring & Logging

All errors are logged with:
- Error level (error/warn)
- Context (which part of the application)
- Request details (path, method)
- Stack trace (for 5xx errors)
- Timestamp

Example log:

```json
{
  "level": "error",
  "message": "Event not found",
  "context": "EventController",
  "statusCode": 404,
  "code": "RESOURCE_NOT_FOUND",
  "path": "/api/events/123",
  "method": "GET",
  "timestamp": "2024-01-12T13:22:12.642Z"
}
```

## Migration Guide

### Converting Existing Controllers

Before:
```typescript
export const getEvent = async (req: Request, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    logger.error('Failed to get event', 'EventController', { error });
    res.status(500).json({ error: 'Failed to get event' });
  }
};
```

After:
```typescript
// Controller
export const getEvent = async (req: Request, res: Response) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  ensureResourceExists(event, 'Event');
  sendSuccess(res, event);
};

// Route
router.get('/events/:id', asyncHandler(getEvent));
```

### Converting Existing Services

Before:
```typescript
export const generateBrackets = async (tournamentId: string) => {
  const teams = await prisma.tournamentTeam.findMany({ where: { tournamentId } });
  
  if (teams.length < 2) {
    throw new Error('At least 2 teams required');
  }
  
  // ... rest
};
```

After:
```typescript
import { BadRequestError } from '../utils/errors';

export const generateBrackets = async (tournamentId: string) => {
  const teams = await prisma.tournamentTeam.findMany({ where: { tournamentId } });
  
  if (teams.length < 2) {
    throw new BadRequestError(
      'At least 2 teams are required to generate brackets',
      'INSUFFICIENT_TEAMS'
    );
  }
  
  // ... rest
};
```

## Conclusion

This comprehensive error handling approach ensures:
- Consistent error responses across the API
- Better debugging with detailed error information
- Improved user experience with friendly error messages
- Easier maintenance with centralized error handling
- Better security by not exposing sensitive information
