# OAuth Quick Setup Checklist

Use this checklist to quickly set up Google and Facebook OAuth for Teamly.

## Prerequisites
- [x] OAuth implementation (already complete ✅)
- [ ] Google Cloud account
- [ ] Facebook Developers account

## Google OAuth Setup

### Create Project & Credentials
- [ ] 1. Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] 2. Create new project or select existing project
- [ ] 3. Enable "Google+ API" or "Google People API"
- [ ] 4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
- [ ] 5. Configure OAuth consent screen:
  - App name: `Teamly`
  - User support email: your email
  - Scopes: `email`, `profile`, `openid`
- [ ] 6. Create OAuth client ID:
  - Application type: `Web application`
  - Authorized JavaScript origins: `http://localhost:3001`
  - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
- [ ] 7. Copy Client ID and Client Secret

### Add to Environment Variables
Add to backend `.env`:
```bash
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

## Facebook OAuth Setup

### Create App & Configure
- [ ] 1. Go to [Facebook Developers](https://developers.facebook.com/)
- [ ] 2. Click "My Apps" → "Create App"
- [ ] 3. Choose "Consumer" app type
- [ ] 4. App name: `Teamly`, Contact email: your email
- [ ] 5. Add "Facebook Login" product
- [ ] 6. Choose "Web" platform
- [ ] 7. Configure Facebook Login Settings:
  - Valid OAuth Redirect URIs: `http://localhost:3000/api/auth/facebook/callback`
  - Enable "Client OAuth Login"
  - Enable "Web OAuth Login"
- [ ] 8. Go to Settings → Basic
- [ ] 9. Copy App ID and App Secret

### Add to Environment Variables
Add to backend `.env`:
```bash
FACEBOOK_APP_ID=your-facebook-app-id-here
FACEBOOK_APP_SECRET=your-facebook-app-secret-here
FACEBOOK_CALLBACK_URL=http://localhost:3000/api/auth/facebook/callback
```

## Backend Configuration

### Environment Variables
Ensure these are in backend `.env`:
```bash
# Frontend URL
FRONTEND_URL=http://localhost:3001

# JWT Secret (should already exist)
JWT_SECRET=your-secret-key-change-this-in-production

# Database (should already exist)
DATABASE_URL=postgresql://...
```

### Database
- [ ] 1. Run migrations: `npx prisma migrate deploy`
- [ ] 2. Generate Prisma client: `npx prisma generate`

## Frontend Configuration

### Environment Variables
Ensure `src/frontend/.env` has:
```bash
VITE_API_URL=http://localhost:3000
```

## Start & Test

### Start Application
- [ ] 1. Start backend: `npm run dev` (from root)
- [ ] 2. Start frontend: `npm run dev` (from src/frontend)

### Test OAuth Flow

#### Test Google OAuth
- [ ] 1. Navigate to `http://localhost:3001/login`
- [ ] 2. Click "Sign in with Google"
- [ ] 3. Authenticate with Google
- [ ] 4. Verify redirect to dashboard
- [ ] 5. Check user created in database

#### Test Facebook OAuth
- [ ] 1. Navigate to `http://localhost:3001/login`
- [ ] 2. Click "Sign in with Facebook"
- [ ] 3. Authenticate with Facebook (must be app admin/developer/tester)
- [ ] 4. Verify redirect to dashboard
- [ ] 5. Check user created in database

#### Test Registration
- [ ] 1. Navigate to `http://localhost:3001/register`
- [ ] 2. Test "Sign up with Google"
- [ ] 3. Test "Sign up with Facebook"

#### Test Account Linking
- [ ] 1. Register with email/password
- [ ] 2. Go to profile settings
- [ ] 3. Link Google account
- [ ] 4. Link Facebook account
- [ ] 5. Verify both show as connected

#### Test Account Management
- [ ] 1. Go to profile settings
- [ ] 2. View connected OAuth accounts
- [ ] 3. Test unlinking an account (when multiple auth methods exist)
- [ ] 4. Test syncing profile picture from OAuth

## Production Deployment

### Update URLs
- [ ] 1. Update Google OAuth callback URL to production domain (HTTPS)
- [ ] 2. Update Facebook OAuth callback URL to production domain (HTTPS)
- [ ] 3. Update `.env` variables:
  ```bash
  FRONTEND_URL=https://your-production-domain.com
  GOOGLE_CALLBACK_URL=https://your-api-domain.com/api/auth/google/callback
  FACEBOOK_CALLBACK_URL=https://your-api-domain.com/api/auth/facebook/callback
  ```

### Security
- [ ] 1. Use HTTPS for all production URLs
- [ ] 2. Store secrets securely (don't commit to git)
- [ ] 3. Rotate OAuth secrets regularly
- [ ] 4. Review OAuth app permissions/scopes

### Facebook App Review
- [ ] 1. Submit Facebook app for review (to allow all users)
- [ ] 2. Request "email" permission approval
- [ ] 3. Add privacy policy URL
- [ ] 4. Add terms of service URL

## Troubleshooting

### Common Issues
- [ ] "redirect_uri_mismatch": Check callback URLs match exactly
- [ ] "access_denied": Verify OAuth scopes are configured
- [ ] Buttons don't work: Check backend URL in frontend .env
- [ ] Session errors: Verify JWT_SECRET is set

### Check Logs
- [ ] Backend logs: Look for "OAuth not configured" warnings
- [ ] Browser console: Check for network errors
- [ ] Database: Verify user records created with OAuth fields

## Verification

- [ ] ✅ Google OAuth working
- [ ] ✅ Facebook OAuth working
- [ ] ✅ New user registration via OAuth
- [ ] ✅ Existing user login via OAuth
- [ ] ✅ Account linking working
- [ ] ✅ Profile picture sync working
- [ ] ✅ OAuth management UI functional

## Resources

- **Detailed Setup**: `docs/OAUTH_SETUP.md`
- **Implementation Details**: `OAUTH_IMPLEMENTATION_COMPLETE.md`
- **Improvements Summary**: `OAUTH_IMPROVEMENTS_SUMMARY.md`
- **Google OAuth Docs**: https://developers.google.com/identity/protocols/oauth2
- **Facebook Login Docs**: https://developers.facebook.com/docs/facebook-login

---

**Need Help?**
- Check the detailed documentation files listed above
- Review backend logs for "OAuth" related messages
- Verify all environment variables are set correctly
- Test with incognito/private browser windows

**Status**: OAuth implementation is complete ✅ - just add your credentials!
