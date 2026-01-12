/**
 * Enhanced Notification Routes
 * Provides comprehensive notification management endpoints
 */

import express from 'express';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
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
router.get('/', asyncHandler(getNotifications));

// Mark notifications as read
router.put('/read', asyncHandler(markAsRead));

// Get notification statistics
router.get('/stats', asyncHandler(getStats));

// Get unread notification count
router.get('/unread-count', asyncHandler(getUnreadCount));

// Delete specific notifications
router.delete('/', asyncHandler(deleteNotificationsEndpoint));

// Delete all read notifications
router.delete('/read', asyncHandler(deleteAllReadNotificationsEndpoint));

export default router;
