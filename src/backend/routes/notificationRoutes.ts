/**
 * Enhanced Notification Routes
 * Provides comprehensive notification management endpoints
 */

import express from 'express';
import authMiddleware from '../middleware/auth';
import {
  getNotifications,
  markAsRead,
  getStats,
  getUnreadCount,
  deleteNotificationsEndpoint,
  deleteAllReadNotificationsEndpoint,
} from '../controllers/notificationController';
import { noCache } from '../middleware/cacheControl';
import { etagMiddleware } from '../middleware/etag';

const router = express.Router();

// All notification routes require authentication
router.use(authMiddleware);

// Get notifications with filtering and pagination
// ETag enables 304 Not Modified responses for bandwidth optimization without HTTP caching
// No Cache-Control max-age to avoid stale data
router.get('/', etagMiddleware({ weak: true }), getNotifications);

// Mark notifications as read
router.put('/read', noCache, markAsRead);

// Get notification statistics
router.get('/stats', etagMiddleware({ weak: true }), getStats);

// Get unread notification count
router.get('/unread-count', etagMiddleware({ weak: true }), getUnreadCount);

// Delete specific notifications
router.delete('/', noCache, deleteNotificationsEndpoint);

// Delete all read notifications
router.delete('/read', noCache, deleteAllReadNotificationsEndpoint);

export default router;
