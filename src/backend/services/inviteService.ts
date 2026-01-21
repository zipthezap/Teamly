/**
 * Unified Invite Service
 * Handles invitations for both events and groups with consistent patterns,
 * including email sending, validation, and notification creation.
 */

import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendEmailWithQueue } from './emailQueueService';
import { shouldSendEmailNotification } from '../utils/notificationHelper';
import { NotificationFactory } from './notificationFactory';
import { escapeHtml, isValidEmail } from '../utils/validation';
import { Prisma } from '@prisma/client';

export interface InviteEmailData {
  recipientName: string;
  recipientEmail: string;
  inviterName: string;
  resourceId: string;
  resourceName: string;
  resourceDescription?: string;
  resourceType: 'event' | 'group';
  actionUrl: string;
}

export interface BatchInviteResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

export class InviteService {
  /**
   * Send invitation email with consistent template
   */
  static async sendInvitationEmail(data: InviteEmailData): Promise<boolean> {
    const {
      recipientName,
      recipientEmail,
      inviterName,
      resourceName,
      resourceDescription,
      resourceType,
      actionUrl
    } = data;

    const htmlContent = `
      <h2>You've Been Invited!</h2>
      <p>Hi ${escapeHtml(recipientName)},</p>
      <p>${escapeHtml(inviterName)} has invited you to join ${resourceType === 'event' ? 'an event' : 'a group'}:</p>
      <h3>${escapeHtml(resourceName)}</h3>
      ${resourceDescription ? `<p>${escapeHtml(resourceDescription)}</p>` : ''}
      <p><a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">View ${resourceType === 'event' ? 'Event' : 'Group'}</a></p>
      <p>You can accept or decline this invitation from the app.</p>
    `;
    
    try {
      await sendEmailWithQueue(
        recipientEmail,
        `${resourceType === 'event' ? 'Event' : 'Group'} Invitation: ${resourceName}`,
        htmlContent,
        {
          templateType: `${resourceType}_invitation`,
          templateData: {
            recipientName,
            resourceName,
            resourceDescription,
            inviterName
          }
        }
      );
      return true;
    } catch (error) {
      logger.error('Failed to send invitation email', 'InviteService', {
        error,
        recipientEmail,
        resourceType
      });
      return false;
    }
  }

