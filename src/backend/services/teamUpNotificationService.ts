/**
 * TeamUp Notification Service
 * 
 * Handles sending notifications to users when new TeamUp opportunities
 * are created in their area based on their location and discovery radius.
 */

import prisma from '../config/database';
import { logger } from '../utils/logger';
import { batchShouldSendEmailNotification, filterUnmutedUsers } from '../utils/notificationHelper';
import { TeamUpNotificationType } from '../../shared/types/event.types';
import { dispatchPushNotifications } from './pushNotificationService';
import { normalizeLocationToken } from './teamUpService';

interface TeamUpRequest {
  id: string;
  title: string;
  sportType: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country: string | null;
  dateTime: Date;
  creatorId: string;
}

const DEFAULT_DISCOVERY_RADIUS = 25; // km
const COUNTRY_LEVEL_MIN_RADIUS = 100; // km - minimum radius to match country-level TeamUp requests

/**
 * Find users who should be notified about a new TeamUp request
 * based on their location preferences and discovery radius
 */
export async function findUsersForTeamUpNotification(
  teamUpRequest: TeamUpRequest
): Promise<string[]> {
  try {
    // Get users who have location data and discovery radius set
    // and are not the creator of the TeamUp request
    const users = await prisma.user.findMany({
      where: {
        id: { not: teamUpRequest.creatorId },
        emailNotifications: true,
        // Only users who have some location data
        OR: [
          { city: { not: null } },
          { address: { not: null } },
        ]
      },
      select: {
        id: true,
        city: true,
        country: true,
        discoveryRadius: true,
      }
    });

    // Match users based on location
    // Since users don't have coordinates, we match by city/country
    // In the future, this could be enhanced with geocoding
      const requestCity = normalizeLocationToken(teamUpRequest.city);
      const requestCountry = normalizeLocationToken(teamUpRequest.country);

      const matchedUsers = users.filter(user => {
        // Use user's discovery radius if set, otherwise use default (25km)
        // For city-based matching, we treat same city as "within radius"
        const userRadius = user.discoveryRadius || DEFAULT_DISCOVERY_RADIUS;

        const userCity = normalizeLocationToken(user.city);
        const userCountry = normalizeLocationToken(user.country);

        if (userCity && requestCity) {
          const cityMatch = userCity === requestCity;

          // If in same city, consider it within radius
          if (cityMatch) {
            // Also check country if both are available
            if (userCountry && requestCountry) {
              return userCountry === requestCountry;
            }
            // If no country specified for one or both, accept city match
            return true;
          }
        }

        // If only country matches (different cities), only notify if they have
        // a large discovery radius (e.g., >= COUNTRY_LEVEL_MIN_RADIUS)
        if (userCountry && requestCountry &&
            userCountry === requestCountry &&
            userRadius >= COUNTRY_LEVEL_MIN_RADIUS) {
          return true;
        }

        return false;
      });

    return matchedUsers.map(u => u.id);
  } catch (error) {
    logger.error('Error finding users for TeamUp notification', 'TeamUpNotificationService', { error });
    return [];
  }
}

/**
 * Send notifications to users about a new TeamUp request in their area
 */
export async function notifyUsersAboutNewTeamUp(
  teamUpRequest: TeamUpRequest
): Promise<void> {
  try {
    // Find users who should be notified
    const userIds = await findUsersForTeamUpNotification(teamUpRequest);

    if (userIds.length === 0) {
      logger.info('No users to notify for TeamUp request', 'TeamUpNotificationService', {
        teamUpRequestId: teamUpRequest.id
      });
      return;
    }

    // Check notification preferences in batch (avoids N+1 queries)
    const notifyMap = await batchShouldSendEmailNotification(userIds, 'nearbyTeamUps');
    const usersToNotify = userIds.filter(userId => notifyMap.get(userId));

    if (usersToNotify.length === 0) {
      logger.info('No users with enabled notifications for nearby TeamUps', 'TeamUpNotificationService', {
        teamUpRequestId: teamUpRequest.id
      });
      return;
    }

    // Filter out users who have muted nearby TeamUp notifications
    const unmutedUsers = await filterUnmutedUsers(usersToNotify, 'muteNearbyTeamUps');
    
    if (unmutedUsers.length === 0) {
      logger.info('All users have muted nearby TeamUp notifications', 'TeamUpNotificationService', {
        teamUpRequestId: teamUpRequest.id
      });
      return;
    }

    // Get user details for email notifications
    const users = await prisma.user.findMany({
      where: { id: { in: unmutedUsers } },
      select: {
        id: true,
        name: true,
        email: true,
      }
    });

    // Create in-app notifications
    const notifications = unmutedUsers.map(userId => ({
      userId,
      teamUpRequestId: teamUpRequest.id,
      type: TeamUpNotificationType.teamup_nearby,
      params: {
        title: teamUpRequest.title,
        sportType: teamUpRequest.sportType,
        location: teamUpRequest.location || teamUpRequest.city || 'your area',
      },
      metadata: {
        teamUpRequestId: teamUpRequest.id,
        dateTime: teamUpRequest.dateTime,
      },
    }));

    await prisma.teamUpNotification.createMany({
      data: notifications,
      skipDuplicates: true,
    });

    await dispatchPushNotifications({
      userIds: unmutedUsers,
      notificationKind: 'teamup',
      notificationType: TeamUpNotificationType.teamup_nearby,
      entityId: teamUpRequest.id,
      params: {
        title: teamUpRequest.title,
        sportType: teamUpRequest.sportType,
      },
      metadata: {
        actionUrl: `/teamup/${teamUpRequest.id}`,
      },
    });

    // Queue email notifications
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const emailPromises = users.map(user => {
      const emailHtml = `
        <h2>New TeamUp Opportunity in Your Area! ⚽</h2>
        <p>Hi ${user.name},</p>
        <p>A new TeamUp opportunity has been posted in your area:</p>
        <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #3b82f6;">
          <h3 style="margin-top: 0; color: #1e40af;">${teamUpRequest.title}</h3>
          <p><strong>Sport:</strong> ${teamUpRequest.sportType}</p>
          <p><strong>Date:</strong> ${new Date(teamUpRequest.dateTime).toLocaleString()}</p>
          ${teamUpRequest.location ? `<p><strong>Location:</strong> ${teamUpRequest.location}</p>` : ''}
          ${teamUpRequest.city ? `<p><strong>City:</strong> ${teamUpRequest.city}</p>` : ''}
        </div>
        <p>
          <a href="${frontendUrl}/teamup" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: 600;">
            View TeamUp Request
          </a>
        </p>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">
          You received this notification because you have location-based TeamUp notifications enabled in your profile settings.
          <a href="${frontendUrl}/profile">Manage your notification preferences</a>
        </p>
      `;

      return prisma.emailQueue.create({
        data: {
          recipient: user.email,
          subject: `New TeamUp: ${teamUpRequest.title}`,
          htmlContent: emailHtml,
          templateType: 'teamup_nearby',
          status: 'pending',
          scheduledAt: new Date(),
        }
      });
    });

    await Promise.all(emailPromises);

    logger.info('Sent TeamUp notifications', 'TeamUpNotificationService', {
      teamUpRequestId: teamUpRequest.id,
      notificationCount: usersToNotify.length,
    });
  } catch (error) {
    logger.error('Error notifying users about new TeamUp', 'TeamUpNotificationService', { 
      error,
      teamUpRequestId: teamUpRequest.id 
    });
  }
}
