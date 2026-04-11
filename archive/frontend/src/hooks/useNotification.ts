/**
 * Unified Notification Hook
 * Provides consistent notification/toast management across the application
 */

import { useState, useCallback } from 'react';

export type NotificationSeverity = 'success' | 'error' | 'info' | 'warning';

export interface NotificationState {
  message: string;
  severity: NotificationSeverity;
  open: boolean;
}

export const useNotification = () => {
  const [notification, setNotification] = useState<NotificationState>({
    message: '',
    severity: 'info',
    open: false,
  });

  const showNotification = useCallback((message: string, severity: NotificationSeverity = 'info') => {
    setNotification({ message, severity, open: true });
  }, []);

  const showSuccess = useCallback((message: string) => {
    showNotification(message, 'success');
  }, [showNotification]);

  const showError = useCallback((message: string) => {
    showNotification(message, 'error');
  }, [showNotification]);

  const showInfo = useCallback((message: string) => {
    showNotification(message, 'info');
  }, [showNotification]);

  const showWarning = useCallback((message: string) => {
    showNotification(message, 'warning');
  }, [showNotification]);

  const hideNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, open: false }));
  }, []);

  return {
    notification,
    showNotification,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    hideNotification,
  };
};
