/**
 * Authentication Controller
 * 
 * This controller handles all authentication and user management operations including:
 * - User registration and login (with 2FA support)
 * - Password management (update, reset, recovery)
 * - Email verification
 * - Token management (access, refresh, logout)
 * - Session management
 * - Profile management (view, update)
 * - Profile picture management (upload, delete, restore)
 * - OAuth integration (Google, Facebook, Apple)
 * - Mobile OAuth token exchange (Google, Facebook, Apple)
 */

import { Request, Response } from 'express';
import prisma from '../config/database';

type DashboardUpcomingEventType = 'session' | 'teamup' | 'tournament';

type DashboardUpcomingEvent = {
  id: string;
  title: string;
  startTime: Date;
  eventType: DashboardUpcomingEventType;
  contextName: string;
};

const MAX_UPCOMING_EVENTS_PER_TYPE = 10;
const MAX_UPCOMING_EVENTS_TOTAL = 5;

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const now = new Date();

  const [upcomingSessions, upcomingTeamUps, upcomingTournaments, groups, notificationStats] = await Promise.all([
    // Upcoming sessions the user is hosting or participating in.
    prisma.session.findMany({
      where: {
        archived: false,
        startTime: { gte: now },
        OR: [
          { creatorId: userId },
          {
            participants: {
              some: {
                userId,
                status: { not: 'declined' },
              },
            },
          },
        ],
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, profilePicture: true },
        },
        group: {
          select: { id: true, name: true },
        },
        _count: {
          select: { participants: true, guestParticipants: true, comments: true },
        },
      },
      orderBy: { startTime: 'asc' },
      take: MAX_UPCOMING_EVENTS_PER_TYPE,
    }),

    // Upcoming TeamUps the user is hosting or participating in.
    prisma.teamUpRequest.findMany({
      where: {
        dateTime: { gte: now },
        status: { in: ['open', 'filled'] },
        OR: [
          { creatorId: userId },
          {
            responses: {
              some: {
                userId,
                status: { notIn: ['declined', 'cancelled'] },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        dateTime: true,
        locationName: true,
        city: true,
      },
      orderBy: { dateTime: 'asc' },
      take: MAX_UPCOMING_EVENTS_PER_TYPE,
    }),

    // Upcoming tournaments the user is hosting or participating in.
    prisma.tournament.findMany({
      where: {
        startDate: { gte: now },
        status: { notIn: ['completed', 'cancelled'] },
        OR: [
          { organizerId: userId },
          { teams: { some: { captainUserId: userId } } },
          { teams: { some: { players: { some: { userId } } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        locationName: true,
        city: true,
        group: { select: { name: true } },
      },
      orderBy: { startDate: 'asc' },
      take: MAX_UPCOMING_EVENTS_PER_TYPE,
    }),

    // User's groups (most recent first, max 5)
    prisma.group.findMany({
      where: {
        members: { some: { userId } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        isPublic: true,
        sportType: true,
        picture: true,
        city: true,
        createdAt: true,
        creatorId: true,
        _count: { select: { members: true, sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),

    // Unread notification count (all categories)
    prisma.$transaction([
      prisma.sessionNotification.count({ where: { userId, read: false } }),
      prisma.groupNotification.count({ where: { userId, read: false } }),
      prisma.teamUpNotification.count({ where: { userId, read: false } }),
      prisma.tournamentNotification.count({ where: { userId, read: false } }),
    ]),
  ]);

  const unreadNotifications =
    notificationStats[0] +
    notificationStats[1] +
    notificationStats[2] +
    notificationStats[3];

  // Total sessions the user has ever joined
  const totalSessions = await prisma.sessionParticipant.count({ where: { userId } });

  // Normalize group `picture` → `profilePicture` to match the shared mobile contract.
  // Prisma does not support field aliasing in select, so the rename is done here.
  const recentGroups = groups.map(({ picture, ...group }) => ({
    ...group,
    profilePicture: picture,
  }));

  const upcomingEvents: DashboardUpcomingEvent[] = [
    ...upcomingSessions.map((session) => ({
      id: session.id,
      title: session.title,
      startTime: session.startTime,
      eventType: 'session' as const,
      contextName: session.group.name,
    })),
    ...upcomingTeamUps.map((teamUp) => ({
      id: teamUp.id,
      title: teamUp.title,
      startTime: teamUp.dateTime,
      eventType: 'teamup' as const,
      contextName: teamUp.locationName ?? teamUp.city ?? '',
    })),
    ...upcomingTournaments.map((tournament) => ({
      id: tournament.id,
      title: tournament.name,
      startTime: tournament.startDate,
      eventType: 'tournament' as const,
      contextName:
        tournament.locationName ?? tournament.city ?? tournament.group?.name ?? '',
    })),
  ]
    .sort((a, b) => {
      const byStart = a.startTime.getTime() - b.startTime.getTime();
      if (byStart !== 0) return byStart;
      return a.id.localeCompare(b.id);
    })
    .slice(0, MAX_UPCOMING_EVENTS_TOTAL);

  res.json({
    upcomingEvents,
    recentGroups,
    unreadNotifications,
    stats: {
      totalSessions,
      upcomingCount: upcomingEvents.length,
      groupCount: groups.length,
    },
  });
};
