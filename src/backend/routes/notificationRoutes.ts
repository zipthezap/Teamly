/**
 * Enhanced Notification Routes
 * Provides comprehensive notification management endpoints
 */

import express from 'express';
import authMiddleware from '../middleware/auth';
import { authenticatedLimiter } from '../middleware/rateLimiter';
import * as notificationProxyController from '../controllers/proxies/notificationProxyController';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = express.Router();

// All notification routes require authentication
router.use(authMiddleware);
router.use(authenticatedLimiter);

// Real-time SSE stream (must come before rate limiter since SSE is long-lived)
router.get('/stream', notificationProxyController.streamNotifications);

// Get notifications with filtering and pagination
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/', etagMiddleware({ weak: true }), notificationProxyController.getNotifications);

// Mark notifications as read
router.put('/read', noCache, notificationProxyController.markAsRead);

// Get notification statistics
router.get('/stats', etagMiddleware({ weak: true }), notificationProxyController.getStats);

// Get unread notification count
router.get('/unread-count', etagMiddleware({ weak: true }), notificationProxyController.getUnreadCount);

// Delete specific notifications
router.delete('/', noCache, notificationProxyController.deleteNotificationsEndpoint);

// Delete all read notifications
router.delete('/read', noCache, notificationProxyController.deleteAllReadNotificationsEndpoint);

export default router;
