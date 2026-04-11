/**
 * Mock Session Data
 * Centralized mock data for session testing
 */

export const mockSession = {
  id: 'session-1',
  title: 'Soccer Match',
  description: 'Friendly soccer match',
  sessionType: 'soccer',
  location: 'Central Park',
  startTime: new Date('2024-02-01T10:00:00Z'),
  endTime: new Date('2024-02-01T12:00:00Z'),
  maxParticipants: 20,
  creatorId: 'user-1',
  groupId: 'group-1',
  isRecurring: false,
  recurrenceRule: null,
  archived: false,
  visibility: 'public',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

export const mockSessionWithGroup = {
  ...mockSession,
  group: {
    id: 'group-1',
    name: 'Soccer Enthusiasts',
    members: [
      { userId: 'user-1', role: 'admin' },
      { userId: 'user-2', role: 'member' },
      { userId: 'user-3', role: 'member' },
    ],
  },
};

export const mockRecurringSession = {
  ...mockSession,
  id: 'session-2',
  title: 'Weekly Basketball',
  sessionType: 'basketball',
  isRecurring: true,
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
};

export const mockPastSession = {
  ...mockSession,
  id: 'session-3',
  title: 'Past Tennis Match',
  sessionType: 'tennis',
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: new Date('2024-01-01T12:00:00Z'),
};

export const mockUpcomingSession = {
  ...mockSession,
  id: 'session-4',
  title: 'Future Volleyball',
  sessionType: 'volleyball',
  startTime: new Date('2024-03-01T10:00:00Z'), // Fixed future date
  endTime: new Date('2024-03-01T12:00:00Z'), // 2 hours later
};

export const mockFullSession = {
  ...mockSession,
  id: 'session-5',
  title: 'Full Session',
  maxParticipants: 10,
};

export const mockSessionParticipant = {
  id: 'participant-1',
  sessionId: 'session-1',
  userId: 'user-1',
  status: 'confirmed',
  createdAt: new Date('2024-01-01T00:00:00Z'),
};

export const mockSessionParticipants = [
  mockSessionParticipant,
  {
    id: 'participant-2',
    sessionId: 'session-1',
    userId: 'user-2',
    status: 'confirmed',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  },
  {
    id: 'participant-3',
    sessionId: 'session-1',
    userId: 'user-3',
    status: 'pending',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  },
];

export const mockSessionActivity = [
  {
    id: 'activity-1',
    sessionId: 'session-1',
    userId: 'user-1',
    type: 'session_created',
    params: { sessionTitle: 'Soccer Match' },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    user: { id: 'user-1', name: 'John Doe' },
  },
  {
    id: 'activity-2',
    sessionId: 'session-1',
    userId: 'user-2',
    type: 'participant_joined',
    params: { userName: 'Jane Smith' },
    createdAt: new Date('2024-01-02T00:00:00Z'),
    user: { id: 'user-2', name: 'Jane Smith' },
  },
];

export const mockSessions = [
  mockSession,
  mockRecurringSession,
  mockPastSession,
  mockUpcomingSession,
  mockFullSession,
];
