import { cleanupExpiredTokens } from '../utils/jwt';
import { cleanupOldEmails } from './emailQueueService';
import { logger } from '../utils/logger';
import prisma from '../config/database';
import { sendEmailWithQueue } from './emailQueueService';
import { expireOldInvitations, syncTournamentAutoStatus } from './tournamentService';
import {
  MatchIncidentStatus,
  TournamentNotificationType,
  TournamentPaymentStatus,
  TournamentStatus,
} from '../../shared/types/tournament.types';

/**
 * Scheduled Jobs Service
 * Manages periodic cleanup and maintenance tasks
 */

let cleanupInterval: NodeJS.Timeout | null = null;
let remindersInterval: NodeJS.Timeout | null = null;
let tournamentSyncInterval: NodeJS.Timeout | null = null;

/**
 * Sync tournament lifecycle statuses in bulk.
 * Processes all non-terminal tournaments and transitions those whose
 * status should change based on current date/match state.
 */
export const syncAllTournamentStatuses = async (): Promise<void> => {
  const now = new Date();
  // Threshold: warn about tournaments that appear to be stuck for over 2 hours
  const stuckThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  try {
    // Fetch tournaments that might need a status change:
    // - Not yet completed or cancelled
    // - Relevant dates are approaching or in the past
    const candidates = await prisma.tournament.findMany({
      where: {
        status: { notIn: ['completed', 'cancelled'] },
      },
      select: {
        id: true,
        name: true,
        status: true,
        format: true,
        startDate: true,
        endDate: true,
        registrationStartDate: true,
        registrationDeadline: true,
      },
    });

    if (candidates.length === 0) return;

    let updated = 0;
    let failed = 0;
    const stuck: string[] = [];

    for (const t of candidates) {
      try {
        const prev = t.status;
        const synced = await syncTournamentAutoStatus(
          {
            id: t.id,
            name: t.name,
            status: t.status,
            format: t.format,
            startDate: t.startDate,
            endDate: t.endDate,
            registrationStartDate: t.registrationStartDate,
            registrationDeadline: t.registrationDeadline,
          },
          'cron_sync'
        );
        if (synced.status !== prev) {
          updated++;
        }
      } catch (err) {
        failed++;
        logger.warn(`Failed to sync status for tournament ${t.id}`, 'ScheduledJobs', { err });
      }

      // Detect stuck tournaments: registration should have opened or tournament should have started
      const registrationShouldBeOpen =
        t.status === 'draft' &&
        t.registrationStartDate != null &&
        new Date(t.registrationStartDate) < stuckThreshold;
      const tournamentShouldBeInProgress =
        t.status === 'registration_closed' &&
        t.startDate != null &&
        new Date(t.startDate) < stuckThreshold;
      if (registrationShouldBeOpen || tournamentShouldBeInProgress) {
        stuck.push(t.id);
      }
    }

    if (updated > 0 || failed > 0) {
      logger.info(
        `Tournament lifecycle sync: updated ${updated}/${candidates.length} tournaments` +
          (failed > 0 ? `, ${failed} failed` : ''),
        'ScheduledJobs',
        { updated, failed, total: candidates.length, at: now.toISOString() }
      );
    }

    if (stuck.length > 0) {
      logger.warn(
        `Stuck tournaments detected (${stuck.length}): status transition overdue by >2h`,
        'ScheduledJobs',
        { stuckTournamentIds: stuck, at: now.toISOString() }
      );
    }
  } catch (error) {
    logger.error('Error syncing tournament statuses', 'ScheduledJobs', { error });
  }
};

/**
 * Run cleanup tasks
 */
export const runCleanupTasks = async (): Promise<void> => {
  try {
    logger.info('Running scheduled cleanup tasks', 'ScheduledJobs');

    // Cleanup expired tokens and sessions
    await cleanupExpiredTokens();

    // Cleanup old processed emails
    await cleanupOldEmails();

    // Mark expired group invitations and join requests
    await expireInvitesAndJoinRequests();

    // Expire tournament team invitations past their expiry date
    await expireTournamentInvitations();

    // Expire stale TeamUp requests past their expiry date
    await expireTeamUpRequests();

    logger.info('Completed scheduled cleanup tasks', 'ScheduledJobs');
  } catch (error) {
    logger.error('Error running cleanup tasks', 'ScheduledJobs', { error });
  }
};

/**
 * Mark expired group invitations and pending join requests as expired
 */
