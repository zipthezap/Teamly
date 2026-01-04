const express = require('express');
const router = express.Router();
const twoFactorController = require('../controllers/twoFactorController');
const authMiddleware = require('../middleware/auth');
const { authenticatedLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Get 2FA status
router.get('/status', twoFactorController.get2FAStatus);

// Setup 2FA (generate secret and QR code)
router.post('/setup', twoFactorController.setup2FA);

// Verify and enable 2FA
router.post('/verify', twoFactorController.verify2FA);

// Disable 2FA
router.post('/disable', twoFactorController.disable2FA);

module.exports = router;
