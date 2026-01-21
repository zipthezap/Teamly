/**
 * Additional Event Service Tests
 * Extended test coverage for event management
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import prisma from '../../config/database';
import {
  mockEvent,
  mockEventWithGroup,
  mockRecurringEvent,
  mockEventParticipants,
  mockEventActivity,
} from '../__mocks__/mockData';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    event: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    eventParticipant: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    eventActivity: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    groupMember: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Event Service - Extended Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Creation', () => {
    it('should create event with all required fields', async () => {
      vi.mocked(prisma.event.create).mockResolvedValueOnce(mockEvent as any);

      const result = await prisma.event.create({
        data: {
          title: mockEvent.title,
          description: mockEvent.description,
          eventType: mockEvent.eventType,
          location: mockEvent.location,
          startTime: mockEvent.startTime,
          creatorId: mockEvent.creatorId,
          groupId: mockEvent.groupId,
        },
      });

      expect(result).toEqual(mockEvent);
      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: mockEvent.title,
            eventType: mockEvent.eventType,
          }),
        })
      );
    });

    it('should create recurring event with recurrence rule', async () => {
      vi.mocked(prisma.event.create).mockResolvedValueOnce(mockRecurringEvent as any);

      const result = await prisma.event.create({
        data: {
          title: mockRecurringEvent.title,
          isRecurring: true,
          recurrenceRule: mockRecurringEvent.recurrenceRule,
          eventType: mockRecurringEvent.eventType,
          startTime: mockRecurringEvent.startTime,
          creatorId: mockRecurringEvent.creatorId,
          groupId: mockRecurringEvent.groupId,
        },
      });

      expect(result.isRecurring).toBe(true);
      expect(result.recurrenceRule).toBe('FREQ=WEEKLY;BYDAY=MO');
    });

    it('should create event with max participants limit', async () => {
      const eventWithLimit = { ...mockEvent, maxParticipants: 20 };
      vi.mocked(prisma.event.create).mockResolvedValueOnce(eventWithLimit as any);

      const result = await prisma.event.create({
        data: {
          ...mockEvent,
          maxParticipants: 20,
        },
      });

      expect(result.maxParticipants).toBe(20);
    });

    it('should create public event', async () => {
      const publicEvent = { ...mockEvent, visibility: 'public' };
      vi.mocked(prisma.event.create).mockResolvedValueOnce(publicEvent as any);

      const result = await prisma.event.create({
        data: {
          ...mockEvent,
          visibility: 'public',
        },
      });

      expect(result.visibility).toBe('public');
    });

    it('should create private event', async () => {
      const privateEvent = { ...mockEvent, visibility: 'private' };
      vi.mocked(prisma.event.create).mockResolvedValueOnce(privateEvent as any);

      const result = await prisma.event.create({
        data: {
          ...mockEvent,
          visibility: 'private',
        },
      });

      expect(result.visibility).toBe('private');
    });
  });

  describe('Event Updates', () => {
    it('should update event title', async () => {
      const updatedEvent = { ...mockEvent, title: 'Updated Soccer Match' };
      vi.mocked(prisma.event.update).mockResolvedValueOnce(updatedEvent as any);

      const result = await prisma.event.update({
        where: { id: mockEvent.id },
        data: { title: 'Updated Soccer Match' },
      });

      expect(result.title).toBe('Updated Soccer Match');
    });

    it('should update event time', async () => {
      const newStartTime = new Date('2024-02-02T10:00:00Z');
      const updatedEvent = { ...mockEvent, startTime: newStartTime };
      vi.mocked(prisma.event.update).mockResolvedValueOnce(updatedEvent as any);

      const result = await prisma.event.update({
        where: { id: mockEvent.id },
        data: { startTime: newStartTime },
      });

      expect(result.startTime).toEqual(newStartTime);
    });

    it('should update event location', async () => {
      const updatedEvent = { ...mockEvent, location: 'Riverside Park' };
      vi.mocked(prisma.event.update).mockResolvedValueOnce(updatedEvent as any);

      const result = await prisma.event.update({
        where: { id: mockEvent.id },
        data: { location: 'Riverside Park' },
      });

      expect(result.location).toBe('Riverside Park');
    });

    it('should update max participants', async () => {
      const updatedEvent = { ...mockEvent, maxParticipants: 30 };
      vi.mocked(prisma.event.update).mockResolvedValueOnce(updatedEvent as any);

      const result = await prisma.event.update({
        where: { id: mockEvent.id },
        data: { maxParticipants: 30 },
      });

      expect(result.maxParticipants).toBe(30);
    });

    it('should archive event', async () => {
      const archivedEvent = { ...mockEvent, archived: true };
      vi.mocked(prisma.event.update).mockResolvedValueOnce(archivedEvent as any);

      const result = await prisma.event.update({
        where: { id: mockEvent.id },
        data: { archived: true },
      });

      expect(result.archived).toBe(true);
    });
  });

  describe('Event Participant Management', () => {
    it('should add participant to event', async () => {
      const participant = mockEventParticipants[0];
      vi.mocked(prisma.eventParticipant.create).mockResolvedValueOnce(participant as any);

      const result = await prisma.eventParticipant.create({
        data: {
          eventId: participant.eventId,
          userId: participant.userId,
          status: participant.status,
        },
      });

      expect(result).toEqual(participant);
    });

    it('should list all event participants', async () => {
      vi.mocked(prisma.eventParticipant.findMany).mockResolvedValueOnce(mockEventParticipants as any);

      const result = await prisma.eventParticipant.findMany({
        where: { eventId: 'event-1' },
      });

      expect(result).toHaveLength(3);
      expect(result).toEqual(mockEventParticipants);
    });

    it('should count confirmed participants', async () => {
      vi.mocked(prisma.eventParticipant.count).mockResolvedValueOnce(2);

      const count = await prisma.eventParticipant.count({
        where: { eventId: 'event-1', status: 'confirmed' },
      });

      expect(count).toBe(2);
    });

    it('should update participant status', async () => {
      const updatedParticipant = { ...mockEventParticipants[2], status: 'confirmed' };
      vi.mocked(prisma.eventParticipant.update).mockResolvedValueOnce(updatedParticipant as any);

      const result = await prisma.eventParticipant.update({
        where: { id: 'participant-3' },
        data: { status: 'confirmed' },
      });

      expect(result.status).toBe('confirmed');
    });

    it('should remove participant from event', async () => {
      vi.mocked(prisma.eventParticipant.delete).mockResolvedValueOnce(mockEventParticipants[0] as any);

      const result = await prisma.eventParticipant.delete({
        where: { id: 'participant-1' },
      });

      expect(result).toEqual(mockEventParticipants[0]);
    });
  });

  describe('Event Activity Tracking', () => {
    it('should create activity record', async () => {
      const activity = mockEventActivity[0];
      vi.mocked(prisma.eventActivity.create).mockResolvedValueOnce(activity as any);

      const result = await prisma.eventActivity.create({
        data: {
          eventId: activity.eventId,
          userId: activity.userId,
          type: activity.type,
          params: activity.params,
        },
      });

      expect(result).toEqual(activity);
    });

    it('should fetch event activity with user details', async () => {
      vi.mocked(prisma.eventActivity.findMany).mockResolvedValueOnce(mockEventActivity as any);

      const result = await prisma.eventActivity.findMany({
        where: { eventId: 'event-1' },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].user).toBeDefined();
    });

    it('should filter activity by type', async () => {
      const filteredActivity = mockEventActivity.filter(a => a.type === 'event_created');
      vi.mocked(prisma.eventActivity.findMany).mockResolvedValueOnce(filteredActivity as any);

      const result = await prisma.eventActivity.findMany({
        where: { eventId: 'event-1', type: 'event_created' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('event_created');
    });
  });

  describe('Event Queries', () => {
    it('should find event by ID', async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValueOnce(mockEvent as any);

      const result = await prisma.event.findUnique({
        where: { id: mockEvent.id },
      });

      expect(result).toEqual(mockEvent);
    });

    it('should find events by group ID', async () => {
      const groupEvents = [mockEvent, mockRecurringEvent];
      vi.mocked(prisma.event.findMany).mockResolvedValueOnce(groupEvents as any);

      const result = await prisma.event.findMany({
        where: { groupId: 'group-1' },
      });

      expect(result).toHaveLength(2);
    });

    it('should find events by creator', async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValueOnce([mockEvent] as any);

      const result = await prisma.event.findMany({
        where: { creatorId: 'user-1' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].creatorId).toBe('user-1');
    });

    it('should find upcoming events', async () => {
      const upcomingEvents = [mockEvent, mockRecurringEvent];
      vi.mocked(prisma.event.findMany).mockResolvedValueOnce(upcomingEvents as any);

      const now = new Date();
      const result = await prisma.event.findMany({
        where: {
          startTime: { gte: now },
          archived: false,
        },
        orderBy: { startTime: 'asc' },
      });

      expect(result).toHaveLength(2);
    });

    it('should exclude archived events', async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValueOnce([mockEvent] as any);

      const result = await prisma.event.findMany({
        where: { archived: false },
      });

      expect(result.every(e => !e.archived)).toBe(true);
    });

    it('should find events by type', async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValueOnce([mockEvent] as any);

      const result = await prisma.event.findMany({
        where: { eventType: 'soccer' },
      });

      expect(result.every(e => e.eventType === 'soccer')).toBe(true);
    });
  });

  describe('Event Deletion', () => {
    it('should delete event', async () => {
      vi.mocked(prisma.event.delete).mockResolvedValueOnce(mockEvent as any);

      const result = await prisma.event.delete({
        where: { id: mockEvent.id },
      });

      expect(result).toEqual(mockEvent);
    });

    it('should soft delete event by archiving', async () => {
      const archivedEvent = { ...mockEvent, archived: true };
      vi.mocked(prisma.event.update).mockResolvedValueOnce(archivedEvent as any);

      const result = await prisma.event.update({
        where: { id: mockEvent.id },
        data: { archived: true },
      });

      expect(result.archived).toBe(true);
    });
  });
});
