/**
 * Test Helper Utilities
 * Provides common utilities for testing
 */

import { vi } from 'vitest';

/**
 * Mock Prisma client for testing
 */
export const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  group: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  userSession: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  refreshToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  revokedToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  notification: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  tournament: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  tournamentTeam: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  tournamentPlayer: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  tournamentMatch: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  league: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  leagueTeam: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  leagueStanding: {
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  leagueMatch: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  leagueSessionEntry: {
    create: vi.fn(),
  },
  teamUpRequest: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  teamUpResponse: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  comment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  groupMember: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  groupJoinRequest: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  inviteLog: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  sessionRequest: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  groupChat: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  groupMessage: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  sessionAttendance: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  sessionReminder: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  notificationPreference: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  pushDevice: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
  },
  emailQueue: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};

/**
 * Mock user data for testing
 */
export const mockUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  name: 'Test User',
  city: 'Test City',
  country: 'Test Country',
  password: 'hashedPassword123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Mock session data for testing
 */
export const mockEvent = {
  id: 'test-session-id-123',
  name: 'Test Event',
  description: 'Test session description',
  location: 'Test Location',
  date: new Date('2024-12-31'),
  creatorId: 'test-user-id-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Mock group data for testing
 */
export const mockGroup = {
  id: 'test-group-id-123',
  name: 'Test Group',
  description: 'Test group description',
  creatorId: 'test-user-id-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ─── Additional mock fixtures ───────────────────────────────────────────────

export const mockTournament = {
  id: 'test-tournament-id-123',
  title: 'Test Tournament',
  description: 'Test tournament description',
  sport: 'soccer',
  groupId: 'test-group-id-123',
  organizerId: 'test-user-id-123',
  status: 'upcoming',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockLeague = {
  id: 'test-league-id-123',
  title: 'Test League',
  description: 'Test league description',
  sport: 'soccer',
  groupId: 'test-group-id-123',
  creatorId: 'test-user-id-123',
  status: 'upcoming',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-06-30'),
  isPublic: true,
  maxTeams: 8,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockTeamUp = {
  id: 'test-teamup-id-123',
  title: 'Test TeamUp',
  description: 'Need players for a match',
  sport: 'soccer',
  creatorId: 'test-user-id-123',
  groupId: 'test-group-id-123',
  sessionDate: new Date('2025-03-01'),
  location: 'Test Location',
  playersNeeded: 5,
  status: 'open',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockTeamUpResponse = {
  id: 'test-teamup-response-id-123',
  teamUpRequestId: 'test-teamup-id-123',
  userId: 'test-user-id-456',
  status: 'accepted',
  message: 'I am in!',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockComment = {
  id: 'test-comment-id-123',
  content: 'Test comment content',
  authorId: 'test-user-id-123',
  teamUpRequestId: 'test-teamup-id-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockNotification = {
  id: 'test-notification-id-123',
  userId: 'test-user-id-123',
  type: 'session_reminder',
  title: 'Test Notification',
  message: 'You have an upcoming session',
  isRead: false,
  data: {},
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockSessionRequest = {
  id: 'test-session-request-id-123',
  sessionId: 'test-session-id-123',
  userId: 'test-user-id-456',
  status: 'pending',
  message: 'I would like to join',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockGroupChat = {
  id: 'test-group-chat-id-123',
  groupId: 'test-group-id-123',
  name: 'General',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockGroupMessage = {
  id: 'test-group-message-id-123',
  chatId: 'test-group-chat-id-123',
  senderId: 'test-user-id-123',
  content: 'Hello, team!',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockAttendance = {
  id: 'test-attendance-id-123',
  sessionId: 'test-session-id-123',
  userId: 'test-user-id-123',
  status: 'going',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockReminder = {
  id: 'test-reminder-id-123',
  sessionId: 'test-session-id-123',
  userId: 'test-user-id-123',
  remindAt: new Date('2025-01-01T09:00:00Z'),
  sent: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockNotificationPreference = {
  id: 'test-pref-id-123',
  userId: 'test-user-id-123',
  emailEnabled: true,
  pushEnabled: true,
  sessionReminders: true,
  groupUpdates: true,
  tournamentUpdates: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockPushDevice = {
  id: 'test-push-device-id-123',
  userId: 'test-user-id-123',
  token: 'mock-push-token-abc123',
  platform: 'ios',
  active: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ─── Factory helpers ─────────────────────────────────────────────────────────

export function createMockUser(overrides: Partial<typeof mockUser> = {}) {
  return { ...mockUser, ...overrides };
}

export function createMockEvent(overrides: Partial<typeof mockEvent> = {}) {
  return { ...mockEvent, ...overrides };
}

export function createMockGroup(overrides: Partial<typeof mockGroup> = {}) {
  return { ...mockGroup, ...overrides };
}

export function createMockTournament(overrides: Partial<typeof mockTournament> = {}) {
  return { ...mockTournament, ...overrides };
}

export function createMockLeague(overrides: Partial<typeof mockLeague> = {}) {
  return { ...mockLeague, ...overrides };
}

export function createMockTeamUp(overrides: Partial<typeof mockTeamUp> = {}) {
  return { ...mockTeamUp, ...overrides };
}

export function createMockNotification(overrides: Partial<typeof mockNotification> = {}) {
  return { ...mockNotification, ...overrides };
}

export function createMockReminder(overrides: Partial<typeof mockReminder> = {}) {
  return { ...mockReminder, ...overrides };
}

/**
 * Creates a fully-typed Prisma mock factory.
 * Each call returns a fresh set of vi.fn() mocks so tests don't bleed state.
 */
export function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    group: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    groupMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    groupJoinRequest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    inviteLog: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    tournament: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    tournamentTeam: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tournamentPlayer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    tournamentMatch: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    league: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    leagueTeam: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    leagueStanding: {
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    leagueMatch: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leagueSessionEntry: {
      create: vi.fn(),
    },
    teamUpRequest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    teamUpResponse: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    sessionRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    groupChat: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    groupMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    sessionAttendance: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    sessionReminder: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    notificationPreference: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    pushDevice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    emailQueue: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    revokedToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    userSession: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/**
 * Clear all mock calls
 */
export const clearAllMocks = () => {
  Object.values(mockPrisma).forEach((model) => {
    Object.values(model).forEach((method) => {
      if (vi.isMockFunction(method)) {
        method.mockClear();
      }
    });
  });
};

/**
 * Reset all mocks to default state
 */
export const resetAllMocks = () => {
  Object.values(mockPrisma).forEach((model) => {
    Object.values(model).forEach((method) => {
      if (vi.isMockFunction(method)) {
        method.mockReset();
      }
    });
  });
};
