# OAuth Setup Guide

This guide will help you set up Google and Facebook OAuth authentication for Teamly.

## Table of Contents
- [Overview](#overview)
- [Google OAuth Setup](#google-oauth-setup)
- [Facebook OAuth Setup](#facebook-oauth-setup)
- [Environment Configuration](#environment-configuration)
- [Testing OAuth](#testing-oauth)

## Overview

Teamly now supports OAuth authentication with Google and Facebook, allowing users to:
- Register using their Google or Facebook account
- Login with their existing social media credentials
- Link their social accounts to existing Teamly accounts
- Join groups via invite links after OAuth authentication

## Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "Teamly") and click "Create"

### Step 2: Enable Google+ API

1. In the left sidebar, go to "APIs & Services" → "Library"
2. Search for "Google+ API" or "Google People API"
3. Click on it and press "Enable"

### Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in the required fields:
     - App name: "Teamly"
     - User support email: your email
     - Developer contact: your email
   - Add scopes: `email`, `profile`, `openid`
   - Add test users if in testing mode
4. Create OAuth client ID:
   - Application type: "Web application"
   - Name: "Teamly OAuth Client"
   - Authorized JavaScript origins:
     - `http://localhost:3001` (frontend URL for development)
     - Your production frontend URL
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/google/callback` (backend callback for development)
     - Your production backend callback URL
5. Click "Create"
6. Copy the Client ID and Client Secret

## Facebook OAuth Setup

### Step 1: Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Choose "Consumer" as the app type
4. Fill in the app details:
   - App Name: "Teamly"
   - App Contact Email: your email
5. Click "Create App"

### Step 2: Set Up Facebook Login

1. In your app dashboard, click "Add Product"
2. Find "Facebook Login" and click "Set Up"
3. Choose "Web" as the platform
4. Enter your site URL: `http://localhost:3001` (or your production URL)
5. Skip the quickstart and go to "Facebook Login" → "Settings"
6. Configure OAuth settings:
   - Valid OAuth Redirect URIs:
     - `http://localhost:3000/api/auth/facebook/callback` (for development)
     - Your production backend callback URL
   - Enable "Client OAuth Login"
   - Enable "Web OAuth Login"
7. Save changes

### Step 3: Get App Credentials

1. Go to "Settings" → "Basic"
2. Copy the App ID and App Secret

### Step 4: Add Email Permission

1. Go to "App Review" → "Permissions and Features"
2. Request "email" permission (this is usually pre-approved for basic apps)

## Environment Configuration

### Backend (.env)

Add the following to your backend `.env` file:

```bash
# OAuth Configuration
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id-here
FACEBOOK_APP_SECRET=your-facebook-app-secret-here
FACEBOOK_CALLBACK_URL=http://localhost:3000/api/auth/facebook/callback

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3001
```

**Production Settings:**
- Update all URLs to use HTTPS
- Use your production domain names
- Keep secrets secure and never commit them to version control

### Frontend (.env)

Ensure your frontend `.env` file has:

```bash
# Backend API URL
VITE_API_URL=http://localhost:3000
```

## Database Migration

Run the database migration to add OAuth fields to the User model:

```bash
npx prisma migrate dev
```

This will add the following fields to the User table:
- `googleId` - Unique identifier from Google
- `facebookId` - Unique identifier from Facebook
- `authProvider` - The auth provider used ('local', 'google', 'facebook')
- Makes `password` field optional (nullable)

## Testing OAuth

### Testing Google OAuth

1. Start both backend and frontend servers:
   ```bash
   # Backend (from root directory)
   npm run dev

   # Frontend (from src/frontend directory)
   npm run dev
   ```

2. Navigate to the registration page: `http://localhost:3001/register`

3. Click "Sign up with Google"

4. You should be redirected to Google's login page

5. After successful authentication, you'll be redirected back to the app

### Testing Facebook OAuth

1. Follow the same steps as Google OAuth but click "Sign up with Facebook"

2. **Note:** Facebook apps in development mode can only be accessed by:
   - App administrators
   - App developers
   - Testers added in the App Review section

3. To test with other users, add them as testers in your Facebook app settings

### Testing Group Invite Links with OAuth

1. Create a group and generate an invite link
2. Open the invite link in an incognito/private browser window
3. Click to register with Google or Facebook
4. After OAuth authentication, you should automatically join the group

## Troubleshooting

### "redirect_uri_mismatch" Error

- Ensure the callback URL in your OAuth app settings exactly matches the one in your `.env` file
- Include the protocol (http:// or https://)
- Check for trailing slashes

### "access_denied" Error

- Make sure you've added the required scopes (email, profile)
- For Facebook, ensure the email permission is approved

### User Not Created

- Check backend logs for errors
- Ensure Prisma migrations have been run
- Verify database connection

### Session Errors

- Make sure `JWT_SECRET` is set in your backend `.env`
- Check that express-session is properly configured

## Security Considerations

1. **Never commit OAuth credentials** to version control
2. **Use HTTPS in production** - OAuth providers may reject HTTP callback URLs in production
3. **Rotate secrets regularly** - Update OAuth secrets periodically
4. **Limit OAuth scopes** - Only request the minimum permissions needed
5. **Validate redirect URLs** - Ensure callback URLs are properly configured to prevent open redirects

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [Passport.js Documentation](http://www.passportjs.org/)
