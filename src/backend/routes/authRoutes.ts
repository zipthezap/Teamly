import { Router } from 'express';
import * as authController from '../controllers/authController';
import authMiddleware from '../middleware/auth';
import { authLimiter, uploadLimiter } from '../middleware/rateLimiter';
import { uploadProfilePicture } from '../middleware/upload';
import passport from '../config/passport';

// Extend session type to include inviteGroupId
declare module 'express-session' {
  interface SessionData {
    inviteGroupId?: string;
  }
}

const router = Router();

// Apply strict rate limiting to auth endpoints
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);
router.post('/refresh-token', authLimiter, authController.refreshToken);

// OAuth routes
// Google OAuth
router.get('/google', (req, res, next) => {
  // Store invite group ID in session if provided
  const inviteGroupId = req.query.inviteGroupId as string;
  if (inviteGroupId && req.session) {
    req.session.inviteGroupId = inviteGroupId;
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get(
  '/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login?error=google_auth_failed` 
  }),
  authController.oauthCallback
);

// Facebook OAuth
router.get('/facebook', (req, res, next) => {
  // Store invite group ID in session if provided
  const inviteGroupId = req.query.inviteGroupId as string;
  if (inviteGroupId && req.session) {
    req.session.inviteGroupId = inviteGroupId;
  }
  passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
});

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login?error=facebook_auth_failed` 
  }),
  authController.oauthCallback
);

// Email verification
router.post('/verify-email', authLimiter, authController.verifyEmail);
router.post('/resend-verification', authLimiter, authController.resendVerificationEmail);

// Profile management
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/password', authMiddleware, authController.updatePassword);

// Profile picture management

// Profile picture management (history, soft delete, restore, hard delete)
router.post(
  '/profile/picture',
  authMiddleware,
  uploadLimiter,
  uploadProfilePicture,
  authController.uploadProfilePicture
);
router.delete('/profile/picture', authMiddleware, authController.deleteProfilePicture);
router.get('/profile/pictures', authMiddleware, authController.listProfilePictures);
router.post('/profile/picture/restore', authMiddleware, authController.restoreProfilePicture);
router.post('/profile/picture/hard-delete', authMiddleware, authController.hardDeleteProfilePicture);

// Session management
router.get('/sessions', authMiddleware, authController.getSessions);

// OAuth account management
router.get('/oauth/status', authMiddleware, authController.getOAuthStatus);
router.post('/oauth/unlink', authMiddleware, authController.unlinkOAuthAccount);
router.post('/oauth/sync-picture', authMiddleware, authController.syncOAuthProfilePicture);

// Password reset routes (with rate limiting)
router.post('/forgot-password', authLimiter, authController.requestPasswordReset);
router.post('/reset-password', authLimiter, authController.resetPassword);

export default router;
