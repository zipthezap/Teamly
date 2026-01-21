/**
 * Mock Event Data
 * Centralized mock data for event testing
 */

export const mockEvent = {
  id: 'event-1',
  title: 'Soccer Match',
  description: 'Friendly soccer match',
  eventType: 'soccer',
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

export const mockEventWithGroup = {
  ...mockEvent,
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

export const mockRecurringEvent = {
  ...mockEvent,
  id: 'event-2',
  title: 'Weekly Basketball',
  eventType: 'basketball',
  isRecurring: true,
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
};

export const mockPastEvent = {
  ...mockEvent,
  id: 'event-3',
  title: 'Past Tennis Match',
  eventType: 'tennis',
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: new Date('2024-01-01T12:00:00Z'),
};

export const mockUpcomingEvent = {
  ...mockEvent,
  id: 'event-4',
  title: 'Future Volleyball',
  eventType: 'volleyball',
  startTime: new Date(Date.now() + 86400000 * 7), // 7 days from now
  endTime: new Date(Date.now() + 86400000 * 7 + 7200000), // 7 days + 2 hours
};

export const mockFullEvent = {
  ...mockEvent,
  id: 'event-5',
  title: 'Full Event',
  maxParticipants: 10,
};

export const mockEventParticipant = {
  id: 'participant-1',
  eventId: 'event-1',
  userId: 'user-1',
  status: 'confirmed',
  createdAt: new Date('2024-01-01T00:00:00Z'),
};

export const mockEventParticipants = [
  mockEventParticipant,
  {
    id: 'participant-2',
    eventId: 'event-1',
    userId: 'user-2',
    status: 'confirmed',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  },
  {
    id: 'participant-3',
    eventId: 'event-1',
    userId: 'user-3',
    status: 'pending',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  },
];

export const mockEventActivity = [
  {
    id: 'activity-1',
    eventId: 'event-1',
    userId: 'user-1',
    type: 'event_created',
    params: { eventTitle: 'Soccer Match' },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    user: { id: 'user-1', name: 'John Doe' },
  },
  {
    id: 'activity-2',
    eventId: 'event-1',
    userId: 'user-2',
    type: 'participant_joined',
    params: { userName: 'Jane Smith' },
    createdAt: new Date('2024-01-02T00:00:00Z'),
    user: { id: 'user-2', name: 'Jane Smith' },
  },
];

export const mockEvents = [
  mockEvent,
  mockRecurringEvent,
  mockPastEvent,
  mockUpcomingEvent,
  mockFullEvent,
];
