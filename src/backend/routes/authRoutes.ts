import { Router } from 'express';
import * as authController from '../controllers/authController';
import authMiddleware from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply strict rate limiting to auth endpoints
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/password', authMiddleware, authController.updatePassword);

// Password reset routes (with rate limiting)
router.post('/forgot-password', authLimiter, authController.requestPasswordReset);
router.post('/reset-password', authLimiter, authController.resetPassword);

export default router;
