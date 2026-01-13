import { useState, useEffect } from 'react';
import { groupChatAPI } from '../services/api';

interface Notification {
  [key: string]: unknown;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  loading: boolean;
  refresh: () => Promise<void>;
  markAsRead: () => Promise<void>;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await groupChatAPI.getNotifications();
      // Sort and group notifications by type for display
      setNotifications(res.data || []);
    } catch (_e) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };
  
  const markAsRead = async () => {
    try {
      await groupChatAPI.markNotificationsRead();
      // Refresh notifications after marking as read
      fetchNotifications();
    } catch (e) {
      console.error('Failed to mark notifications as read:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return { notifications, loading, refresh: fetchNotifications, markAsRead };
};
