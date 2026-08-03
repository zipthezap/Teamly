import prisma from '../../config/database';
import { MatchStatus } from '../../../shared/types/tournament.types';

const MILLISECONDS_PER_MINUTE = 60_000;
const LATE_START_THRESHOLD_MS = 10 * 60 * 1000;

/**
 * Aggregates the organizer analytics dashboard payload: registration funnel,
 * match throughput, score disputes, incident SLA, and payment revenue.
 */
export const computeTournamentAnalytics = async (tournamentId: string) => {
  const [teams, matches, disputes, incidents, paymentTxns] = await Promise.all([
    prisma.tournamentTeam.findMany({
      where: { tournamentId },
      select: { checkedIn: true, paymentStatus: true, waiverAcceptedAt: true },
    }),
    prisma.tournamentMatch.findMany({
      where: { tournamentId },
      select: { status: true, scheduledAt: true, startedAt: true, completedAt: true, scheduledDurationMinutes: true },
    }),
    prisma.tournamentScoreDispute.findMany({
      where: { match: { tournamentId } },
      select: { status: true },
    }),
    prisma.tournamentMatchIncident.findMany({
      where: { tournamentId },
      select: { status: true, slaDeadline: true },
    }),
    prisma.tournamentPaymentTransaction.findMany({
      where: { tournamentId },
      select: { status: true, amount: true },
    }),
  ]);

  // Registration funnel
  const totalTeams = teams.length;
  const checkedIn = teams.filter((t) => t.checkedIn).length;
  const waiverAccepted = teams.filter((t) => t.waiverAcceptedAt !== null).length;
  const paid = teams.filter((t) => t.paymentStatus === 'paid').length;
  const unpaid = teams.filter((t) => t.paymentStatus === 'unpaid').length;
  const pending = teams.filter((t) => t.paymentStatus === 'pending').length;
  const waived = teams.filter((t) => t.paymentStatus === 'waived').length;
  const noShows = teams.filter((t) => !t.checkedIn).length;

  // Match throughput
  const completedMatches = matches.filter((m) => m.status === MatchStatus.COMPLETED && m.startedAt && m.completedAt);
  const lateStarts = matches.filter(
    (m) =>
      m.scheduledAt &&
      m.startedAt &&
      new Date(m.startedAt).getTime() - new Date(m.scheduledAt).getTime() > LATE_START_THRESHOLD_MS
  ).length;
  const avgDurationMinutes =
    completedMatches.length > 0
      ? Math.round(
          completedMatches.reduce((sum, m) => {
            const dur =
              (new Date(m.completedAt!).getTime() - new Date(m.startedAt!).getTime()) / MILLISECONDS_PER_MINUTE;
            return sum + dur;
          }, 0) / completedMatches.length
        )
      : null;

  // Payments
  const paidTxns = paymentTxns.filter((p) => p.status === 'paid');
  const refundedTxns = paymentTxns.filter((p) => p.status === 'refunded');
  const totalRevenue = paidTxns.reduce((s, p) => s + p.amount, 0);

  // Incident SLA
  const now = new Date();
  const openIncidents = incidents.filter((i) => i.status === 'open');
  const pastSla = openIncidents.filter((i) => i.slaDeadline && new Date(i.slaDeadline) < now).length;

  return {
    registration: {
      totalTeams,
      checkedIn,
      noShows,
      paid,
      unpaid,
      pending,
      waived,
      waiverAccepted,
    },
    matches: {
      total: matches.length,
      scheduled: matches.filter((m) => m.status === MatchStatus.SCHEDULED).length,
      inProgress: matches.filter((m) => m.status === MatchStatus.IN_PROGRESS).length,
      completed: completedMatches.length,
      cancelled: matches.filter((m) => m.status === MatchStatus.CANCELLED).length,
      lateStarts,
      avgDurationMinutes,
    },
    disputes: {
      total: disputes.length,
      open: disputes.filter((d) => d.status === 'open').length,
      resolved: disputes.filter((d) => d.status === 'resolved').length,
      dismissed: disputes.filter((d) => d.status === 'dismissed').length,
    },
    incidents: {
      total: incidents.length,
      open: openIncidents.length,
      resolved: incidents.filter((i) => i.status === 'resolved').length,
      pastSla,
    },
    payments: {
      totalRevenue,
      transactionsPaid: paidTxns.length,
      transactionsRefunded: refundedTxns.length,
    },
  };
};