const expireInvitesAndJoinRequests = async (): Promise<void> => {
  const now = new Date();

  try {
    // Expire INVITE-sourced join requests that have passed their expiresAt
    const expiredInvites = await prisma.groupJoinRequest.updateMany({
      where: {
        status: 'pending',
        createdBy: 'INVITE',
        expiresAt: { lt: now },
      },
      data: { status: 'rejected' },
    });

    if (expiredInvites.count > 0) {
      logger.info(`Expired ${expiredInvites.count} group invite requests`, 'ScheduledJobs');
    }

    // Expire USER-sourced join requests older than 90 days with no expiresAt
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const expiredRequests = await prisma.groupJoinRequest.updateMany({
      where: {
        status: 'pending',
        createdBy: 'USER',
        expiresAt: null,
        createdAt: { lt: ninetyDaysAgo },
      },
      data: { status: 'rejected' },
    });

    if (expiredRequests.count > 0) {
      logger.info(`Expired ${expiredRequests.count} stale join requests`, 'ScheduledJobs');
    }

    // Also sync InviteLog entries to 'expired' for matching records
    await prisma.inviteLog.updateMany({
      where: {
        status: 'sent',
        expiresAt: { lt: now },
      },
      data: { status: 'expired' },
    });
  } catch (error) {
    logger.error('Error expiring invites/join requests', 'ScheduledJobs', { error });
  }
};

/**
 * Expire tournament team invitations that are past their expiresAt date
 */
const expireTournamentInvitations = async (): Promise<void> => {
  try {
    const result = await expireOldInvitations();
    if (result.count > 0) {
      logger.info(`Expired ${result.count} tournament team invitations`, 'ScheduledJobs');
    }
  } catch (error) {
    logger.error('Error expiring tournament team invitations', 'ScheduledJobs', { error });
  }
};

const expireTeamUpRequests = async (): Promise<void> => {
  const now = new Date();

  try {
    const result = await prisma.teamUpRequest.updateMany({
      where: {
        status: 'open',
        expiresAt: { lt: now },
      },
      data: { status: 'expired' },
    });

    if (result.count > 0) {
      logger.info(`Expired ${result.count} TeamUp requests`, 'ScheduledJobs');
    }
  } catch (error) {
    logger.error('Error expiring TeamUp requests', 'ScheduledJobs', { error });
  }
};

/**
 * Send due session reminders
 */
export const sendDueEventReminders = async (): Promise<void> => {
  const now = new Date();
  // Look-ahead window: send reminders due in the next 5 minutes
  const lookahead = new Date(now.getTime() + 5 * 60 * 1000);

  try {
    const dueReminders = await prisma.sessionReminder.findMany({
      where: {
        sent: false,
        remindAt: { lte: lookahead },
      },
      include: {
        session: {
          select: {
            id: true,
            title: true,
            startTime: true,
            location: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            emailNotifications: true,
          },
        },
      },
      take: 200, // Process in batches
    });

    if (dueReminders.length === 0) return;

    logger.info(`Processing ${dueReminders.length} due session reminders`, 'ScheduledJobs');

    const results = await Promise.allSettled(
      dueReminders.map(async reminder => {
        // Send email notification if user has email notifications enabled
        if (reminder.user.emailNotifications) {
          const eventDate = reminder.session.startTime.toLocaleString();
          const htmlContent = `
            <h2>Event Reminder</h2>
            <p>Hi ${reminder.user.name},</p>
            <p>This is a reminder for your upcoming session:</p>
            <h3>${reminder.session.title}</h3>
            <p><strong>When:</strong> ${eventDate}</p>
            ${reminder.session.location ? `<p><strong>Where:</strong> ${reminder.session.location}</p>` : ''}
            <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/events/${reminder.session.id}" 
               style="display:inline-block;padding:12px 24px;background-color:#4CAF50;color:white;text-decoration:none;border-radius:4px;">
              View Event
            </a></p>
          `;
          await sendEmailWithQueue(
            reminder.user.email,
            `Reminder: ${reminder.session.title}`,
            htmlContent,
            { templateType: 'eventReminder' }
          );
        }

        // Mark reminder as sent
        await prisma.sessionReminder.update({
          where: { id: reminder.id },
          data: { sent: true },
        });
      })
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      logger.warn(`${failed.length} reminders failed to send`, 'ScheduledJobs');
    }

    logger.info(`Sent ${dueReminders.length - failed.length} session reminders`, 'ScheduledJobs');
  } catch (error) {
    logger.error('Error sending session reminders', 'ScheduledJobs', { error });
  }
};