  /**
   * Invite a user to a group with all necessary side effects
   */
  static async inviteUserToGroup(
    groupId: string,
    userToInviteId: string,
    inviterId: string,
    options: {
      skipEmailCheck?: boolean;
      tx?: Prisma.TransactionClient;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    const client = options.tx || prisma;

    try {
      // Get group, inviter, and invitee in parallel
      const [group, inviter, userToInvite] = await Promise.all([
        client.group.findUnique({ where: { id: groupId } }),
        client.user.findUnique({ where: { id: inviterId } }),
        client.user.findUnique({ where: { id: userToInviteId } })
      ]);

      if (!group) {
        return { success: false, error: 'Group not found' };
      }

      if (!inviter) {
        return { success: false, error: 'Inviter not found' };
      }

      if (!userToInvite) {
        return { success: false, error: 'User to invite not found' };
      }

      // Check if user is already a member
      const existingMembership = await client.groupMember.findFirst({
        where: { groupId, userId: userToInviteId }
      });

      if (existingMembership) {
        return { success: false, error: 'User is already a member' };
      }

      // Check for existing pending invitation
      const existingInvitation = await client.groupJoinRequest.findFirst({
        where: {
          groupId,
          userId: userToInviteId,
          status: 'pending',
          createdBy: 'INVITE'
        }
      });

      if (existingInvitation) {
        return { success: false, error: 'User already has a pending invitation' };
      }

      // Create the invitation
      await client.groupJoinRequest.create({
        data: {
          groupId,
          userId: userToInviteId,
          status: 'pending',
          createdBy: 'INVITE'
        }
      });

      // Send email notification if not skipped
      if (!options.skipEmailCheck) {
        const shouldSend = await shouldSendEmailNotification(userToInviteId, 'groupInvites');
        if (shouldSend) {
          await this.sendInvitationEmail({
            recipientName: userToInvite.name,
            recipientEmail: userToInvite.email,
            inviterName: inviter.name,
            resourceId: groupId,
            resourceName: group.name,
            resourceDescription: group.description || undefined,
            resourceType: 'group',
            actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/groups/${groupId}`
          });
        }
      }

      // Create in-app notification using NotificationFactory
      await NotificationFactory.createGroupNotifications(
        {
          groupId,
          type: 'invited',
          userIds: [userToInviteId],
          params: {
            groupName: group.name,
            name: inviter.name
          },
          checkMutePreference: true
        },
        client
      );

      return { success: true };
    } catch (error) {
      logger.error('Failed to invite user to group', 'InviteService', {
        error,
        groupId,
        userToInviteId
      });
      return { success: false, error: 'Failed to send invitation' };
    }
  }

  /**
   * Batch invite multiple users to a group by email
   */
  static async batchInviteToGroup(
    groupId: string,
    emails: string[],
    inviterId: string
  ): Promise<BatchInviteResult> {
    const result: BatchInviteResult = {
      total: emails.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Validate all emails first
    const validEmails = emails.filter(email => {
      if (!isValidEmail(email)) {
        result.failed++;
        result.errors.push({ email, error: 'Invalid email format' });
        return false;
      }
      return true;
    });

    if (validEmails.length === 0) {
      return result;
    }

    // Find all users by email
    const users = await prisma.user.findMany({
      where: { email: { in: validEmails } },
      select: { id: true, email: true, name: true }
    });

    const userMap = new Map(users.map(u => [u.email, u]));

    // Track not found emails
    validEmails.forEach(email => {
      if (!userMap.has(email)) {
        result.failed++;
        result.errors.push({ email, error: 'User not found' });
      }
    });

    // Invite each found user
    for (const user of users) {
      const inviteResult = await this.inviteUserToGroup(groupId, user.id, inviterId);
      
      if (inviteResult.success) {
        result.successful++;
      } else {
        result.failed++;
        result.errors.push({ 
          email: user.email, 
          error: inviteResult.error || 'Unknown error' 
        });
      }
    }

    logger.info('Batch group invitation completed', 'InviteService', {
      groupId,
      total: result.total,
      successful: result.successful,
      failed: result.failed
    });

    return result;
  }

  /**
   * Validate if a user can send invitations for a resource
   */
  static async canUserInvite(
    userId: string,
    resourceId: string,
    resourceType: 'event' | 'group'
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (resourceType === 'event') {
      const event = await prisma.event.findUnique({
        where: { id: resourceId },
        include: {
          group: {
            include: {
              members: {
                where: { userId },
                select: { role: true }
              }
            }
          }
        }
      });

      if (!event) {
        return { allowed: false, reason: 'Event not found' };
      }

      // Event creator can always invite
      if (event.creatorId === userId) {
        return { allowed: true };
      }

      // Group admins can invite if event is linked to a group
      if (event.group && event.group.members.length > 0) {
        const membership = event.group.members[0];
        if (membership.role === 'admin' || membership.role === 'moderator') {
          return { allowed: true };
        }
      }

      return { allowed: false, reason: 'Insufficient permissions' };
    } else {
      const group = await prisma.group.findUnique({
        where: { id: resourceId },
        include: {
          members: {
            where: { userId },
            select: { role: true }
          }
        }
      });

      if (!group) {
        return { allowed: false, reason: 'Group not found' };
      }

      if (group.members.length === 0) {
        return { allowed: false, reason: 'Not a member' };
      }

      const membership = group.members[0];
      const isAdminOrModerator = membership.role === 'admin' || membership.role === 'moderator';

      // Check permissions
      if (isAdminOrModerator) {
        return { allowed: true };
      }

      if (group.allowMemberInvites) {
        return { allowed: true };
      }

      return { allowed: false, reason: 'Only admins and moderators can invite members' };
    }
  }

  /**
   * Get pending invitations for a user
   */
  static async getUserPendingInvitations(userId: string) {
    const [groupInvitations, eventInvitations] = await Promise.all([
      prisma.groupJoinRequest.findMany({
        where: {
          userId,
          status: 'pending',
          createdBy: 'INVITE'
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              description: true,
              sportType: true,
              isPublic: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      // Event invitations are tracked via EventParticipant with status 'pending'
      prisma.eventParticipant.findMany({
        where: {
          userId,
          status: 'pending'
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              description: true,
              startTime: true,
              endTime: true,
              sportType: true,
              isPublic: true,
              creator: {
                select: { id: true, name: true }
              }
            }
          }
        },
        orderBy: { event: { startTime: 'desc' } }
      })
    ]);

    return {
      groups: groupInvitations,
      events: eventInvitations,
      total: groupInvitations.length + eventInvitations.length
    };
  }
}
