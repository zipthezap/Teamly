# Social Login Implementation Guide

## Overview
Adding Facebook and Gmail (Google) OAuth login requires external setup and configuration. This document outlines what would be needed to implement this feature.

## Requirements

### 1. OAuth Libraries
Install necessary dependencies:
```bash
npm install passport passport-google-oauth20 passport-facebook
```

### 2. Facebook App Setup
1. Create a Facebook App at https://developers.facebook.com/
2. Configure OAuth redirect URI: `http://localhost:3000/api/auth/facebook/callback`
3. Obtain App ID and App Secret
4. Add to `.env`:
   ```
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   ```

### 3. Google OAuth Setup
1. Create a project at https://console.cloud.google.com/
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Configure authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
5. Add to `.env`:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

## Implementation Steps

### Backend Changes

1. **Update Prisma Schema** - Add OAuth fields to User model:
```prisma
model User {
  // ... existing fields
  oauthProvider String?  // 'google', 'facebook', 'local'
  oauthId       String?  @unique
}
```

2. **Configure Passport** - Create `src/backend/config/passport.js`:
```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const prisma = require('./database');

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { oauthId: profile.id }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: profile.emails[0].value,
          name: profile.displayName,
          oauthProvider: 'google',
          oauthId: profile.id,
          password: '' // OAuth users don't need password
        }
      });
    }
    
    return done(null, user);
  }
));

// Facebook Strategy
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: '/api/auth/facebook/callback',
    profileFields: ['id', 'emails', 'name']
  },
  async (accessToken, refreshToken, profile, done) => {
    // Similar implementation to Google
  }
));
```

3. **Add Routes** - Update `src/backend/routes/authRoutes.js`:
```javascript
// Google OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const token = generateToken(req.user.id);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

// Facebook OAuth
router.get('/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false }),
  (req, res) => {
    const token = generateToken(req.user.id);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);
```

4. **Initialize Passport** - Update `src/backend/server.js`:
```javascript
const passport = require('passport');
require('./config/passport');

app.use(passport.initialize());
```

### Frontend Changes

1. **Add OAuth Buttons to Login Page**:
```jsx
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';

// In Login component
<Button
  fullWidth
  variant="outlined"
  startIcon={<GoogleIcon />}
  onClick={() => window.location.href = 'http://localhost:3000/api/auth/google'}
  sx={{ mb: 1 }}
>
  Continue with Google
</Button>

<Button
  fullWidth
  variant="outlined"
  startIcon={<FacebookIcon />}
  onClick={() => window.location.href = 'http://localhost:3000/api/auth/facebook'}
>
  Continue with Facebook
</Button>
```

2. **Create OAuth Callback Handler** - Add route in `App.js`:
```jsx
<Route path="/auth/callback" element={<OAuthCallback />} />
```

3. **Create OAuthCallback Component**:
```jsx
// src/frontend/src/pages/OAuthCallback.js
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      // Fetch user profile and update auth context
      login(token);
      navigate('/dashboard');
    }
  }, [searchParams, login, navigate]);

  return <div>Loading...</div>;
};
```

## Security Considerations

1. **HTTPS Required**: OAuth providers require HTTPS in production
2. **State Parameter**: Add state parameter to prevent CSRF attacks
3. **Token Security**: Store tokens securely, use HttpOnly cookies in production
4. **Validate Email**: Ensure OAuth provider email is verified
5. **Account Linking**: Handle cases where OAuth email matches existing account

## Production Deployment

For production deployment:
1. Update callback URLs to production domain
2. Enable HTTPS
3. Update CORS settings to allow OAuth redirects
4. Store secrets in secure environment variables
5. Implement proper session management

## Alternative Approach

Consider using Auth0 or Firebase Authentication for simpler implementation:
- Handles OAuth complexity
- Provides pre-built UI components
- Manages security updates
- Supports multiple providers

## Testing

1. Test account creation with new OAuth users
2. Test account linking with existing email
3. Test login flow for both providers
4. Verify token generation and validation
5. Test error scenarios (denied permissions, invalid tokens)

## Note
This feature was not implemented in the current PR due to the requirement for minimal changes and external OAuth provider setup. The above guide provides a complete roadmap for implementation when needed.
