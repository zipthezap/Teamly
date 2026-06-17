import { Router } from 'express';
import * as twoFactorProxyController from '../controllers/proxies/twoFactorProxyController';
import { asyncHandler } from '../middleware/asyncHandler';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Get 2FA status
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/status', etagMiddleware({ weak: true }), asyncHandler(twoFactorProxyController.get2FAStatus));

// Setup 2FA (generate secret and QR code)
router.post('/setup', noCache, asyncHandler(twoFactorProxyController.setup2FA));

// Verify and enable 2FA
router.post('/verify', noCache, asyncHandler(twoFactorProxyController.verify2FA));

// Disable 2FA
router.post('/disable', noCache, asyncHandler(twoFactorProxyController.disable2FA));

export default router;