export const checkIncidentSlas = async (): Promise<void> => {
  const now = new Date();

  try {
    const overdueIncidents = await prisma.tournamentMatchIncident.findMany({
      where: {
        status: MatchIncidentStatus.OPEN,
        slaDeadline: { lt: now },
      },
      include: {
        tournament: {
          select: { id: true, name: true, organizerId: true },
        },
      },
    });

    let notified = 0;
    let skipped = 0;
    for (const incident of overdueIncidents) {
      const existing = await prisma.tournamentNotification.findFirst({
        where: {
          tournamentId: incident.tournamentId,
          userId: incident.tournament.organizerId,
          type: TournamentNotificationType.tournament_updated,
          metadata: { path: ['slaIncidentId'], equals: incident.id },
        },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.tournamentNotification.create({
        data: {
          userId: incident.tournament.organizerId,
          tournamentId: incident.tournamentId,
          type: TournamentNotificationType.tournament_updated,
          params: {
            tournamentName: incident.tournament.name,
            incidentStatus: 'sla_breached',
          },
          metadata: {
            slaIncidentId: incident.id,
            matchId: incident.matchId,
          },
        },
      });
      notified++;
    }

    if (overdueIncidents.length > 0) {
      logger.warn(
        `Incident SLA check: ${overdueIncidents.length} overdue, ${notified} notified, ${skipped} already notified`,
        'ScheduledJobs',
        { overdueCount: overdueIncidents.length, notified, skipped, at: now.toISOString() }
      );
    }
  } catch (error) {
    logger.error('Error checking incident SLA deadlines', 'ScheduledJobs', { error });
  }
};

export const sendTournamentPaymentDeadlineReminders = async (): Promise<void> => {
  const now = new Date();

  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        paymentDeadline: { lte: now },
        status: { notIn: [TournamentStatus.CANCELLED, TournamentStatus.COMPLETED] },
      },
      select: {
        id: true,
        name: true,
        paymentDeadline: true,
        teams: {
          where: {
            captainUserId: { not: null },
            paymentStatus: {
              in: [TournamentPaymentStatus.UNPAID, TournamentPaymentStatus.PENDING],
            },
          },
          select: { id: true, captainUserId: true },
        },
      },
    });

    let reminded = 0;
    let skipped = 0;
    for (const tournament of tournaments) {
      for (const team of tournament.teams) {
        if (!team.captainUserId) continue;

        const existing = await prisma.tournamentNotification.findFirst({
          where: {
            tournamentId: tournament.id,
            userId: team.captainUserId,
            type: TournamentNotificationType.payment_reminder,
            metadata: { path: ['paymentReminderKey'], equals: `payment_deadline:${tournament.id}:${team.id}` },
          },
          select: { id: true },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await prisma.tournamentNotification.create({
          data: {
            userId: team.captainUserId,
            tournamentId: tournament.id,
            type: TournamentNotificationType.payment_reminder,
            params: {
              tournamentName: tournament.name,
            },
            metadata: {
              paymentReminderKey: `payment_deadline:${tournament.id}:${team.id}`,
              teamId: team.id,
              paymentDeadline: tournament.paymentDeadline?.toISOString?.() ?? tournament.paymentDeadline,
            },
          },
        });
        reminded++;
      }
    }

    if (reminded > 0 || skipped > 0) {
      logger.info(
        `Payment deadline reminders: ${reminded} sent, ${skipped} already sent`,
        'ScheduledJobs',
        { reminded, skipped, tournamentCount: tournaments.length, at: now.toISOString() }
      );
    }
  } catch (error) {
    logger.error('Error sending tournament payment deadline reminders', 'ScheduledJobs', { error });
  }
};

/**
 * Start scheduled cleanup tasks
 */
export const startScheduledJobs = (): void => {
  logger.info('Starting scheduled jobs', 'ScheduledJobs');

  // Run cleanup every hour
  cleanupInterval = setInterval(async () => {
    await runCleanupTasks();
  }, 60 * 60 * 1000); // 1 hour

  // Sync tournament lifecycle statuses every 5 minutes
  tournamentSyncInterval = setInterval(async () => {
    await syncAllTournamentStatuses();
  }, 5 * 60 * 1000); // 5 minutes

  // Check for due reminders every 5 minutes
  remindersInterval = setInterval(async () => {
    await sendDueEventReminders();
    await checkIncidentSlas();
    await sendTournamentPaymentDeadlineReminders();
  }, 5 * 60 * 1000); // 5 minutes

  // Run initial tasks
  runCleanupTasks();
  syncAllTournamentStatuses();
  sendDueEventReminders();
  checkIncidentSlas();
  sendTournamentPaymentDeadlineReminders();
};

/**
 * Stop scheduled jobs
 */
export const stopScheduledJobs = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  if (remindersInterval) {
    clearInterval(remindersInterval);
    remindersInterval = null;
  }
  if (tournamentSyncInterval) {
    clearInterval(tournamentSyncInterval);
    tournamentSyncInterval = null;
  }
  logger.info('Stopped scheduled jobs', 'ScheduledJobs');
};
