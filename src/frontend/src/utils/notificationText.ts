import type { TFunction } from 'i18next';

export interface NotificationTextSource {
  type?: string;
  params?: Record<string, unknown> | null;
  title?: string;
  message?: string;
}

const DEFAULT_TITLE = 'Notification';
const DEFAULT_MESSAGE = 'No details available';

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const getNotificationText = (t: TFunction, notif: NotificationTextSource) => {
  const existingTitle = toNonEmptyString(notif.title);
  const existingMessage = toNonEmptyString(notif.message);

  if (existingTitle && existingMessage) {
    return { title: existingTitle, message: existingMessage };
  }

  const rawType = typeof notif.type === 'string' ? notif.type.trim() : '';
  const typeKey = rawType ? `notifications.${rawType}` : 'notifications.title';
  const messageKey = rawType ? `notifications.${rawType}Message` : 'notifications.noNotifications';
  const translationParams = (notif.params || {}) as Record<string, unknown>;

  return {
    title: existingTitle ?? String(t(typeKey, { ...translationParams, defaultValue: DEFAULT_TITLE })),
    message: existingMessage ?? String(t(messageKey, { ...translationParams, defaultValue: DEFAULT_MESSAGE })),
  };
};
