import type { TFunction } from 'i18next';

export interface NotificationTextSource {
  type?: string;
  params?: Record<string, unknown> | null;
  title?: string;
  message?: string;
}

const FALLBACK_TITLE = 'Notification';
const FALLBACK_MESSAGE = 'No details available';
const NOTIFICATION_TYPE_PATTERN = /^[a-zA-Z0-9_]+$/;

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
  const safeType = NOTIFICATION_TYPE_PATTERN.test(rawType) ? rawType : '';
  const typeKey = safeType ? `notifications.${safeType}` : 'notifications.defaultTitle';
  const messageKey = safeType ? `notifications.${safeType}Message` : 'notifications.defaultMessage';
  const translationParams = (notif.params || {}) as Record<string, unknown>;

  return {
    title: existingTitle ?? String(t(typeKey, { ...translationParams, defaultValue: FALLBACK_TITLE })),
    message: existingMessage ?? String(t(messageKey, { ...translationParams, defaultValue: FALLBACK_MESSAGE })),
  };
};
