import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import prisma from './database';
import { logger } from '../utils/logger';

// Serialize user for session
passport.serializeUser((user: Express.User, done) => {
  const userId = (user as { id: string }).id;
  done(null, userId);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        emailVerified: true,
        authProvider: true
      }
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
        scope: ['profile', 'email']
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          
          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          // Check if user exists with this Google ID
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id }
          });

          if (user) {
            // User exists, log them in
            return done(null, user);
          }

          // Check if user exists with this email
          user = await prisma.user.findUnique({
            where: { email }
          });

          if (user) {
            // Link Google account to existing user
            // Preserve original authProvider if it exists, otherwise set to google
            const authProvider = user.authProvider || 'google';
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                googleId: profile.id,
                authProvider: authProvider === 'local' ? 'local' : authProvider, // Keep local if already local
                emailVerified: true, // Google emails are verified
                oauthProfilePicture: profile.photos?.[0]?.value || user.oauthProfilePicture,
                lastOAuthSync: new Date()
              }
            });
            return done(null, user);
          }

          // Create new user
          user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName || 'User',
              googleId: profile.id,
              authProvider: 'google',
              emailVerified: true, // Google emails are verified
              password: null, // No password for OAuth users
              oauthProfilePicture: profile.photos?.[0]?.value || null,
              lastOAuthSync: new Date()
            }
          });

          logger.info('New user registered via Google OAuth', 'PassportConfig', { userId: user.id });
          done(null, user);
        } catch (error) {
          logger.error('Google OAuth error', 'PassportConfig', { error });
          done(error as Error, undefined);
        }
      }
    )
  );
} else {
  logger.warn('Google OAuth not configured - missing credentials', 'PassportConfig');
}

// Facebook OAuth Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3000/api/auth/facebook/callback',
        profileFields: ['id', 'emails', 'name', 'displayName', 'picture']
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          
          if (!email) {
            return done(new Error('No email found in Facebook profile'), undefined);
          }

          // Check if user exists with this Facebook ID
          let user = await prisma.user.findUnique({
            where: { facebookId: profile.id }
          });

          if (user) {
            // User exists, log them in
            return done(null, user);
          }

          // Check if user exists with this email
          user = await prisma.user.findUnique({
            where: { email }
          });

          if (user) {
            // Link Facebook account to existing user
            // Preserve original authProvider if it exists, otherwise set to facebook
            const authProvider = user.authProvider || 'facebook';
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                facebookId: profile.id,
                authProvider: authProvider === 'local' ? 'local' : authProvider, // Keep local if already local
                emailVerified: true, // Facebook emails are verified
                oauthProfilePicture: profile.photos?.[0]?.value || user.oauthProfilePicture,
                lastOAuthSync: new Date()
              }
            });
            return done(null, user);
          }

          // Create new user
          user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() || 'User',
              facebookId: profile.id,
              authProvider: 'facebook',
              emailVerified: true, // Facebook emails are verified
              password: null, // No password for OAuth users
              oauthProfilePicture: profile.photos?.[0]?.value || null,
              lastOAuthSync: new Date()
            }
          });

          logger.info('New user registered via Facebook OAuth', 'PassportConfig', { userId: user.id });
          done(null, user);
        } catch (error) {
          logger.error('Facebook OAuth error', 'PassportConfig', { error });
          done(error as Error, undefined);
        }
      }
    )
  );
} else {
  logger.warn('Facebook OAuth not configured - missing credentials', 'PassportConfig');
}

export default passport;
