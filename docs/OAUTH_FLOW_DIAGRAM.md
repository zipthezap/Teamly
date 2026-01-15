# OAuth Flow Diagram - Google & Facebook Authentication

## Overview

This document provides a visual representation of the OAuth authentication flow in Teamly.

## Complete OAuth Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INITIATES OAUTH                            │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ├── Login Page: Clicks "Sign in with Google/Facebook"
                                   └── Register Page: Clicks "Sign up with Google/Facebook"
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Login.tsx / Register.tsx)                  │
│  • User clicks OAuth button                                             │
│  • handleOAuthLogin() / handleOAuthSignup() called                      │
│  • Redirects to: ${VITE_API_URL}/auth/{google|facebook}                │
│  • Optional: Includes inviteGroupId query parameter                     │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND - OAuth Route (authRoutes.ts)                │
│  • GET /api/auth/google or /api/auth/facebook                          │
│  • Stores inviteGroupId in session if provided                         │
│  • Calls passport.authenticate() with provider                         │
│  • Redirects user to OAuth provider's login page                       │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              OAUTH PROVIDER (Google / Facebook)                         │
│  • User logs in with provider credentials                               │
│  • User grants permissions (email, profile, picture)                    │
│  • Provider redirects to callback URL with auth code                    │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               BACKEND - OAuth Callback (passport.ts)                    │
│  • Passport strategy receives profile from provider:                    │
│    - For Google: scope=['profile', 'email']                            │
│    - For Facebook: profileFields=['id','emails','name',                │
│                                    'displayName','picture'] ✅ FIXED    │
│  • Strategy processes profile data:                                     │
│    1. Check if user exists with googleId/facebookId                    │
│    2. If exists: Log them in                                           │
│    3. If not, check if email exists                                    │
│    4. If email exists: Link OAuth account to existing user             │
│    5. If new: Create new user with OAuth data                          │
│  • Stores: email, name, providerId, authProvider,                      │
│            oauthProfilePicture, emailVerified=true                     │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             BACKEND - OAuth Callback Handler (authController.ts)        │
│  • oauthCallback() function called                                      │
│  • Generates JWT token pair (access + refresh)                         │
│  • Retrieves inviteGroupId from session (if stored)                    │
│  • Clears session data                                                  │
│  • Redirects to: ${FRONTEND_URL}/auth/callback with:                   │
│    - token (access token)                                               │
│    - refreshToken                                                       │
│    - inviteGroupId (optional)                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                FRONTEND - AuthCallback.tsx                              │
│  • Receives tokens and inviteGroupId from URL params                    │
│  • Stores tokens in localStorage                                        │
│  • Updates AuthContext with setTokens()                                 │
│  • If inviteGroupId exists:                                             │
│    - Fetches user profile using token                                   │
│    - Calls groupsAPI.joinByInvite(userId, inviteGroupId)              │
│    - Redirects to: /groups/${inviteGroupId}                            │
│  • Else:                                                                │
│    - Redirects to: /dashboard                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER SUCCESSFULLY LOGGED IN                       │
│  • User is authenticated with JWT tokens                                │
│  • User profile includes OAuth data                                     │
│  • User is automatically added to group (if invite link used)          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Database Schema

### User Model OAuth Fields

```typescript
model User {
  // ... other fields ...
  
  // OAuth Integration
  googleId    String?  @unique        // Google OAuth ID
  facebookId  String?  @unique        // Facebook OAuth ID
  authProvider String?                // 'local' | 'google' | 'facebook'
  oauthProfilePicture String?         // Profile picture URL from OAuth
  lastOAuthSync DateTime?             // Last OAuth data sync timestamp
  
  // Standard fields
  email        String   @unique       // Email (verified for OAuth)
  password     String?                // Optional (null for OAuth-only users)
  name         String                 // Display name
  emailVerified Boolean @default(false) // Auto-true for OAuth
  
  @@index([googleId])     // Fast OAuth lookups
  @@index([facebookId])   // Fast OAuth lookups
}
```

## OAuth Provider Configuration

### Google OAuth
```typescript
// passport.ts
new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']  // Automatically includes picture
})
```

### Facebook OAuth
```typescript
// passport.ts
new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL,
  profileFields: [
    'id',
    'emails',
    'name',
    'displayName',
    'picture'  // ✅ FIXED: Added to retrieve profile pictures
  ]
})
```

## Frontend Routes

### OAuth-Related Pages

```typescript
// App.tsx
<Route path="/login" element={<Login />} />
<Route path="/register" element={<Register />} />
<Route path="/auth/callback" element={<AuthCallback />} />
```

