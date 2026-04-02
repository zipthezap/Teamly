/**
 * Event Service Tests
 * Tests for event management business logic
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  sanitizeEventData,
  sanitizeGuestName,
  validateEventTimes,
  validateRecurrence,
  determineEventStatus,
  buildEventFilters,
  canModifyEvent,
  checkEventManagementPermission,
  isEventFull,
  getParticipant,
  getEventById,
  getGroupWithMembers,
  createEventNotifications,
  createEventUpdateNotifications,
  createEventDeletionNotifications,
  sendEventEmailNotifications
} from '../../services/eventService';
import prisma from '../../config/database';
import { EventParticipantStatus } from '../../../shared/types/event.types';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    event: {
      findUnique: vi.fn(),
    },
    group: {
      findUnique: vi.fn(),
    },
    groupMember: {
      findFirst: vi.fn(),
    },
    eventParticipant: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    groupNotification: {
      createMany: vi.fn(),
    },
    eventNotification: {
      createMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../../utils/validation', () => ({
  sanitizeString: vi.fn((str: string) => str.trim()),
}));

vi.mock('../../utils/recurrenceService', () => ({
  validateRecurrenceRule: vi.fn((rule: string) => rule.includes('FREQ=')),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../utils/emailService', () => ({
  sendEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../utils/notificationHelper', () => ({
  filterUnmutedUsers: vi.fn((ids: string[]) => Promise.resolve(ids)),
  batchShouldSendEmailNotification: vi.fn((ids: string[]) => 
    Promise.resolve(new Map(ids.map(id => [id, true])))
  ),
}));

vi.mock('../../services/permissionService', () => ({
  permissionService: {
    hasGroupPermission: vi.fn(() => Promise.resolve(false)),
  },
}));

describe('Event Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeEventData', () => {
    it('should sanitize all string fields', () => {
      const result = sanitizeEventData({
        title: '  Test Event  ',
        description: '  Test description  ',
        eventType: '  soccer  ',
        location: '  Test Location  ',
      });

      expect(result.title).toBe('Test Event');
      expect(result.description).toBe('Test description');
      expect(result.eventType).toBe('soccer');
      expect(result.location).toBe('Test Location');
    });

    it('should handle undefined fields', () => {
      const result = sanitizeEventData({});

      expect(result.title).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.eventType).toBeUndefined();
      expect(result.location).toBeUndefined();
    });

    it('should handle partial data', () => {
      const result = sanitizeEventData({
        title: '  Test Event  ',
        eventType: '  soccer  ',
      });

      expect(result.title).toBe('Test Event');
      expect(result.eventType).toBe('soccer');
      expect(result.description).toBeUndefined();
      expect(result.location).toBeUndefined();
    });
  });

  describe('sanitizeGuestName', () => {
    it('should sanitize guest name', () => {
      const result = sanitizeGuestName('  John Doe  ');
      expect(result).toBe('John Doe');
    });

    it('should fall back to trimmed name if sanitization results in empty string', async () => {
      const mockSanitize = vi.mocked(await import('../../utils/validation')).sanitizeString;
      mockSanitize.mockReturnValueOnce('');
      
      const result = sanitizeGuestName('  John Doe  ');
      expect(result).toBe('John Doe');
    });
  });

  describe('validateEventTimes', () => {
    it('should return valid true for future start time', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const result = validateEventTimes(futureDate);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid false for past start time', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const result = validateEventTimes(pastDate);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be in the future');
    });

    it('should return valid false if end time is before start time', () => {
      const startDate = new Date(Date.now() + 86400000);
      const endDate = new Date(startDate.getTime() - 3600000);
      
      const result = validateEventTimes(startDate.toISOString(), endDate.toISOString());

      expect(result.valid).toBe(false);
      expect(result.error).toContain('End time must be after start time');
    });

    it('should return valid false if start and end are on different days', () => {
      const startDate = new Date(Date.now() + 86400000);
      const endDate = new Date(startDate.getTime() + 86400000); // Next day
      
      const result = validateEventTimes(startDate.toISOString(), endDate.toISOString());

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be single-day only');
    });

    it('should return valid true for same-day start and end times', () => {
      const startDate = new Date(Date.now() + 86400000);
      const endDate = new Date(startDate.getTime() + 3600000); // 1 hour later
      
      const result = validateEventTimes(startDate.toISOString(), endDate.toISOString());

      expect(result.valid).toBe(true);
    });
  });

  describe('validateRecurrence', () => {
    it('should return valid true for non-recurring events', () => {
      const result = validateRecurrence(false);

      expect(result.valid).toBe(true);
    });

    it('should return valid true for valid recurrence rule', () => {
      const result = validateRecurrence(true, 'FREQ=WEEKLY;BYDAY=MO,WE,FR');

      expect(result.valid).toBe(true);
    });

    it('should return valid false for invalid recurrence rule', () => {
      const result = validateRecurrence(true, 'INVALID_RULE');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid recurrence rule');
    });

    it('should return valid true if recurring but no rule provided', () => {
      const result = validateRecurrence(true);

      expect(result.valid).toBe(true);
    });
  });

  describe('determineEventStatus', () => {
    it('should return "upcoming" for future events', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const status = determineEventStatus(futureDate);

      expect(status).toBe('upcoming');
    });

    it('should return "ongoing" for current events', () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
      const endDate = new Date(now.getTime() + 3600000).toISOString(); // 1 hour from now
      
      const status = determineEventStatus(startDate, endDate);

      expect(status).toBe('ongoing');
    });

    it('should return "completed" for past events', () => {
      const endDate = new Date(Date.now() - 86400000).toISOString();
      const startDate = new Date(Date.now() - 90000000).toISOString();
      
      const status = determineEventStatus(startDate, endDate);

      expect(status).toBe('completed');
    });

    it('should return "upcoming" for events without end time', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const status = determineEventStatus(futureDate);

      expect(status).toBe('upcoming');
    });
  });

  describe('buildEventFilters', () => {
    const userId = 'test-user-id';

    it('should build filters with group ID', () => {
      const filters = buildEventFilters(userId, { groupId: 'test-group-id' });

      expect(filters.groupId).toBe('test-group-id');
    });

    it('should build filters with search term', () => {
      const filters = buildEventFilters(userId, { search: 'soccer' });

      expect(filters.AND).toBeDefined();
    });

    it('should build filters with event type', () => {
      const filters = buildEventFilters(userId, { eventType: 'soccer' });

      expect(filters.eventType).toEqual({ contains: 'soccer', mode: 'insensitive' });
    });

    it('should build filters with date range', () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 86400000).toISOString();
      
      const filters = buildEventFilters(userId, { startDate, endDate });

      expect(filters.startTime).toBeDefined();
    });

    it('should build filters with location', () => {
      const filters = buildEventFilters(userId, { location: 'New York' });

      expect(filters.location).toEqual({ contains: 'New York', mode: 'insensitive' });
    });

    it('should exclude archived events by default', () => {
      const filters = buildEventFilters(userId, {});

      expect(filters.archived).toBe(false);
    });

    it('should include archived events when specified', () => {
      const filters = buildEventFilters(userId, { archived: 'true' });

      expect(filters.archived).toBe(true);
    });

    it('should apply access control filters', () => {
      const filters = buildEventFilters(userId, {});

      expect(filters.OR).toBeDefined();
      expect(Array.isArray(filters.OR)).toBe(true);
    });
  });

  describe('canModifyEvent', () => {
    it('should return true for event creator', () => {
      const event = {
        creatorId: 'user-1',
        group: {
          members: [
            { userId: 'user-2', role: 'member' }
          ]
        }
      };

      const result = canModifyEvent(event, 'user-1');
      expect(result).toBe(true);
    });

    it('should return true for group admin', () => {
      const event = {
        creatorId: 'user-1',
        group: {
          members: [
            { userId: 'user-2', role: 'admin' }
          ]
        }
      };

      const result = canModifyEvent(event, 'user-2');
      expect(result).toBe(true);
    });

    it('should return true for group moderator', () => {
      const event = {
        creatorId: 'user-1',
        group: {
          members: [
            { userId: 'user-2', role: 'moderator' }
          ]
        }
      };

      const result = canModifyEvent(event, 'user-2');
      expect(result).toBe(true);
    });

    it('should return false for regular member', () => {
      const event = {
        creatorId: 'user-1',
        group: {
          members: [
            { userId: 'user-2', role: 'member' }
          ]
        }
      };

      const result = canModifyEvent(event, 'user-2');
      expect(result).toBe(false);
    });

    it('should return false for non-member', () => {
      const event = {
        creatorId: 'user-1',
        group: {
          members: [
            { userId: 'user-2', role: 'member' }
          ]
        }
      };

      const result = canModifyEvent(event, 'user-3');
      expect(result).toBe(false);
    });
  });

  describe('checkEventManagementPermission', () => {
    it('should return authorized true for event creator', async () => {
      const event = {
        id: 'event-1',
        creatorId: 'user-1',
        groupId: 'group-1'
      };

      const result = await checkEventManagementPermission(event, 'user-1');

      expect(result.isAuthorized).toBe(true);
      expect(result.isEventCreator).toBe(true);
    });

    it('should return authorized true for group admin', async () => {
      const { permissionService: mockPermissionService } = await import('../../services/permissionService');
      vi.mocked(mockPermissionService.hasGroupPermission).mockResolvedValueOnce(true);

      const event = {
        id: 'event-1',
        creatorId: 'user-1',
        groupId: 'group-1'
      };

      const result = await checkEventManagementPermission(event, 'user-2');

      expect(result.isAuthorized).toBe(true);
      expect(result.isGroupAdmin).toBe(true);
    });

    it('should return authorized false for null event', async () => {
      const result = await checkEventManagementPermission(null, 'user-1');

      expect(result.isAuthorized).toBe(false);
      expect(result.isEventCreator).toBe(false);
      expect(result.isGroupAdmin).toBe(false);
    });
  });

  describe('getParticipant', () => {
    it('should find participant by event and user ID', async () => {
      const mockParticipant = { id: 'participant-1', eventId: 'event-1', userId: 'user-1' };
      vi.mocked(prisma.eventParticipant.findFirst).mockResolvedValueOnce(mockParticipant as unknown);

      const result = await getParticipant('event-1', 'user-1');

      expect(result).toEqual(mockParticipant);
      expect(prisma.eventParticipant.findFirst).toHaveBeenCalledWith({
        where: { eventId: 'event-1', userId: 'user-1' }
      });
    });

    it('should return null if participant not found', async () => {
      vi.mocked(prisma.eventParticipant.findFirst).mockResolvedValueOnce(null);

      const result = await getParticipant('event-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('isEventFull', () => {
    it('should return false if no max participants limit', async () => {
      const result = await isEventFull('event-1', null);

      expect(result).toBe(false);
    });

    it('should return true if event is at capacity', async () => {
      vi.mocked(prisma.eventParticipant.count).mockResolvedValueOnce(20);

      const result = await isEventFull('event-1', 20);

      expect(result).toBe(true);
      expect(prisma.eventParticipant.count).toHaveBeenCalledWith({
        where: {
          eventId: 'event-1',
          status: EventParticipantStatus.confirmed
        }
      });
    });

    it('should return false if event is not full', async () => {
      vi.mocked(prisma.eventParticipant.count).mockResolvedValueOnce(15);

      const result = await isEventFull('event-1', 20);

      expect(result).toBe(false);
    });
  });

  describe('getEventById', () => {
    it('should retrieve event with full details', async () => {
      const mockEvent = {
        id: 'event-1',
        title: 'Test Event',
        creator: { id: 'user-1', name: 'Creator' },
        group: { id: 'group-1', name: 'Test Group', members: [] },
        participants: [],
        comments: []
      };
      vi.mocked(prisma.event.findUnique).mockResolvedValueOnce(mockEvent as unknown);

      const result = await getEventById('event-1');

      expect(result).toEqual(mockEvent);
      expect(prisma.event.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'event-1' },
          include: expect.any(Object)
        })
      );
    });
  });

  describe('getGroupWithMembers', () => {
    it('should retrieve group with members', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        members: [
          { user: { id: 'user-1', name: 'User 1', email: 'user1@test.com', emailNotifications: true } }
        ]
      };
      vi.mocked(prisma.group.findUnique).mockResolvedValueOnce(mockGroup as unknown);

      const result = await getGroupWithMembers('group-1');

      expect(result).toEqual(mockGroup);
      expect(prisma.group.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'group-1' },
          include: expect.any(Object)
        })
      );
    });
  });

  describe('createEventNotifications', () => {
    it('should create notifications for all members', async () => {
      const { filterUnmutedUsers: mockFilterUnmuted } = await import('../../utils/notificationHelper');
      vi.mocked(mockFilterUnmuted).mockResolvedValueOnce(['user-1', 'user-2']);

      await createEventNotifications(
        'group-1',
        'Test Event',
        'Creator Name',
        'Test Group',
        ['user-1', 'user-2']
      );

      expect(prisma.groupNotification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Array),
          skipDuplicates: true
        })
      );
    });

    it('should not create notifications if no members', async () => {
      await createEventNotifications(
        'group-1',
        'Test Event',
        'Creator Name',
        'Test Group',
        []
      );

      expect(prisma.groupNotification.createMany).not.toHaveBeenCalled();
    });

    it('should not create notifications if all members have muted', async () => {
      const { filterUnmutedUsers: mockFilterUnmuted } = await import('../../utils/notificationHelper');
      vi.mocked(mockFilterUnmuted).mockResolvedValueOnce([]);

      await createEventNotifications(
        'group-1',
        'Test Event',
        'Creator Name',
        'Test Group',
        ['user-1', 'user-2']
      );

      expect(prisma.groupNotification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('createEventUpdateNotifications', () => {
    it('should create update notifications for participants', async () => {
      const { filterUnmutedUsers: mockFilterUnmuted } = await import('../../utils/notificationHelper');
      vi.mocked(mockFilterUnmuted).mockResolvedValueOnce(['user-1', 'user-2']);

      await createEventUpdateNotifications(
        'event-1',
        'Test Event',
        'Updater Name',
        ['user-1', 'user-2']
      );

      expect(prisma.eventNotification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Array),
          skipDuplicates: true
        })
      );
    });

    it('should not create notifications if no participants', async () => {
      await createEventUpdateNotifications(
        'event-1',
        'Test Event',
        'Updater Name',
        []
      );

      expect(prisma.eventNotification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('createEventDeletionNotifications', () => {
    it('should create deletion notifications for participants', async () => {
      const { filterUnmutedUsers: mockFilterUnmuted } = await import('../../utils/notificationHelper');
      vi.mocked(mockFilterUnmuted).mockResolvedValueOnce(['user-1', 'user-2']);
      vi.mocked(prisma.eventNotification.create).mockResolvedValue({} as unknown);

      await createEventDeletionNotifications(
        'event-1',
        'Test Event',
        'Deleter Name',
        ['user-1', 'user-2']
      );

      expect(prisma.eventNotification.create).toHaveBeenCalled();
    });

    it('should not create notifications if no participants', async () => {
      await createEventDeletionNotifications(
        'event-1',
        'Test Event',
        'Deleter Name',
        []
      );

      expect(prisma.eventNotification.create).not.toHaveBeenCalled();
    });
  });

  describe('sendEventEmailNotifications', () => {
    it('should send emails to unmuted participants excluding sender', async () => {
      const { sendEmail: mockSendEmail } = await import('../../utils/emailService');
      const { batchShouldSendEmailNotification: mockBatchNotification } = await import('../../utils/notificationHelper');
      
      vi.mocked(mockBatchNotification).mockResolvedValueOnce(new Map([
        ['user-1', true],
        ['user-2', true]
      ]));

      const participants = [
        { user: { id: 'user-1', name: 'User 1', email: 'user1@test.com' } },
        { user: { id: 'user-2', name: 'User 2', email: 'user2@test.com' } },
        { user: { id: 'sender-id', name: 'Sender', email: 'sender@test.com' } }
      ];

      await sendEventEmailNotifications(
        participants,
        'sender-id',
        'eventUpdates',
        'eventUpdate',
        'Test Event',
        'Test Group'
      );

      expect(mockSendEmail).toHaveBeenCalledTimes(2);
      expect(mockSendEmail).not.toHaveBeenCalledWith(
        'sender@test.com',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should not send emails to muted users', async () => {
      const { sendEmail: mockSendEmail } = await import('../../utils/emailService');
      const { batchShouldSendEmailNotification: mockBatchNotification } = await import('../../utils/notificationHelper');
      
      vi.mocked(mockBatchNotification).mockResolvedValueOnce(new Map([
        ['user-1', false],
        ['user-2', true]
      ]));

      const participants = [
        { user: { id: 'user-1', name: 'User 1', email: 'user1@test.com' } },
        { user: { id: 'user-2', name: 'User 2', email: 'user2@test.com' } }
      ];

      await sendEventEmailNotifications(
        participants,
        'sender-id',
        'eventUpdates',
        'eventUpdate',
        'Test Event',
        'Test Group'
      );

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'user2@test.com',
        'eventUpdate',
        'User 2',
        'Test Event',
        'Test Group'
      );
    });

    it('should handle empty participants list', async () => {
      const { sendEmail: mockSendEmail } = await import('../../utils/emailService');

      await sendEventEmailNotifications(
        [],
        'sender-id',
        'eventUpdates',
        'eventUpdate',
        'Test Event',
        'Test Group'
      );

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe('buildEventFilters - additional edge cases', () => {
    const userId = 'test-user-id';

    it('should handle status filter', () => {
      const filters = buildEventFilters(userId, { status: 'upcoming' });

      expect(filters.status).toBe('upcoming');
    });

    it('should handle multiple filters combined', () => {
      const filters = buildEventFilters(userId, {
        groupId: 'group-1',
        eventType: 'soccer',
        location: 'New York',
        archived: 'false'
      });

      expect(filters.groupId).toBe('group-1');
      expect(filters.eventType).toEqual({ contains: 'soccer', mode: 'insensitive' });
      expect(filters.location).toEqual({ contains: 'New York', mode: 'insensitive' });
      expect(filters.archived).toBe(false);
    });

    it('should handle empty search term', () => {
      const filters = buildEventFilters(userId, { search: '' });

      // Should not add search filter for empty string
      expect(filters.AND).toBeUndefined();
    });
  });

  describe('validateEventTimes - additional edge cases', () => {
    it('should handle very short events (less than 1 hour)', () => {
      const startDate = new Date(Date.now() + 86400000);
      const endDate = new Date(startDate.getTime() + 1800000); // 30 minutes later
      
      const result = validateEventTimes(startDate.toISOString(), endDate.toISOString());

      expect(result.valid).toBe(true);
    });

    it('should handle events at exact midnight boundary', () => {
      const startDate = new Date();
      startDate.setHours(23, 0, 0, 0);
      startDate.setDate(startDate.getDate() + 1); // Tomorrow at 11 PM
      
      const endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999); // Same day, before midnight
      
      const result = validateEventTimes(startDate.toISOString(), endDate.toISOString());

      expect(result.valid).toBe(true);
    });
  });
});
