import { Router } from 'express';
import * as authController from '../controllers/authController';
import authMiddleware from '../middleware/auth';
import { distributedAuthLimiter, distributedUploadLimiter, distributedPasswordResetLimiter, distributedEmailVerificationLimiter } from '../middleware/distributedRateLimiter';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { uploadProfilePicture } from '../middleware/upload';
import { asyncHandler } from '../middleware/asyncHandler';
import passport from '../config/passport';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

// Extend session type to include inviteGroupId
declare module 'express-session' {
  interface SessionData {
    inviteGroupId?: string;
  }
}

const router = Router();

// Apply strict rate limiting to auth endpoints
router.post('/register', distributedAuthLimiter, noCache, asyncHandler(authController.register));
router.post('/login', distributedAuthLimiter, noCache, asyncHandler(authController.login));
router.post('/logout', authMiddleware, noCache, asyncHandler(authController.logout));
router.post('/logout-all', authMiddleware, noCache, asyncHandler(authController.logoutAll));
router.post('/refresh-token', distributedAuthLimiter, noCache, asyncHandler(authController.refreshToken));

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
router.post('/verify-email', distributedEmailVerificationLimiter, noCache, asyncHandler(authController.verifyEmail));
router.post('/resend-verification', distributedEmailVerificationLimiter, noCache, asyncHandler(authController.resendVerificationEmail));

// Dashboard aggregate endpoint – single round-trip for mobile home screen
router.get('/me/dashboard', authMiddleware, authenticatedLimiter, etagMiddleware({ weak: true }), asyncHandler(authController.getDashboard));

// Profile management
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/profile', authMiddleware, etagMiddleware({ weak: true }), asyncHandler(authController.getProfile));
router.put('/profile', authMiddleware, noCache, asyncHandler(authController.updateProfile));
router.put('/password', authMiddleware, noCache, asyncHandler(authController.updatePassword));

// Profile picture management

// Profile picture management (history, soft delete, restore, hard delete)
router.post(
  '/profile/picture',
  authMiddleware,
  distributedUploadLimiter,
  uploadProfilePicture,
  noCache,
  asyncHandler(authController.uploadProfilePicture)
);
router.delete('/profile/picture', authMiddleware, noCache, asyncHandler(authController.deleteProfilePicture));
router.get('/profile/pictures', authMiddleware, etagMiddleware({ weak: true }), asyncHandler(authController.listProfilePictures));
router.post('/profile/picture/restore', authMiddleware, noCache, asyncHandler(authController.restoreProfilePicture));
router.post('/profile/picture/hard-delete', authMiddleware, noCache, asyncHandler(authController.hardDeleteProfilePicture));

// Session management
router.get('/sessions', authMiddleware, etagMiddleware({ weak: true }), asyncHandler(authController.getSessions));

// OAuth account management
router.get('/oauth/status', authMiddleware, etagMiddleware({ weak: true }), asyncHandler(authController.getOAuthStatus));
router.post('/oauth/unlink', authMiddleware, noCache, asyncHandler(authController.unlinkOAuthAccount));
router.post('/oauth/sync-picture', authMiddleware, noCache, asyncHandler(authController.syncOAuthProfilePicture));

// Password reset routes (with rate limiting)
router.post('/forgot-password', distributedPasswordResetLimiter, noCache, asyncHandler(authController.requestPasswordReset));
router.post('/reset-password', distributedPasswordResetLimiter, noCache, asyncHandler(authController.resetPassword));

export default router;
