import { Router } from 'express';
import * as authController from '../controllers/authController';
import authMiddleware from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

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

// Session management
router.get('/sessions', authMiddleware, authController.getSessions);

// Password reset routes (with rate limiting)
router.post('/forgot-password', authLimiter, authController.requestPasswordReset);
router.post('/reset-password', authLimiter, authController.resetPassword);

export default router;
