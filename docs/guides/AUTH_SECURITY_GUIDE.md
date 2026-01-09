# Enhanced Authentication & Security Features

This document describes the enhanced authentication, security, and reliability features implemented in Teamly.

## Table of Contents
- [JWT Token Management](#jwt-token-management)
- [Email Verification](#email-verification)
- [Session Management](#session-management)
- [Event Concurrency Control](#event-concurrency-control)
- [Email Queue & Reliability](#email-queue--reliability)
- [API Endpoints](#api-endpoints)

## JWT Token Management

### Overview
Teamly now uses a dual-token authentication system for enhanced security:

1. **Access Token**: Short-lived token (7 days default) for API authentication
2. **Refresh Token**: Long-lived token (30 days) for obtaining new access tokens

### Features

#### Token Refresh
- Access tokens can be refreshed without re-authentication
- Refresh tokens are stored securely in the database
- Automatic cleanup of expired tokens

#### Token Revocation
- Individual tokens can be revoked (logout)
- All user tokens can be revoked at once (logout from all devices)
- Tokens are automatically revoked on password change/reset
- Revoked tokens are stored in a blacklist until natural expiration

#### Session Tracking
- Each login creates a session record with:
  - Device information (user agent)
  - IP address
  - Last activity timestamp
  - Expiration time
- Users can view all active sessions
- Sessions are automatically cleaned up on logout or expiration

### Configuration

Set these environment variables in your `.env` file:

```bash
JWT_SECRET=your-secret-key-change-this-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this-in-production
JWT_EXPIRY_DAYS=7  # Access token expiration in days
```

**Security Note**: Use different secrets for JWT_SECRET and JWT_REFRESH_SECRET in production.

## Email Verification

### Overview
New user registrations now require email verification before full access.

### Flow
1. User registers → Verification email sent
2. User clicks link in email → Email verified
3. User gains full access to the platform

### Features
- Email verification tokens are cryptographically secure
- Tokens expire after 24 hours
- Users can request a new verification email
- Unverified users can still login but may have restricted access

### API Endpoints

```bash
# Verify email
POST /api/auth/verify-email
Body: { "token": "verification-token" }

# Resend verification email
POST /api/auth/resend-verification
Body: { "email": "user@example.com" }
```

## Session Management

### Overview
Users can view and manage all active sessions across devices.

### Features
- View all active sessions with device and location info
- See last activity time for each session
- Logout from specific devices (coming soon)
- Logout from all devices at once

### API Endpoints

```bash
# Get all active sessions
GET /api/auth/sessions
Headers: Authorization: Bearer <access-token>

# Logout current session
POST /api/auth/logout
Headers: Authorization: Bearer <access-token>

# Logout all sessions
POST /api/auth/logout-all
Headers: Authorization: Bearer <access-token>
```

## Event Concurrency Control

### Overview
Event joins are now protected against race conditions with database-level transaction handling.

### Problem Solved
Previously, multiple users could join an event simultaneously and exceed the `maxPlayers` limit due to a race condition between checking the count and creating the participant record.

### Solution

#### Transactional Joins
- All event joins use database transactions with **Serializable** isolation level
- Transactions lock event records during the join process
- Accurate participant counting within the transaction
- Automatic rollback on conflicts

#### Features
- Atomic join operations (all-or-nothing)
- Race condition prevention
- Accurate maxPlayers enforcement
- Proper error handling with specific error messages
- Supports both authenticated users and guest participants

#### Implementation Details

```typescript
// Serializable transaction ensures no concurrent modifications
await prisma.$transaction(async (tx) => {
  // 1. Lock event record
  const event = await tx.event.findFirst({ ... });
  
  // 2. Count current participants accurately
  const confirmedCount = await tx.eventParticipant.count({ ... });
  
  // 3. Check maxPlayers limit
  if (confirmedCount >= event.maxPlayers) {
    throw new Error('EVENT_FULL');
  }
  
  // 4. Create participant
  await tx.eventParticipant.create({ ... });
}, {
  isolationLevel: 'Serializable',
  maxWait: 5000,
  timeout: 10000
});
```

### Benefits
- **No overbooking**: Events will never exceed maxPlayers
- **Fairness**: First come, first served with accurate ordering
- **Consistency**: Database state is always consistent
- **Reliability**: Automatic retry on transient failures

## Email Queue & Reliability

### Overview
Email delivery is now handled through a persistent queue with automatic retry and failure handling.

### Features

#### Persistent Queue
- All emails are stored in database before sending
- Emails survive server restarts
- Queue status tracking (pending, sent, failed, retry)

#### Automatic Retry
- Failed emails are automatically retried
- Exponential backoff between retry attempts
- Configurable maximum retry attempts (default: 3)
- Retry delays: 5min → 10min → 20min

#### Delivery Tracking
- Track delivery status for each email
- Store error messages for debugging
- Record timestamps for scheduling and delivery
- Statistics on queue performance

#### Dead Letter Queue
- Emails that fail after max retries are marked as 'failed'
- Failed emails can be manually retried
- Failed emails are retained for debugging

### Architecture

```
┌─────────────┐
│ Application │ ──┐
└─────────────┘   │
                  ▼
              ┌──────────┐
              │ Enqueue  │
              │  Email   │
              └────┬─────┘
                   │
                   ▼
          ┌────────────────┐
          │  Email Queue   │
          │   (Database)   │
          └────┬───────────┘
               │
               ▼
       ┌───────────────┐
       │  Processor    │ ◄── Runs every minute
       │  (Background) │
       └───────┬───────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
    ┌──────┐     ┌────────┐
    │ Send │     │ Retry  │
    │  ✓   │     │ (5min) │
    └──────┘     └────────┘
```

### Usage

#### Direct Send (Immediate)
```typescript
import { sendEmailWithQueue } from '../services/emailQueueService';

await sendEmailWithQueue(
  'user@example.com',
  'Welcome to Teamly',
  '<h1>Welcome!</h1>',
  { immediate: true }
);
```

#### Queued Send (Reliable)
```typescript
await sendEmailWithQueue(
  'user@example.com',
  'Event Reminder',
  '<h1>Event Tomorrow</h1>',
  {
    templateType: 'eventReminder',
    templateData: { eventTitle: 'Football Match' },
    maxAttempts: 5
  }
);
```

### Background Services

#### Email Queue Processor
- Runs every 60 seconds
- Processes up to 50 emails per batch
- Handles retries with exponential backoff

#### Scheduled Cleanup Jobs
- Runs every hour
- Cleans up expired tokens (access, refresh, revoked)
- Removes old processed emails (30+ days)
- Maintains database performance

### Monitoring

#### Queue Statistics
```typescript
import { getQueueStats } from '../services/emailQueueService';

const stats = await getQueueStats();
// Returns: { pending: 10, sent: 150, failed: 2, retry: 5 }
```

#### Manual Retry
```typescript
import { retryFailedEmails } from '../services/emailQueueService';

// Retry all failed emails
await retryFailedEmails();
```

## API Endpoints

### Authentication

```bash
# Register (returns access token + refresh token)
POST /api/auth/register
Body: {
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}

# Login (returns access token + refresh token)
POST /api/auth/login
Body: {
  "email": "user@example.com",
  "password": "SecurePass123!",
  "twoFactorToken": "123456"  # Optional, if 2FA enabled
}

# Refresh access token
POST /api/auth/refresh-token
Body: {
  "refreshToken": "your-refresh-token"
}

# Logout (revoke current token)
POST /api/auth/logout
Headers: Authorization: Bearer <access-token>

# Logout all devices
POST /api/auth/logout-all
Headers: Authorization: Bearer <access-token>

# Get active sessions
GET /api/auth/sessions
Headers: Authorization: Bearer <access-token>

# Verify email
POST /api/auth/verify-email
Body: { "token": "verification-token" }

# Resend verification email
POST /api/auth/resend-verification
Body: { "email": "user@example.com" }
```

### Response Format

#### Successful Login/Register
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresIn": 604800,
  "refreshExpiresIn": 2592000
}
```

#### Token Refresh
```json
{
  "accessToken": "new-jwt-access-token",
  "expiresIn": 604800
}
```

#### Sessions List
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "deviceInfo": "Mozilla/5.0...",
      "ipAddress": "192.168.1.1",
      "lastActive": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T08:00:00Z",
      "expiresAt": "2024-01-22T08:00:00Z"
    }
  ]
}
```

## Security Considerations

### Best Practices

1. **Token Storage**
   - Store access tokens in memory or secure storage (not localStorage)
   - Store refresh tokens securely (httpOnly cookies preferred)
   - Never log tokens

2. **Token Rotation**
   - Refresh access tokens before expiration
   - Implement token refresh on 401 responses
   - Handle token expiration gracefully

3. **Session Management**
   - Monitor active sessions regularly
   - Logout from unknown devices
   - Set up alerts for suspicious activity

4. **Email Security**
   - Use HTTPS for verification links
   - Implement rate limiting on verification requests
   - Expire verification tokens promptly

5. **Concurrency**
   - Trust the transactional join mechanism
   - Don't rely on client-side checks only
   - Handle race condition errors gracefully

## Maintenance

### Regular Tasks

1. **Token Cleanup**
   - Automatic: Runs hourly
   - Manual: Call `cleanupExpiredTokens()`

2. **Email Queue Cleanup**
   - Automatic: Runs hourly
   - Manual: Call `cleanupOldEmails()`

3. **Database Backups**
   - Include EmailQueue table
   - Include session tables (RefreshToken, RevokedToken, UserSession)

### Monitoring

Monitor these metrics:
- Failed login attempts
- Token revocations
- Email queue size and failure rate
- Session count per user
- Database transaction conflicts

## Troubleshooting

### Common Issues

#### "Token has been revoked" Error
- User logged out or changed password
- Request new tokens via login or refresh

#### "Event is full" Error
- Event reached maxPlayers limit
- Retry logic handles this automatically

#### Emails Not Sending
- Check email queue status
- Verify SMTP configuration
- Check email service logs
- Review failed emails in database

#### High Database Load
- Review transaction timeout settings
- Check for deadlocks in logs
- Consider connection pooling adjustments

## Migration Guide

### Upgrading from Previous Version

1. **Run Database Migration**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

2. **Update Environment Variables**
   ```bash
   # Add to .env
   JWT_REFRESH_SECRET=your-refresh-secret-key
   ```

3. **Update Client Code**
   - Store both access and refresh tokens
   - Implement token refresh logic
   - Handle new error responses

4. **Test**
   - Verify registration flow with email
   - Test login/logout functionality
   - Verify event joining with multiple users
   - Check email delivery

## Support

For issues or questions:
- Check logs in application
- Review database state
- Consult this documentation
- Contact development team
