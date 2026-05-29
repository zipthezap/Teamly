import { Router } from 'express';
import * as authProxyController from '../controllers/proxies/authProxyController';
import authMiddleware from '../middleware/auth';
import { distributedAuthLimiter, distributedUploadLimiter, distributedPasswordResetLimiter, distributedEmailVerificationLimiter } from '../middleware/distributedRateLimiter';
import { authenticatedLimiter, authLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// Apply strict rate limiting to auth endpoints
router.post('/register', distributedAuthLimiter, noCache, asyncHandler(authProxyController.register));
router.post('/login', distributedAuthLimiter, noCache, asyncHandler(authProxyController.login));
router.post('/logout', authMiddleware, noCache, asyncHandler(authProxyController.logout));
router.post('/logout-all', authMiddleware, noCache, asyncHandler(authProxyController.logoutAll));
router.post('/refresh-token', distributedAuthLimiter, noCache, asyncHandler(authProxyController.refreshToken));

// OAuth routes
// Google OAuth
router.get('/google', asyncHandler(authProxyController.startGoogleOAuth));
router.get('/google/callback', asyncHandler(authProxyController.handleGoogleOAuthCallback));

// Facebook OAuth
router.get('/facebook', asyncHandler(authProxyController.startFacebookOAuth));
router.get('/facebook/callback', asyncHandler(authProxyController.handleFacebookOAuthCallback));

// Email verification
router.post('/verify-email', distributedEmailVerificationLimiter, noCache, asyncHandler(authProxyController.verifyEmail));
router.post('/resend-verification', distributedEmailVerificationLimiter, noCache, asyncHandler(authProxyController.resendVerificationEmail));

// Mobile OAuth token exchange (native SDK tokens → server JWT)
router.post('/google/mobile', authLimiter, distributedAuthLimiter, noCache, asyncHandler(authProxyController.mobileGoogleLogin));
router.post('/facebook/mobile', authLimiter, distributedAuthLimiter, noCache, asyncHandler(authProxyController.mobileFacebookLogin));
router.post('/apple/mobile', authLimiter, distributedAuthLimiter, noCache, asyncHandler(authProxyController.mobileAppleLogin));

// Dashboard aggregate endpoint – single round-trip for mobile home screen
router.get('/me/dashboard', authMiddleware, authenticatedLimiter, etagMiddleware({ weak: true }), asyncHandler(authProxyController.getDashboard));

// Profile management
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/profile', authMiddleware, etagMiddleware({ weak: true }), asyncHandler(authProxyController.getProfile));
router.put('/profile', authMiddleware, noCache, asyncHandler(authProxyController.updateProfile));
router.put('/password', authMiddleware, noCache, asyncHandler(authProxyController.updatePassword));

// Profile picture management

// Profile picture management (history, soft delete, restore, hard delete)
router.post(
  '/profile/picture',
  authMiddleware,
  distributedUploadLimiter,
  noCache,
  asyncHandler(authProxyController.uploadProfilePicture)
);
router.delete('/profile/picture', authMiddleware, noCache, asyncHandler(authProxyController.deleteProfilePicture));
router.get('/profile/pictures', authMiddleware, etagMiddleware({ weak: true }), asyncHandler(authProxyController.listProfilePictures));
router.post('/profile/picture/restore', authMiddleware, noCache, asyncHandler(authProxyController.restoreProfilePicture));
router.post('/profile/picture/hard-delete', authMiddleware, noCache, asyncHandler(authProxyController.hardDeleteProfilePicture));

// Session management
router.get('/sessions', authMiddleware, etagMiddleware({ weak: true }), asyncHandler(authProxyController.getSessions));

// OAuth account management
router.get('/oauth/status', authMiddleware, etagMiddleware({ weak: true }), asyncHandler(authProxyController.getOAuthStatus));
router.post('/oauth/unlink', authMiddleware, noCache, asyncHandler(authProxyController.unlinkOAuthAccount));
router.post('/oauth/sync-picture', authMiddleware, noCache, asyncHandler(authProxyController.syncOAuthProfilePicture));

// Password reset routes (with rate limiting)
router.post('/forgot-password', distributedPasswordResetLimiter, noCache, asyncHandler(authProxyController.requestPasswordReset));
router.post('/reset-password', distributedPasswordResetLimiter, noCache, asyncHandler(authProxyController.resetPassword));

// Account deletion (authenticated, rate-limited)
router.delete('/account', authMiddleware, authenticatedLimiter, distributedAuthLimiter, noCache, asyncHandler(authProxyController.deleteAccount));

export default router;
