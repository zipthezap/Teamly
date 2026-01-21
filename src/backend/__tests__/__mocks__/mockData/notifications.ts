/**
 * Mock Notification Data
 * Centralized mock data for notification testing
 */

export const mockEventNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'event_created',
  params: { eventTitle: 'Soccer Match' },
  read: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  eventId: 'event-1',
  event: {
    id: 'event-1',
    title: 'Soccer Match',
    startTime: new Date('2024-02-01T10:00:00Z'),
  },
  user: {
    id: 'user-2',
    name: 'John Doe',
  },
};

export const mockEventNotifications = [
  mockEventNotification,
  {
    id: 'notif-2',
    userId: 'user-1',
    type: 'event_updated',
    params: { eventTitle: 'Soccer Match', changes: ['time'] },
    read: false,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    eventId: 'event-1',
    event: {
      id: 'event-1',
      title: 'Soccer Match',
      startTime: new Date('2024-02-01T10:00:00Z'),
    },
    user: {
      id: 'user-2',
      name: 'John Doe',
    },
  },
  {
    id: 'notif-3',
    userId: 'user-1',
    type: 'event_cancelled',
    params: { eventTitle: 'Tennis Match' },
    read: true,
    createdAt: new Date('2024-01-03T00:00:00Z'),
    eventId: 'event-2',
    event: {
      id: 'event-2',
      title: 'Tennis Match',
      startTime: new Date('2024-02-02T10:00:00Z'),
    },
    user: {
      id: 'user-3',
      name: 'Jane Smith',
    },
  },
];

export const mockGroupNotification = {
  id: 'notif-4',
  userId: 'user-1',
  type: 'group_invite',
  params: { groupName: 'Soccer Enthusiasts' },
  read: false,
  createdAt: new Date('2024-01-04T00:00:00Z'),
  groupId: 'group-1',
  group: {
    id: 'group-1',
    name: 'Soccer Enthusiasts',
  },
};

export const mockGroupNotifications = [
  mockGroupNotification,
  {
    id: 'notif-5',
    userId: 'user-1',
    type: 'join_request',
    params: { userName: 'Bob Johnson' },
    read: false,
    createdAt: new Date('2024-01-05T00:00:00Z'),
    groupId: 'group-1',
    group: {
      id: 'group-1',
      name: 'Soccer Enthusiasts',
    },
  },
  {
    id: 'notif-6',
    userId: 'user-1',
    type: 'member_added',
    params: { userName: 'Alice Brown' },
    read: true,
    createdAt: new Date('2024-01-06T00:00:00Z'),
    groupId: 'group-1',
    group: {
      id: 'group-1',
      name: 'Soccer Enthusiasts',
    },
  },
];

export const mockTeamUpNotification = {
  id: 'notif-7',
  userId: 'user-1',
  type: 'teamup_request',
  params: { teamUpTitle: 'Looking for Tennis Partner' },
  read: false,
  createdAt: new Date('2024-01-07T00:00:00Z'),
  teamUpId: 'teamup-1',
};

export const mockTeamUpNotifications = [
  mockTeamUpNotification,
  {
    id: 'notif-8',
    userId: 'user-1',
    type: 'teamup_match',
    params: { teamUpTitle: 'Basketball Game' },
    read: false,
    createdAt: new Date('2024-01-08T00:00:00Z'),
    teamUpId: 'teamup-2',
  },
];

export const mockTournamentNotification = {
  id: 'notif-9',
  userId: 'user-1',
  type: 'tournament_invite',
  params: { tournamentName: 'Summer Championship' },
  read: false,
  createdAt: new Date('2024-01-09T00:00:00Z'),
  tournamentId: 'tournament-1',
};

export const mockTournamentNotifications = [
  mockTournamentNotification,
  {
    id: 'notif-10',
    userId: 'user-1',
    type: 'tournament_started',
    params: { tournamentName: 'Summer Championship' },
    read: false,
    createdAt: new Date('2024-01-10T00:00:00Z'),
    tournamentId: 'tournament-1',
  },
];

export const mockAllNotifications = [
  ...mockEventNotifications,
  ...mockGroupNotifications,
  ...mockTeamUpNotifications,
  ...mockTournamentNotifications,
];

export const mockUnreadNotifications = mockAllNotifications.filter(n => !n.read);

export const mockReadNotifications = mockAllNotifications.filter(n => n.read);

export const mockBulkNotifications = Array.from({ length: 100 }, (_, i) => {
  // Use day within valid range (1-28 to work for all months)
  const day = (i % 28) + 1;
  const hour = i % 24;
  const minute = (i * 13) % 60; // Vary minutes for better distribution
  
  return {
    id: `notif-bulk-${i}`,
    userId: 'user-1',
    type: 'event_created',
    params: { eventTitle: `Event ${i}` },
    read: false,
    createdAt: new Date(`2024-01-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00Z`),
    eventId: `event-${i}`,
  };
});
