import prisma from '../config/database';

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

    // If no preferences set, default to enabled
    if (!preferences) {
      return true;
    }

    // Check the specific notification type
    return (preferences as any)[notificationType] !== false;
  } catch (error) {
    console.error('Error checking email notification preference:', error);
    return false;
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
      if (!user || !user.emailNotifications) {
        result.set(userId, false);
        continue;
      }

      const userPrefs = preferencesMap.get(userId);
      
      // If no preferences set, default to enabled
      if (!userPrefs) {
        result.set(userId, true);
        continue;
      }

      // Check the specific notification type
      result.set(userId, (userPrefs as any)[notificationType] !== false);
    }

    return result;
  } catch (error) {
    console.error('Error batch checking email notification preferences:', error);
    return new Map();
  }
};
