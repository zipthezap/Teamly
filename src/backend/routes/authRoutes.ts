import { Router } from 'express';
import * as authController from '../controllers/authController';
import authMiddleware from '../middleware/auth';
import { distributedAuthLimiter, distributedUploadLimiter, distributedPasswordResetLimiter, distributedEmailVerificationLimiter } from '../middleware/distributedRateLimiter';
import { uploadProfilePicture } from '../middleware/upload';
import { asyncHandler } from '../middleware/asyncHandler';
import passport from '../config/passport';

// Extend session type to include inviteGroupId
declare module 'express-session' {
  interface SessionData {
    inviteGroupId?: string;
  }
}

const router = Router();

// Apply strict rate limiting to auth endpoints
router.post('/register', distributedAuthLimiter, asyncHandler(authController.register));
router.post('/login', distributedAuthLimiter, asyncHandler(authController.login));
router.post('/logout', authMiddleware, asyncHandler(authController.logout));
router.post('/logout-all', authMiddleware, asyncHandler(authController.logoutAll));
router.post('/refresh-token', distributedAuthLimiter, asyncHandler(authController.refreshToken));

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
  asyncHandler(authController.oauthCallback)
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
  asyncHandler(authController.oauthCallback)
);

// Email verification
router.post('/verify-email', distributedEmailVerificationLimiter, asyncHandler(authController.verifyEmail));
router.post('/resend-verification', distributedEmailVerificationLimiter, asyncHandler(authController.resendVerificationEmail));

// Profile management
router.get('/profile', authMiddleware, asyncHandler(authController.getProfile));
router.put('/profile', authMiddleware, asyncHandler(authController.updateProfile));
router.put('/password', authMiddleware, asyncHandler(authController.updatePassword));

// Profile picture management

// Profile picture management (history, soft delete, restore, hard delete)
router.post(
  '/profile/picture',
  authMiddleware,
  distributedUploadLimiter,
  uploadProfilePicture,
  asyncHandler(authController.uploadProfilePicture)
);
router.delete('/profile/picture', authMiddleware, asyncHandler(authController.deleteProfilePicture));
router.get('/profile/pictures', authMiddleware, asyncHandler(authController.listProfilePictures));
router.post('/profile/picture/restore', authMiddleware, asyncHandler(authController.restoreProfilePicture));
router.post('/profile/picture/hard-delete', authMiddleware, asyncHandler(authController.hardDeleteProfilePicture));

// Session management
router.get('/sessions', authMiddleware, asyncHandler(authController.getSessions));

// OAuth account management
router.get('/oauth/status', authMiddleware, asyncHandler(authController.getOAuthStatus));
router.post('/oauth/unlink', authMiddleware, asyncHandler(authController.unlinkOAuthAccount));
router.post('/oauth/sync-picture', authMiddleware, asyncHandler(authController.syncOAuthProfilePicture));

// Password reset routes (with rate limiting)
router.post('/forgot-password', distributedPasswordResetLimiter, asyncHandler(authController.requestPasswordReset));
router.post('/reset-password', distributedPasswordResetLimiter, asyncHandler(authController.resetPassword));

export default router;
