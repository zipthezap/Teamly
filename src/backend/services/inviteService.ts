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
import { getRedisClient, isRedisEnabled } from '../config/redis';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';

/**
 * Calculate expiration date from days
 * @param days Number of days from now
 * @returns Date object for expiration
 */
export function calculateExpirationDate(days: number): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

export interface InviteEmailData {
  recipientName: string;
  recipientEmail: string;
  inviterName: string;
  resourceId: string;
  resourceName: string;
  resourceDescription?: string;
  resourceType: 'event' | 'group';
  actionUrl: string;
  customMessage?: string; // Optional custom message
  expiresAt?: Date; // Optional expiration date
}

export interface BatchInviteResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

export interface InviteLogEntry {
  inviterType: 'group' | 'event';
  entityId: string;
  inviterId: string;
  inviteeEmail: string;
  inviteeId?: string;
  status: 'sent' | 'accepted' | 'declined' | 'expired' | 'revoked';
  message?: string;
  expiresAt?: Date;
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
      actionUrl,
      customMessage,
      expiresAt
    } = data;

    const expirationNotice = expiresAt 
      ? `<p><strong>Note:</strong> This invitation expires on ${expiresAt.toLocaleDateString()}</p>` 
      : '';

    const customMessageHtml = customMessage
      ? `<p><em>${escapeHtml(customMessage)}</em></p>`
      : '';

    const htmlContent = `
      <h2>You've Been Invited!</h2>
      <p>Hi ${escapeHtml(recipientName)},</p>
      <p>${escapeHtml(inviterName)} has invited you to join ${resourceType === 'event' ? 'an event' : 'a group'}:</p>
      <h3>${escapeHtml(resourceName)}</h3>
      ${resourceDescription ? `<p>${escapeHtml(resourceDescription)}</p>` : ''}
      ${customMessageHtml}
      ${expirationNotice}
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
      skipRateLimit?: boolean;
      tx?: Prisma.TransactionClient;
      customMessage?: string;
      expiresInDays?: number;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    const client = options.tx || prisma;

    // Per-user-per-group rate limit for single invites: 50 invites/hour
    // Skipped when called from batchInviteToGroup (which does its own check)
    if (!options.tx && !options.skipRateLimit) {
      const rateLimitKey = `invite_rate:${inviterId}:${groupId}`;
      const rateLimited = await InviteService.checkAndIncrementRateLimit(rateLimitKey, 50, 3600);
      if (rateLimited) {
        return { success: false, error: 'Invite rate limit exceeded. Maximum 50 invites per hour per group.' };
      }
    }

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

      // Check group capacity before sending invitation
      if (group.maxMembers) {
        const currentMemberCount = await client.groupMember.count({
          where: { groupId }
        });

        if (currentMemberCount >= group.maxMembers) {
          return { success: false, error: 'Group is at maximum capacity' };
        }
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

      // Calculate expiration if specified
      const expiresAt = options.expiresInDays 
        ? calculateExpirationDate(options.expiresInDays)
        : undefined;

      // Create the invitation
      await client.groupJoinRequest.create({
        data: {
          groupId,
          userId: userToInviteId,
          status: 'pending',
          createdBy: 'INVITE',
          invitedBy: inviterId,
          expiresAt
        }
      });

      // Create invite log
      await this.createInviteLog({
        inviterType: 'group',
        entityId: groupId,
        inviterId,
        inviteeEmail: userToInvite.email,
        inviteeId: userToInviteId,
        status: 'sent',
        message: options.customMessage,
        expiresAt
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
            actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/groups/${groupId}`,
            customMessage: options.customMessage,
            expiresAt
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
    inviterId: string,
    options: { customMessage?: string; expiresInDays?: number } = {}
  ): Promise<BatchInviteResult> {
    const result: BatchInviteResult = {
      total: emails.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Validate all emails first (before consuming rate limit points)
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

    // Per-user-per-group rate limit: max 50 invites per hour (checked after validation)
    const rateLimitKey = `invite_rate:${inviterId}:${groupId}`;
    const rateLimitExceeded = await InviteService.checkAndIncrementRateLimit(rateLimitKey, 50, 3600);
    if (rateLimitExceeded) {
      validEmails.forEach(email => {
        result.failed++;
        result.errors.push({ email, error: 'Invite rate limit exceeded. Maximum 50 invites per hour per group.' });
      });
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
      const inviteResult = await this.inviteUserToGroup(groupId, user.id, inviterId, {
        customMessage: options.customMessage,
        expiresInDays: options.expiresInDays,
        skipRateLimit: true, // Rate already checked for the full batch above
      });
      
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

      // Group admins and moderators can invite if event is linked to a group
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
              eventType: true,
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

  /**
   * Create invite log entry for auditing
   */
  static async createInviteLog(data: InviteLogEntry): Promise<void> {
    try {
      await prisma.inviteLog.create({
        data: {
          inviterType: data.inviterType,
          entityId: data.entityId,
          inviterId: data.inviterId,
          inviteeEmail: data.inviteeEmail,
          inviteeId: data.inviteeId,
          status: data.status,
          message: data.message,
          expiresAt: data.expiresAt
        }
      });
    } catch (error) {
      logger.error('Failed to create invite log', 'InviteService', { error, data });
    }
  }

  /**
   * Revoke a pending invitation
   */
  static async revokeInvitation(
    resourceType: 'group' | 'event',
    resourceId: string,
    inviteeEmail: string,
    revokerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (resourceType === 'group') {
        // Find the user by email
        const user = await prisma.user.findUnique({
          where: { email: inviteeEmail }
        });

        if (!user) {
          return { success: false, error: 'User not found' };
        }

        // Find and delete the pending invitation
        const deletedRequest = await prisma.groupJoinRequest.deleteMany({
          where: {
            groupId: resourceId,
            userId: user.id,
            status: 'pending',
            createdBy: 'INVITE'
          }
        });

        if (deletedRequest.count === 0) {
          return { success: false, error: 'No pending invitation found' };
        }

        // Update invite log
        await prisma.inviteLog.updateMany({
          where: {
            inviterType: 'group',
            entityId: resourceId,
            inviteeEmail: inviteeEmail,
            status: 'sent'
          },
          data: {
            status: 'revoked',
            revokedAt: new Date(),
            revokedBy: revokerId
          }
        });

        return { success: true };
      } else {
        // Event invitation revocation
        const user = await prisma.user.findUnique({
          where: { email: inviteeEmail }
        });

        if (!user) {
          return { success: false, error: 'User not found' };
        }

        const deletedParticipant = await prisma.eventParticipant.deleteMany({
          where: {
            eventId: resourceId,
            userId: user.id,
            status: 'pending'
          }
        });

        if (deletedParticipant.count === 0) {
          return { success: false, error: 'No pending invitation found' };
        }

        // Update invite log
        await prisma.inviteLog.updateMany({
          where: {
            inviterType: 'event',
            entityId: resourceId,
            inviteeEmail: inviteeEmail,
            status: 'sent'
          },
          data: {
            status: 'revoked',
            revokedAt: new Date(),
            revokedBy: revokerId
          }
        });

        return { success: true };
      }
    } catch (error) {
      logger.error('Failed to revoke invitation', 'InviteService', {
        error,
        resourceType,
        resourceId,
        inviteeEmail
      });
      return { success: false, error: 'Failed to revoke invitation' };
    }
  }

  /**
   * Check and expire old invitations
   */
  static async expireOldInvitations(): Promise<number> {
    try {
      const now = new Date();
      
      // Expire group join requests
      const expiredGroupRequests = await prisma.groupJoinRequest.updateMany({
        where: {
          status: 'pending',
          expiresAt: {
            lte: now
          }
        },
        data: {
          status: 'rejected' // Mark as rejected when expired
        }
      });

      // Update invite logs
      await prisma.inviteLog.updateMany({
        where: {
          status: 'sent',
          expiresAt: {
            lte: now
          }
        },
        data: {
          status: 'expired'
        }
      });

      logger.info('Expired old invitations', 'InviteService', {
        count: expiredGroupRequests.count
      });

      return expiredGroupRequests.count;
    } catch (error) {
      logger.error('Failed to expire invitations', 'InviteService', { error });
      return 0;
    }
  }

  /**
   * Get invite analytics for a resource
   */
  static async getInviteAnalytics(
    resourceType: 'group' | 'event',
    resourceId: string,
    options: { from?: Date; to?: Date } = {}
  ): Promise<{
    total: number;
    sent: number;
    accepted: number;
    declined: number;
    expired: number;
    revoked: number;
    pending: number;
    timeSeries?: Array<{ weekStart: string; sent: number; accepted: number; declined: number; expired: number; revoked: number }>;
  }> {
    try {
      const where: Record<string, unknown> = {
        inviterType: resourceType,
        entityId: resourceId,
      };
      if (options.from || options.to) {
        where.sentAt = {
          ...(options.from ? { gte: options.from } : {}),
          ...(options.to ? { lte: options.to } : {}),
        };
      }

      const logs = await prisma.inviteLog.findMany({
        where,
        select: { status: true, sentAt: true },
      });

      const stats = {
        total: logs.length,
        sent: 0,
        accepted: 0,
        declined: 0,
        expired: 0,
        revoked: 0,
        pending: 0,
      };

      logs.forEach(log => {
        if (log.status === 'sent') stats.sent++;
        else if (log.status === 'accepted') stats.accepted++;
        else if (log.status === 'declined') stats.declined++;
        else if (log.status === 'expired') stats.expired++;
        else if (log.status === 'revoked') stats.revoked++;
      });

      // Pending = sent invitations not yet responded to
      stats.pending = stats.sent;

      // Build time-series when a date range is requested
      let timeSeries: Array<{ weekStart: string; sent: number; accepted: number; declined: number; expired: number; revoked: number }> | undefined;
      if (options.from || options.to) {
        const bucketMap = new Map<string, { sent: number; accepted: number; declined: number; expired: number; revoked: number }>();

        logs.forEach(log => {
          if (!log.sentAt) return; // Skip records with missing timestamps
          const date = new Date(log.sentAt);
          // ISO week start (Monday)
          const day = date.getDay();
          const diff = (day === 0 ? -6 : 1) - day;
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() + diff);
          weekStart.setHours(0, 0, 0, 0);
          const key = weekStart.toISOString().slice(0, 10);

          if (!bucketMap.has(key)) {
            bucketMap.set(key, { sent: 0, accepted: 0, declined: 0, expired: 0, revoked: 0 });
          }
          const bucket = bucketMap.get(key)!;
          if (log.status === 'sent') bucket.sent++;
          else if (log.status === 'accepted') bucket.accepted++;
          else if (log.status === 'declined') bucket.declined++;
          else if (log.status === 'expired') bucket.expired++;
          else if (log.status === 'revoked') bucket.revoked++;
        });

        timeSeries = Array.from(bucketMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([weekStart, counts]) => ({ weekStart, ...counts }));
      }

      return { ...stats, ...(timeSeries ? { timeSeries } : {}) };
    } catch (error) {
      logger.error('Failed to get invite analytics', 'InviteService', {
        error,
        resourceType,
        resourceId
      });
      return {
        total: 0,
        sent: 0,
        accepted: 0,
        declined: 0,
        expired: 0,
        revoked: 0,
        pending: 0
      };
    }
  }

  /**
   * Generate time-limited invite token
   */
  static async generateInviteToken(
    resourceType: 'group' | 'event',
    resourceId: string,
    expiresInDays: number = 30
  ): Promise<{ success: boolean; token?: string; expiresAt?: Date; error?: string }> {
    try {
      // Use crypto for secure token generation
      const crypto = require('crypto');
      const token = crypto.randomBytes(16).toString('hex');
      const expiresAt = calculateExpirationDate(expiresInDays);

      if (resourceType === 'group') {
        await prisma.group.update({
          where: { id: resourceId },
          data: {
            inviteToken: token,
            inviteTokenExpiresAt: expiresAt
          }
        });
      } else {
        await prisma.event.update({
          where: { id: resourceId },
          data: {
            inviteToken: token,
            inviteTokenExpiresAt: expiresAt
          }
        });
      }

      return { success: true, token, expiresAt };
    } catch (error) {
      logger.error('Failed to generate invite token', 'InviteService', {
        error,
        resourceType,
        resourceId
      });
      return { success: false, error: 'Failed to generate token' };
    }
  }

  /**
   * Validate invite token is not expired
   */
  static async validateInviteToken(
    resourceType: 'group' | 'event',
    token: string
  ): Promise<{ valid: boolean; resourceId?: string; error?: string }> {
    try {
      const now = new Date();
      
      if (resourceType === 'group') {
        const group = await prisma.group.findUnique({
          where: { inviteToken: token },
          select: { 
            id: true,
            name: true,
            inviteTokenExpiresAt: true 
          }
        });

        if (!group) {
          logger.warn('Invalid group invite token attempted', 'InviteService');
          return { valid: false, error: 'Invalid invite link' };
        }

        if (group.inviteTokenExpiresAt && group.inviteTokenExpiresAt < now) {
          logger.info('Expired group invite token used', 'InviteService', { 
            groupId: group.id,
            groupName: group.name,
            expiresAt: group.inviteTokenExpiresAt 
          });
          return { valid: false, error: 'This invite link has expired' };
        }

        return { valid: true, resourceId: group.id };
      } else {
        const event = await prisma.event.findUnique({
          where: { inviteToken: token },
          select: { 
            id: true,
            title: true,
            inviteTokenExpiresAt: true 
          }
        });

        if (!event) {
          logger.warn('Invalid event invite token attempted', 'InviteService');
          return { valid: false, error: 'Invalid invite link' };
        }

        if (event.inviteTokenExpiresAt && event.inviteTokenExpiresAt < now) {
          logger.info('Expired event invite token used', 'InviteService', { 
            eventId: event.id,
            eventTitle: event.title,
            expiresAt: event.inviteTokenExpiresAt 
          });
          return { valid: false, error: 'This invite link has expired' };
        }

        return { valid: true, resourceId: event.id };
      }
    } catch (error) {
      logger.error('Failed to validate invite token', 'InviteService', { error, resourceType });
      return { valid: false, error: 'Failed to validate invite link' };
    }
  }

  /**
   * Check a rate-limit counter and increment it.
   * Returns true if the limit has been exceeded, false if the action is allowed.
   * Uses Redis when available, falls back to in-memory.
   *
   * The limiter instance is keyed by (maxPoints, durationSeconds) so it is shared across
   * all callers with the same configuration. The `key` parameter is passed to `consume()`
   * as the per-caller identifier (e.g., "user123:group456").
   */
  private static readonly rateLimiterInstances = new Map<string, RateLimiterMemory | RateLimiterRedis>();

  static async checkAndIncrementRateLimit(
    key: string,
    maxPoints: number,
    durationSeconds: number
  ): Promise<boolean> {
    // Cache key for the limiter instance (shared across callers with the same config)
    const limiterCacheKey = `${maxPoints}:${durationSeconds}`;
    try {
      let limiter = InviteService.rateLimiterInstances.get(limiterCacheKey);
      if (!limiter) {
        const redisClient = isRedisEnabled() ? getRedisClient() : null;
        if (redisClient) {
          limiter = new RateLimiterRedis({
            storeClient: redisClient as ConstructorParameters<typeof RateLimiterRedis>[0]['storeClient'],
            keyPrefix: 'invite_rl',
            points: maxPoints,
            duration: durationSeconds,
          });
        } else {
          limiter = new RateLimiterMemory({
            keyPrefix: 'invite_rl',
            points: maxPoints,
            duration: durationSeconds,
          });
        }
        InviteService.rateLimiterInstances.set(limiterCacheKey, limiter);
      }
      // `key` is the per-caller identifier (user:group)
      await limiter.consume(key);
      return false; // Not rate-limited
    } catch {
      return true; // Rate-limited
    }
  }
}
