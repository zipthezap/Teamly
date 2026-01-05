import { useState, useEffect } from 'react';
import { groupChatAPI } from '../services/api';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await groupChatAPI.getNotifications();
      // Sort and group notifications by type for display
      setNotifications(res.data || []);
    } catch (e) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return { notifications, loading, refresh: fetchNotifications };
};
