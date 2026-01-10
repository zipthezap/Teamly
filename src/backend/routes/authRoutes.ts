import { Router } from 'express';
import * as authController from '../controllers/authController';
import authMiddleware from '../middleware/auth';
import { authLimiter, uploadLimiter } from '../middleware/rateLimiter';
import { uploadProfilePicture } from '../middleware/upload';

const router = Router();

// Apply strict rate limiting to auth endpoints
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);
router.post('/refresh-token', authLimiter, authController.refreshToken);

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

// Password reset routes (with rate limiting)
router.post('/forgot-password', authLimiter, authController.requestPasswordReset);
router.post('/reset-password', authLimiter, authController.resetPassword);

export default router;