### Login/Register OAuth Buttons

```typescript
// Both Login.tsx and Register.tsx
<Button
  variant="outlined"
  startIcon={<GoogleIcon />}
  onClick={() => handleOAuthLogin('google')}
>
  Sign in with Google
</Button>

<Button
  variant="outlined"
  startIcon={<FacebookIcon />}
  onClick={() => handleOAuthLogin('facebook')}
>
  Sign in with Facebook
</Button>
```

## Backend Routes

### OAuth Authentication Endpoints

```typescript
// authRoutes.ts

// Google OAuth
GET  /api/auth/google               // Initiate OAuth
GET  /api/auth/google/callback      // OAuth callback

// Facebook OAuth
GET  /api/auth/facebook             // Initiate OAuth
GET  /api/auth/facebook/callback    // OAuth callback

// OAuth Management (Authenticated)
GET  /api/auth/oauth/status         // Get OAuth connection status
POST /api/auth/oauth/unlink         // Unlink OAuth account
POST /api/auth/oauth/sync-picture   // Sync OAuth profile picture
```

## Security Features

### Session Security
```typescript
// server.ts
session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production',  // HTTPS only in prod
    httpOnly: true,                     // Prevent XSS
    maxAge: 24 * 60 * 60 * 1000,       // 24 hours
    sameSite: 'strict'                  // CSRF protection
  }
})
```

### JWT Token Security
```typescript
// jwt.ts
- Access Token: 7 days expiry (configurable)
- Refresh Token: Used to generate new access tokens
- Tokens stored per-session in database
- Device tracking (user agent)
- IP address logging
- Token revocation support
```

## Error Handling

### OAuth Failure Redirects

```typescript
// Backend
❌ Google auth failed  → /login?error=google_auth_failed
❌ Facebook auth failed → /login?error=facebook_auth_failed
❌ General OAuth error  → /login?error=oauth_failed

// Frontend AuthCallback.tsx
if (errorParam) {
  setError('OAuth authentication failed')
  setTimeout(() => navigate('/login'), 3000)
}
```

## Environment Variables

### Required Configuration

```bash
# Backend (.env)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_CALLBACK_URL=http://localhost:3000/api/auth/facebook/callback

FRONTEND_URL=http://localhost:3001
SESSION_SECRET=...
JWT_SECRET=...

# Frontend (.env)
VITE_API_URL=http://localhost:3000/api
```

## Feature Highlights

### ✅ Account Linking
- Users can link Google/Facebook to existing email accounts
- Original authProvider preserved
- Multiple OAuth accounts can be linked

### ✅ Profile Pictures
- Automatically retrieved from OAuth providers
- Stored in `oauthProfilePicture` field
- Can be synced on demand
- Used as default profile picture

### ✅ Group Invites
- OAuth flow preserves inviteGroupId
- Users automatically join group after authentication
- Works for both new registrations and existing users

### ✅ Account Unlinking
- Users can unlink OAuth accounts
- Safety check: Must have at least one auth method (password or OAuth)
- Primary authProvider updated automatically

## Testing Checklist

### Google OAuth
- [ ] New user registration with Google
- [ ] Existing user login with Google
- [ ] Profile picture retrieval
- [ ] Email verification automatic
- [ ] Group invite via Google OAuth

### Facebook OAuth
- [ ] New user registration with Facebook
- [ ] Existing user login with Facebook
- [ ] Profile picture retrieval ✅ FIXED
- [ ] Email verification automatic
- [ ] Group invite via Facebook OAuth

### Account Management
- [ ] Link Google to existing account
- [ ] Link Facebook to existing account
- [ ] Unlink OAuth account (with password)
- [ ] Cannot unlink last auth method
- [ ] Sync OAuth profile picture

## Common Issues & Solutions

### Issue: redirect_uri_mismatch
**Solution**: Ensure callback URL in OAuth app exactly matches `.env` configuration

### Issue: Profile picture not showing (Facebook)
**Solution**: ✅ FIXED - Added 'picture' to profileFields

### Issue: Email not retrieved
**Solution**: Ensure 'email' scope/permission is approved in OAuth app

### Issue: Session errors
**Solution**: Set SESSION_SECRET in backend .env

## References

- OAuth 2.0 Specification: https://oauth.net/2/
- Google OAuth: https://developers.google.com/identity/protocols/oauth2
- Facebook Login: https://developers.facebook.com/docs/facebook-login
- Passport.js: http://www.passportjs.org/
