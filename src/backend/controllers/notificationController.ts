/**
 * Enhanced Notification Controller
 * Provides comprehensive notification management endpoints
 */

import { Request, Response } from 'express';
import {
  getUserNotifications,
  markNotificationsAsRead,
  getNotificationStats,
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

    const result = await getUserNotifications(userId, options);

    res.json({
      notifications: result.notifications,
      total: result.total,
      limit: parsedLimit,
      offset: parsedOffset,
      hasMore: result.total > parsedOffset + parsedLimit,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
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
    console.error('Mark as read error:', error);
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
    console.error('Get notification stats error:', error);
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
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};
