import { Router } from 'express';
import * as twoFactorController from '../controllers/twoFactorController';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Get 2FA status
router.get('/status', asyncHandler(twoFactorController.get2FAStatus));

// Setup 2FA (generate secret and QR code)
router.post('/setup', asyncHandler(twoFactorController.setup2FA));

// Verify and enable 2FA
router.post('/verify', asyncHandler(twoFactorController.verify2FA));

// Disable 2FA
router.post('/disable', asyncHandler(twoFactorController.disable2FA));

export default router;
