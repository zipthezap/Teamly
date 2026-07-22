import { cleanupExpiredTokens } from '../utils/jwt';
import { cleanupOldEmails } from './emailQueueService';
import { logger } from '../utils/logger';
import prisma from '../config/database';
import { sendEmailWithQueue } from './emailQueueService';
import { expireOldInvitations, syncTournamentAutoStatus } from './tournamentService';
import { NotificationFactory } from './notificationFactory';
import { determineSessionStatus } from './sessionService';
import { escapeHtml } from '../utils/validation';
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
          const recipientName = String(reminder.user.name ?? '');
          const sessionTitle = String(reminder.session.title ?? 'Event');
          const sessionLocation = reminder.session.location ? String(reminder.session.location) : '';
          const htmlContent = `
            <h2>Event Reminder</h2>
            <p>Hi ${escapeHtml(recipientName)},</p>
            <p>This is a reminder for your upcoming session:</p>
            <h3>${escapeHtml(sessionTitle)}</h3>
            <p><strong>When:</strong> ${eventDate}</p>
            ${sessionLocation ? `<p><strong>Where:</strong> ${escapeHtml(sessionLocation)}</p>` : ''}
            <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/events/${reminder.session.id}" 
               style="display:inline-block;padding:12px 24px;background-color:#4CAF50;color:white;text-decoration:none;border-radius:4px;">
              View Event
            </a></p>
          `;
          await sendEmailWithQueue(
            reminder.user.email,
            `Reminder: ${escapeHtml(sessionTitle)}`,
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

    // If some sends failed, attempt a single retry per failed reminder to avoid silent loss
    const failedIndices: number[] = results
      .map((r, i) => (r.status === 'rejected' ? i : -1))
      .filter((i) => i >= 0);

    if (failedIndices.length > 0) {
      logger.warn(`${failedIndices.length} reminders failed to send on first attempt, retrying`, 'ScheduledJobs');
      let retrySuccess = 0;
      let retryFailed = 0;
      for (const idx of failedIndices) {
        const reminder = dueReminders[idx];
        try {
          if (reminder.user.emailNotifications) {
            const eventDate = reminder.session.startTime.toLocaleString();
            const recipientName = String(reminder.user.name ?? '');
            const sessionTitle = String(reminder.session.title ?? 'Event');
            const sessionLocation = reminder.session.location ? String(reminder.session.location) : '';
            const htmlContent = `
              <h2>Event Reminder</h2>
              <p>Hi ${escapeHtml(recipientName)},</p>
              <p>This is a reminder for your upcoming session:</p>
              <h3>${escapeHtml(sessionTitle)}</h3>
              <p><strong>When:</strong> ${eventDate}</p>
              ${sessionLocation ? `<p><strong>Where:</strong> ${escapeHtml(sessionLocation)}</p>` : ''}
              <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/events/${reminder.session.id}" 
                 style="display:inline-block;padding:12px 24px;background-color:#4CAF50;color:white;text-decoration:none;border-radius:4px;">
                View Event
              </a></p>
            `;
            await sendEmailWithQueue(
              reminder.user.email,
              `Reminder: ${escapeHtml(sessionTitle)}`,
              htmlContent,
              { templateType: 'eventReminder' }
            );
          }
          await prisma.sessionReminder.update({ where: { id: reminder.id }, data: { sent: true } });
          retrySuccess++;
        } catch (err) {
          retryFailed++;
          logger.error('Retry failed to send reminder', 'ScheduledJobs', { reminderId: reminder.id, err });
        }
      }

      if (retrySuccess > 0 || retryFailed > 0) {
        logger.info(`Reminder retry results: ${retrySuccess} succeeded, ${retryFailed} failed`, 'ScheduledJobs');
      }
    }

    const totalFailed = failedIndices.length;
    logger.info(`Sent ${dueReminders.length - totalFailed} session reminders (with ${totalFailed} failures)`, 'ScheduledJobs');
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

      await NotificationFactory.createTournamentNotifications({
        tournamentId: incident.tournamentId,
        type: TournamentNotificationType.tournament_updated,
        userIds: [incident.tournament.organizerId],
        params: {
          tournamentName: escapeHtml(String(incident.tournament.name ?? '')),
          incidentStatus: 'sla_breached',
        },
        metadata: {
          slaIncidentId: incident.id,
          matchId: incident.matchId,
        },
        checkMutePreference: false,
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
  const lookAheadHours = 24; // send reminders for deadlines within the next 24 hours
  const cutoff = new Date(now.getTime() + lookAheadHours * 60 * 60 * 1000);

  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        // Send reminders for upcoming deadlines in the next `lookAheadHours`
        paymentDeadline: { gte: now, lte: cutoff },
        status: { notIn: [TournamentStatus.CANCELLED, TournamentStatus.COMPLETED] },
      },
      select: {
        id: true,
        name: true,
        paymentDeadline: true,
        teams: {
          where: {
            NOT: { captainUserId: null },
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

        await NotificationFactory.createTournamentNotifications({
          tournamentId: tournament.id,
          type: TournamentNotificationType.payment_reminder,
          userIds: [team.captainUserId],
          params: {
            tournamentName: escapeHtml(String(tournament.name ?? '')),
          },
          metadata: {
            paymentReminderKey: `payment_deadline:${tournament.id}:${team.id}`,
            teamId: team.id,
            paymentDeadline: tournament.paymentDeadline?.toISOString?.() ?? tournament.paymentDeadline,
          },
          checkMutePreference: false,
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
 * Sync session statuses in bulk based on start/end times.
 * Useful to keep `status` up-to-date for upcoming/ongoing/completed transitions.
 */
export const syncAllSessionStatuses = async (): Promise<void> => {
  const now = new Date();
  try {
    const candidates = await prisma.session.findMany({
      where: { archived: false, status: { notIn: ['completed'] } },
      select: { id: true, startTime: true, endTime: true, status: true },
    });

    if (candidates.length === 0) return;

    let updated = 0;
    for (const s of candidates) {
      try {
        const desired = determineSessionStatus(
          typeof s.startTime === 'string' ? s.startTime : s.startTime?.toISOString?.() ?? '',
          typeof s.endTime === 'string' ? s.endTime : s.endTime?.toISOString?.()
        );
        if (desired && desired !== s.status) {
          await prisma.session.update({ where: { id: s.id }, data: { status: desired } });
          updated++;
        }
      } catch (err) {
        logger.warn('Failed to sync session status', 'ScheduledJobs', { sessionId: s.id, err });
      }
    }

    if (updated > 0) {
      logger.info(`Session status sync: updated ${updated}/${candidates.length} sessions`, 'ScheduledJobs', {
        updated,
        total: candidates.length,
        at: now.toISOString(),
      });
    }
  } catch (error) {
    logger.error('Error syncing session statuses', 'ScheduledJobs', { error });
  }
};

export const syncTeamPaymentStatuses = async (): Promise<void> => {
  try {
    // Fetch recent payment transactions for teams in paginated batches to avoid OOM on large datasets
    const pageSize = 500;
    let page = 0;
    const teamMap: Record<string, { hasPaid: boolean; hasPending: boolean }> = {};
    while (true) {
      const txs = await prisma.tournamentPaymentTransaction.findMany({
        select: { teamId: true, status: true },
        skip: page * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
      });
      if (!txs || txs.length === 0) break;

      for (const t of txs) {
        if (!t.teamId) continue;
        const current = teamMap[t.teamId] || { hasPaid: false, hasPending: false };
        if (t.status === TournamentPaymentStatus.PAID) current.hasPaid = true;
        if (t.status === TournamentPaymentStatus.PENDING) current.hasPending = true;
        teamMap[t.teamId] = current;
      }

      if (txs.length < pageSize) break;
      page++;
    }
    

    const updates: Promise<unknown>[] = [];
    for (const [teamId, flags] of Object.entries(teamMap)) {
      const desired: TournamentPaymentStatus = flags.hasPaid
        ? TournamentPaymentStatus.PAID
        : flags.hasPending
        ? TournamentPaymentStatus.PENDING
        : TournamentPaymentStatus.UNPAID;

      updates.push(
        prisma.tournamentTeam.updateMany({
          where: { id: teamId, paymentStatus: { not: desired } },
          data: { paymentStatus: desired },
        })
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      logger.info(`Synced payment status for ${updates.length} teams`, 'ScheduledJobs');
    }

    // After syncing payment statuses, attempt to auto-promote teams on the
    // registration waitlist for tournaments that allow auto-promotion and
    // currently have open slots. Promote up to the number of open slots.
    try {
      const tournaments = await prisma.tournament.findMany({
        where: {
          autoPromoteRegistrationWaitlist: true,
          NOT: { maxTeams: null },
          status: { notIn: [TournamentStatus.CANCELLED, TournamentStatus.COMPLETED] },
        },
        select: {
          id: true,
          name: true,
          maxTeams: true,
        },
      });

      for (const t of tournaments) {
        try {
          const teamCount = await prisma.tournamentTeam.count({ where: { tournamentId: t.id } });
          const openSlots = (t.maxTeams ?? 0) - teamCount;
          if (openSlots <= 0) continue;

          let promoted = 0;
          for (let i = 0; i < openSlots; i++) {
            const firstEntry = await prisma.tournamentRegistrationWaitlist.findFirst({
              where: { tournamentId: t.id },
              orderBy: { position: 'asc' },
              include: { team: { select: { id: true, name: true, captainUserId: true } } },
            });

            if (!firstEntry) break;

            // Promote: delete waitlist entry and shift positions atomically when
            // prisma.$transaction is available; otherwise run both operations so
            // test mocks (which may not provide $transaction) are invoked.
            const deleteOp = prisma.tournamentRegistrationWaitlist.delete({ where: { id: firstEntry.id } });
            const shiftOp = prisma.tournamentRegistrationWaitlist.updateMany({
              where: { tournamentId: t.id, position: { gt: firstEntry.position } },
              data: { position: { decrement: 1 } },
            });

            if (typeof prisma.$transaction === 'function') {
              try {
                await prisma.$transaction([deleteOp, shiftOp]);
              } catch (txErr) {
                void txErr;
                // If transaction fails, attempt operations individually as a
                // best-effort fallback to avoid losing promotable slots.
                await deleteOp;
                await shiftOp;
              }
            } else {
              await Promise.all([deleteOp, shiftOp]);
            }

            // Best-effort notify the promoted team's captain
            try {
              if (firstEntry.team?.captainUserId) {
                await NotificationFactory.createTournamentNotifications({
                  tournamentId: t.id,
                  type: TournamentNotificationType.tournament_updated,
                  userIds: [firstEntry.team.captainUserId],
                  params: { tournamentName: escapeHtml(String(t.name ?? '')), teamName: escapeHtml(String(firstEntry.team?.name ?? '')) },
                  metadata: { updateType: 'waitlist_promoted', teamId: firstEntry.team.id },
                  checkMutePreference: false,
                });
              }
            } catch (notifErr) {
              logger.warn('Failed to notify promoted waitlist team', 'ScheduledJobs', { err: notifErr, tournamentId: t.id, teamId: firstEntry.team?.id });
            }

            promoted++;
          }

          if (promoted > 0) {
            logger.info(`Auto-promoted ${promoted} team(s) from waitlist for tournament ${t.id}`, 'ScheduledJobs', { tournamentId: t.id, promoted });
          }
        } catch (err) {
          logger.error('Error promoting waitlist entries for tournament', 'ScheduledJobs', { tournamentId: t.id, err });
        }
      }
    } catch (err) {
      logger.error('Error scanning tournaments for waitlist promotions', 'ScheduledJobs', { err });
    }
  } catch (error) {
    logger.error('Error syncing team payment statuses', 'ScheduledJobs', { error });
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
    await syncTeamPaymentStatuses();
    await syncAllSessionStatuses();
  }, 5 * 60 * 1000); // 5 minutes

  // Run initial tasks
  runCleanupTasks();
  syncAllTournamentStatuses();
  sendDueEventReminders();
  checkIncidentSlas();
  sendTournamentPaymentDeadlineReminders();
  syncTeamPaymentStatuses();
  syncAllSessionStatuses();
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
