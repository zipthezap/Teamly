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

const router = express.Router();

// All notification routes require authentication
router.use(authMiddleware);

// Get notifications with filtering and pagination
router.get('/', getNotifications);

// Mark notifications as read
router.put('/read', markAsRead);

// Get notification statistics
router.get('/stats', getStats);

// Get unread notification count
router.get('/unread-count', getUnreadCount);

// Delete specific notifications
router.delete('/', deleteNotificationsEndpoint);

// Delete all read notifications
router.delete('/read', deleteAllReadNotificationsEndpoint);

export default router;
