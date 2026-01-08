/**
 * Enhanced Notification Controller
 * Provides comprehensive notification management endpoints
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  getUserNotifications,
  markNotificationsAsRead,
  getNotificationStats,
  deleteNotifications,
  deleteAllReadNotifications,
} from '../services/notificationService';

/**
 * Get user notifications with filtering and pagination
 * GET /api/notifications
 * Query params:
 *  - includeRead: boolean (default: false)
 *  - limit: number (default: 50, max: 100)
 *  - offset: number (default: 0)
 *  - type: string (e.g., 'join', 'leave', 'created')
 *  - notificationType: 'event' | 'group'
 *  - startDate: ISO date string
 *  - endDate: ISO date string
 *  - searchQuery: string (searches in title and message)
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const {
      includeRead = 'false',
      limit = '50',
      offset = '0',
      type,
      notificationType,
      startDate,
      endDate,
      searchQuery,
    } = req.query;

    // Parse and validate parameters
    const parsedLimit = Math.min(parseInt(limit as string, 10) || 50, 100);
    const parsedOffset = parseInt(offset as string, 10) || 0;
    const parsedIncludeRead = includeRead === 'true';

    const options: any = {
      includeRead: parsedIncludeRead,
      limit: parsedLimit,
      offset: parsedOffset,
    };

    if (type) {
      options.type = type as string;
    }

    if (notificationType === 'event' || notificationType === 'group') {
      options.notificationType = notificationType;
    }

    if (startDate) {
      options.startDate = new Date(startDate as string);
    }

    if (endDate) {
      options.endDate = new Date(endDate as string);
    }

    if (searchQuery) {
      options.searchQuery = searchQuery as string;
    }

    const result = await getUserNotifications(userId, options);

    res.json({
      notifications: result.notifications,
      total: result.total,
      limit: parsedLimit,
      offset: parsedOffset,
      hasMore: result.total > parsedOffset + parsedLimit,
    });
  } catch (error) {
    logger.error('Failed to fetch notifications', 'NotificationController', { error });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * Mark notifications as read
 * PUT /api/notifications/read
 * Body: { notificationIds?: string[] } - if not provided, marks all as read
 */
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { notificationIds } = req.body;

    await markNotificationsAsRead(userId, notificationIds);

    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    logger.error('Failed to mark notifications as read', 'NotificationController', { error });
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

/**
 * Get notification statistics
 * GET /api/notifications/stats
 */
export const getStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const stats = await getNotificationStats(userId);

    res.json(stats);
  } catch (error) {
    logger.error('Failed to fetch notification statistics', 'NotificationController', { error });
    res.status(500).json({ error: 'Failed to fetch notification statistics' });
  }
};

/**
 * Get unread notification count (quick endpoint for badges)
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const stats = await getNotificationStats(userId);

    res.json({
      count: stats.unread,
      eventCount: stats.unreadEvent,
      groupCount: stats.unreadGroup,
    });
  } catch (error) {
    logger.error('Failed to fetch unread count', 'NotificationController', { error });
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

/**
 * Delete specific notifications
 * DELETE /api/notifications
 * Body: { notificationIds: string[] }
 */
export const deleteNotificationsEndpoint = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { notificationIds } = req.body;

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ error: 'notificationIds array is required' });
    }

    const result = await deleteNotifications(userId, notificationIds);

    res.json({
      message: 'Notifications deleted successfully',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    logger.error('Failed to delete notifications', 'NotificationController', { error });
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
};

/**
 * Delete all read notifications
 * DELETE /api/notifications/read
 */
export const deleteAllReadNotificationsEndpoint = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const result = await deleteAllReadNotifications(userId);

    res.json({
      message: 'All read notifications deleted successfully',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    logger.error('Failed to delete all read notifications', 'NotificationController', { error });
    res.status(500).json({ error: 'Failed to delete all read notifications' });
  }
};
