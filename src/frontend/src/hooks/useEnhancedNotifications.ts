/**
 * Enhanced Notifications Hook
 * Provides comprehensive notification management with filtering, search, and auto-refresh
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

export interface NotificationMetadata {
  actionUrl?: string;
  actionText?: string;
  category?: 'event' | 'group' | 'system' | 'social';
  priority?: 'low' | 'medium' | 'high';
  imageUrl?: string;
  relatedUserId?: string;
  relatedUserName?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  notificationType: 'event' | 'group';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: NotificationMetadata;
  params?: Record<string, any>; // Parameters for translation
  event?: {
    id: string;
    title: string;
  };
  group?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    name: string;
  };
}

export interface NotificationFilters {
  includeRead?: boolean;
  type?: string;
  notificationType?: 'event' | 'group';
  startDate?: string;
  endDate?: string;
}

export interface NotificationStats {
  unread: number;
  unreadEvent: number;
  unreadGroup: number;
  total: number;
  totalEvent: number;
  totalGroup: number;
  last7Days: number;
  typeCounts: Record<string, number>;
}

interface UseEnhancedNotificationsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  initialFilters?: NotificationFilters;
}

export const useEnhancedNotifications = (options: UseEnhancedNotificationsOptions = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds default
    initialFilters = { includeRead: false },
  } = options;

  const { t } = useTranslation();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<NotificationFilters>(initialFilters);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (resetOffset = false) => {
      setLoading(true);
      setError(null);
      try {
        const currentOffset = resetOffset ? 0 : offset;
        const response = await notificationsAPI.getAll({
          ...filters,
          limit,
          offset: currentOffset,
        });
        // Map notifications to add translated message
        const mappedNotifications = response.data.notifications.map((notif: Notification) => ({
          ...notif,
          message: t(`notifications.${notif.type}`, notif.params || {}),
        }));
        if (resetOffset) {
          setNotifications(mappedNotifications);
          setOffset(0);
        } else {
          setNotifications((prev) =>
            currentOffset === 0 ? mappedNotifications : [...prev, ...mappedNotifications]
          );
        }
        setHasMore(response.data.hasMore);
        setTotal(response.data.total);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch notifications');
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    },
    [filters, offset, t]
  );

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await notificationsAPI.getStats();
      setStats(response.data);
    } catch (err: any) {
      console.error('Failed to fetch notification stats:', err);
    }
  }, []);

  // Mark notifications as read
  const markAsRead = useCallback(
    async (notificationIds?: string[]) => {
      try {
        await notificationsAPI.markAsRead(notificationIds);
        // Update local state
        if (notificationIds) {
          setNotifications((prev) =>
            prev.map((n) => (notificationIds.includes(n.id) ? { ...n, read: true } : n))
          );
        } else {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }
        // Refresh stats
        await fetchStats();
      } catch (err: any) {
        console.error('Failed to mark notifications as read:', err);
        throw err;
      }
    },
    [fetchStats]
  );

  // Load more notifications (pagination)
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setOffset((prev) => prev + limit);
    }
  }, [loading, hasMore]);

  // Refresh (reload from start)
  const refresh = useCallback(() => {
    fetchNotifications(true);
    fetchStats();
  }, [fetchNotifications, fetchStats]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<NotificationFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setOffset(0);
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
    setOffset(0);
  }, [initialFilters]);

  // Initial load
  useEffect(() => {
    fetchNotifications(true);
    fetchStats();
  }, [filters, fetchNotifications, fetchStats]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchStats(); // Refresh stats to update badge counts
        // Only refresh notifications if we're viewing unread ones
        if (!filters.includeRead) {
          fetchNotifications(true);
        }
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, filters.includeRead, fetchNotifications, fetchStats]);

  // Load more when offset changes
  useEffect(() => {
    if (offset > 0) {
      fetchNotifications(false);
    }
  }, [offset, fetchNotifications]);

  return {
    notifications,
    stats,
    loading,
    error,
    filters,
    hasMore,
    total,
    markAsRead,
    loadMore,
    refresh,
    updateFilters,
    clearFilters,
  };
};

// Simple hook for just getting unread count (for badges)
export const useUnreadCount = () => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationsAPI.getUnreadCount();
      setCount(response.data.count);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return { count, loading, refresh: fetchCount };
};
