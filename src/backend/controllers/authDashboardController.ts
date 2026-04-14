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

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const now = new Date();

  const [upcomingSessions, groups, notificationStats] = await Promise.all([
    // Top 5 upcoming sessions the user is hosting or participating in.
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
      take: 5,
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

  res.json({
    upcomingSessions,
    recentGroups,
    unreadNotifications,
    stats: {
      totalSessions,
      upcomingCount: upcomingSessions.length,
      groupCount: groups.length,
    },
  });
};
