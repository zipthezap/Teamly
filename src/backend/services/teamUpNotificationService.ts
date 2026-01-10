/**
 * TeamUp Notification Service
 * 
 * Handles sending notifications to users when new TeamUp opportunities
 * are created in their area based on their location and discovery radius.
 */

import prisma from '../config/database';
import { logger } from '../utils/logger';
import { shouldSendEmailNotification } from '../utils/notificationHelper';

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

    // If TeamUp has coordinates, filter by distance
    if (teamUpRequest.latitude && teamUpRequest.longitude) {
      // We need to geocode user addresses or match by city/country
      // For now, we'll match users in the same city or use a fallback approach
      const matchedUsers = users.filter(user => {
        // Match by city and country if available
        if (user.city && teamUpRequest.city) {
          if (user.city.toLowerCase() === teamUpRequest.city.toLowerCase()) {
            if (!user.country && !teamUpRequest.country) return true;
            if (user.country && teamUpRequest.country && 
                user.country.toLowerCase() === teamUpRequest.country.toLowerCase()) {
              return true;
            }
          }
        }
        return false;
      });

      return matchedUsers.map(u => u.id);
    }

    // If no coordinates, match by city/country only
    const matchedUsers = users.filter(user => {
      if (user.city && teamUpRequest.city) {
        if (user.city.toLowerCase() === teamUpRequest.city.toLowerCase()) {
          if (!user.country && !teamUpRequest.country) return true;
          if (user.country && teamUpRequest.country && 
              user.country.toLowerCase() === teamUpRequest.country.toLowerCase()) {
            return true;
          }
        }
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

    // Check notification preferences for each user
    const usersToNotify: string[] = [];
    for (const userId of userIds) {
      const shouldSend = await shouldSendEmailNotification(userId, 'nearbyTeamUps');
      if (shouldSend) {
        usersToNotify.push(userId);
      }
    }

    if (usersToNotify.length === 0) {
      logger.info('No users with enabled notifications for nearby TeamUps', 'TeamUpNotificationService', {
        teamUpRequestId: teamUpRequest.id
      });
      return;
    }

    // Get user details for email notifications
    const users = await prisma.user.findMany({
      where: { id: { in: usersToNotify } },
      select: {
        id: true,
        name: true,
        email: true,
      }
    });

    // Create in-app notifications
    const notifications = usersToNotify.map(userId => ({
      userId,
      teamUpRequestId: teamUpRequest.id,
      type: 'teamup_nearby',
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
