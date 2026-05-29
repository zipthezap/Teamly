import { Router } from 'express';
import passport from '../../config/passport';

import {
  deleteAccount,
  deleteProfilePicture,
  getDashboard,
  getOAuthStatus,
  getProfile,
  getSessions,
  hardDeleteProfilePicture,
  listProfilePictures,
  login,
  logout,
  logoutAll,
  mobileAppleLogin,
  mobileFacebookLogin,
  mobileGoogleLogin,
  oauthCallback,
  refreshToken,
  register,
  requestPasswordReset,
  resendVerificationEmail,
  resetPassword,
  restoreProfilePicture,
  syncOAuthProfilePicture,
  unlinkOAuthAccount,
  updatePassword,
  updateProfile,
  uploadProfilePicture,
  verifyEmail,
} from '../../controllers/authController';
import { uploadProfilePicture as uploadProfilePictureMiddleware } from '../../middleware/upload';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireHeaderAuth } from '../internalAuth';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/refresh-token', asyncHandler(refreshToken));
router.post('/verify-email', asyncHandler(verifyEmail));
router.post('/resend-verification', asyncHandler(resendVerificationEmail));

router.get('/google', (req, res, next) => {
  const inviteGroupId = req.query.inviteGroupId as string | undefined;
  if (inviteGroupId && req.session) {
    req.session.inviteGroupId = inviteGroupId;
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login?error=google_auth_failed`,
  }),
  asyncHandler(oauthCallback)
);

router.get('/facebook', (req, res, next) => {
  const inviteGroupId = req.query.inviteGroupId as string | undefined;
  if (inviteGroupId && req.session) {
    req.session.inviteGroupId = inviteGroupId;
  }
  passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
});

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login?error=facebook_auth_failed`,
  }),
  asyncHandler(oauthCallback)
);

router.post('/google/mobile', asyncHandler(mobileGoogleLogin));
router.post('/facebook/mobile', asyncHandler(mobileFacebookLogin));
router.post('/apple/mobile', asyncHandler(mobileAppleLogin));
router.post('/forgot-password', asyncHandler(requestPasswordReset));
router.post('/reset-password', asyncHandler(resetPassword));

router.post('/logout', requireHeaderAuth, asyncHandler(logout));
router.post('/logout-all', requireHeaderAuth, asyncHandler(logoutAll));
router.get('/me/dashboard', requireHeaderAuth, asyncHandler(getDashboard));
router.get('/profile', requireHeaderAuth, asyncHandler(getProfile));
router.put('/profile', requireHeaderAuth, asyncHandler(updateProfile));
router.post(
  '/profile/picture',
  requireHeaderAuth,
  uploadProfilePictureMiddleware,
  asyncHandler(uploadProfilePicture)
);
router.put('/password', requireHeaderAuth, asyncHandler(updatePassword));
router.delete('/profile/picture', requireHeaderAuth, asyncHandler(deleteProfilePicture));
router.get('/profile/pictures', requireHeaderAuth, asyncHandler(listProfilePictures));
router.post('/profile/picture/restore', requireHeaderAuth, asyncHandler(restoreProfilePicture));
router.post('/profile/picture/hard-delete', requireHeaderAuth, asyncHandler(hardDeleteProfilePicture));
router.get('/sessions', requireHeaderAuth, asyncHandler(getSessions));
router.get('/oauth/status', requireHeaderAuth, asyncHandler(getOAuthStatus));
router.post('/oauth/unlink', requireHeaderAuth, asyncHandler(unlinkOAuthAccount));
router.post('/oauth/sync-picture', requireHeaderAuth, asyncHandler(syncOAuthProfilePicture));
router.delete('/account', requireHeaderAuth, asyncHandler(deleteAccount));

export default router;
