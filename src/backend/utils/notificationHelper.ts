import prisma from '../config/database';
import { logger } from './logger';
import { EmailPreference } from '../../shared/types/email.types';

/**
 * Type guard to safely check boolean properties on preferences
 */
const getPreferenceValue = (preferences: EmailPreference | null, field: string): boolean => {
  if (!preferences) return true; // Default to enabled if no preferences
  const value = preferences[field as keyof EmailPreference];
  return typeof value === 'boolean' ? value : true;
};

/**
 * Check if a user should receive a specific type of email notification
 * @param {string} userId - The user ID
 * @param {string} notificationType - The type of notification (eventInvites, eventUpdates, etc.)
 * @returns {Promise<boolean>} - Whether the user should receive the notification
 */
export const shouldSendEmailNotification = async (userId: string, notificationType: string): Promise<boolean> => {
  try {
    // Get user's global email notification setting
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailNotifications: true }
    });

    // If global notifications are disabled, don't send
    if (!user || !user.emailNotifications) {
      return false;
    }

    // Check specific notification preference
    const preferences = await prisma.emailPreference.findUnique({
      where: { userId }
    });

    // Check the specific notification type using type-safe helper
    return getPreferenceValue(preferences, notificationType) !== false;
  } catch (error) {
    logger.error('Error checking email notification preference', 'NotificationHelper', { 
      userId, 
      notificationType, 
      error 
    });
    return false;
  }
};

/**
 * Check if a user has muted a specific type of in-app notification
 * @param {string} userId - The user ID
 * @param {string} muteField - The mute field name (muteEventInvites, muteEventUpdates, etc.)
 * @returns {Promise<boolean>} - Whether the notification type is muted
 */
export const isNotificationMuted = async (userId: string, muteField: string): Promise<boolean> => {
  try {
    const preferences = await prisma.emailPreference.findUnique({
      where: { userId }
    });

    // If no preferences set, default to not muted
    if (!preferences) {
      return false;
    }

    // Check if the specific notification type is muted using type-safe helper
    const value = preferences[muteField as keyof EmailPreference];
    return typeof value === 'boolean' ? value : false;
  } catch (error) {
    logger.error('Error checking notification mute status', 'NotificationHelper', { 
      userId, 
      muteField, 
      error 
    });
    return false;
  }
};

/**
 * Batch check if multiple users have muted a specific type of in-app notification
 * @param {string[]} userIds - Array of user IDs
 * @param {string} muteField - The mute field name (muteEventInvites, muteEventUpdates, etc.)
 * @returns {Promise<Map<string, boolean>>} - Map of userId to boolean indicating if notification is muted
 */
export const batchIsNotificationMuted = async (userIds: string[], muteField: string): Promise<Map<string, boolean>> => {
  try {
    const preferences = await prisma.emailPreference.findMany({
      where: { userId: { in: userIds } }
    });
    const preferencesMap = new Map(preferences.map(p => [p.userId, p]));

    const result = new Map();
    for (const userId of userIds) {
      const userPrefs = preferencesMap.get(userId);
      
      // If no preferences set, default to not muted
      if (!userPrefs) {
        result.set(userId, false);
        continue;
      }

      // Check if the notification type is muted using type-safe access
      const value = userPrefs[muteField as keyof EmailPreference];
      result.set(userId, typeof value === 'boolean' ? value : false);
    }

    return result;
  } catch (error) {
    logger.error('Error batch checking notification mute status', 'NotificationHelper', { 
      muteField, 
      userCount: userIds.length, 
      error 
    });
    return new Map();
  }
};

/**
 * Filter out users who have muted a specific type of in-app notification
 * @param {string[]} userIds - Array of user IDs
 * @param {string} muteField - The mute field name (muteEventInvites, muteEventUpdates, etc.)
 * @returns {Promise<string[]>} - Array of user IDs who have not muted this notification type
 */
export const filterUnmutedUsers = async (userIds: string[], muteField: string): Promise<string[]> => {
  try {
    const muteMap = await batchIsNotificationMuted(userIds, muteField);
    return userIds.filter(userId => !muteMap.get(userId));
  } catch (error) {
    logger.error('Error filtering unmuted users', 'NotificationHelper', { 
      muteField, 
      userCount: userIds.length, 
      error 
    });
    return userIds; // In case of error, don't filter out any users
  }
};

/**
 * Batch check if multiple users should receive a specific type of email notification
 * @param {string[]} userIds - Array of user IDs
 * @param {string} notificationType - The type of notification
 * @returns {Promise<Map<string, boolean>>} - Map of userId to boolean indicating if they should receive notification
 */
export const batchShouldSendEmailNotification = async (userIds: string[], notificationType: string): Promise<Map<string, boolean>> => {
  try {
    // Get all users' global settings
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, emailNotifications: true }
    });
    const usersMap = new Map(users.map(u => [u.id, u]));

    // Get all preferences
    const preferences = await prisma.emailPreference.findMany({
      where: { userId: { in: userIds } }
    });
    const preferencesMap = new Map(preferences.map(p => [p.userId, p]));

    // Build result map
    const result = new Map();
    for (const userId of userIds) {
      const user = usersMap.get(userId);
      // If user doesn't exist or has notifications disabled globally, don't send
      if (!user || !(user as { emailNotifications?: boolean }).emailNotifications) {
        result.set(userId, false);
        continue;
      }

      const userPrefs = preferencesMap.get(userId);
      
      // Check the specific notification type using type-safe helper
      result.set(userId, getPreferenceValue(userPrefs || null, notificationType) !== false);
    }

    return result;
  } catch (error) {
    logger.error('Error batch checking email notification preferences', 'NotificationHelper', { 
      notificationType, 
      userCount: userIds.length, 
      error 
    });
    return new Map();
  }
};
