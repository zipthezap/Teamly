export enum EventNotificationType {
  join = 'join',
  leave = 'leave',
  late = 'late',
  confirmed = 'confirmed',
  declined = 'declined',
  status_change = 'status_change',
  comment = 'comment',
  event_updated = 'event_updated',
  event_cancelled = 'event_cancelled',
}

export enum GroupNotificationType {
  accepted = 'accepted',
  invited = 'invited',
  join_request = 'join_request',
  event_created = 'event_created',
  nearby_created = 'nearby_created',
}

export enum TeamUpNotificationType {
  teamup_response = 'teamup_response',
  teamup_accepted = 'teamup_accepted',
  teamup_declined = 'teamup_declined',
  teamup_nearby = 'teamup_nearby',
}
export enum EventParticipantStatus {
  pending = 'pending',
  confirmed = 'confirmed',
  declined = 'declined',
}

export enum GuestParticipantStatus {
  confirmed = 'confirmed',
  declined = 'declined',
}
/**
 * Event-related TypeScript interfaces based on Prisma schema
 */

import { PublicUser } from './user.types';
import { Group } from './group.types';

export enum EventStatus {
  upcoming = 'upcoming',
  ongoing = 'ongoing',
  completed = 'completed',
  cancelled = 'cancelled',
}

export enum SportType {
  football = 'football',
  basketball = 'basketball',
  tennis = 'tennis',
  volleyball = 'volleyball',
  running = 'running',
  cycling = 'cycling',
  swimming = 'swimming',
  cricket = 'cricket',
  americanFootball = 'americanFootball',
  iceHockey = 'iceHockey',
  baseball = 'baseball',
  rugby = 'rugby',
  handball = 'handball',
  fieldHockey = 'fieldHockey',
  other = 'other',
}

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  eventType: SportType;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  city?: string | null;
  country?: string | null;
  startTime: Date | string;
  endTime?: Date | string | null;
  maxPlayers?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  archived: boolean;
  status: EventStatus;
  isPublic: boolean;
  inviteToken?: string | null;

  // Recurring event fields
  isRecurring: boolean;
  recurrenceRule?: string | null;
  recurrenceEnd?: Date | string | null;
  parentEventId?: string | null;
  exceptionDates?: any | null;

  creatorId: string;
  groupId: string;
}

export interface EventWithDetails extends Event {
  creator?: PublicUser;
  group?: Group;
  participants?: EventParticipant[];
  guestParticipants?: GuestParticipant[];
  _count?: {
    participants: number;
    guestParticipants: number;
    comments: number;
  };
}

// Event Participant
export interface EventParticipant {
  id: string;
  status: EventParticipantStatus;
  joinedAt: Date | string;
  eventId: string;
  userId: string;
  user?: PublicUser;
  event?: Event;
}

// Guest Participant
export interface GuestParticipant {
  id: string;
  name: string;
  status: GuestParticipantStatus;
  joinedAt: Date | string;
  eventId: string;
}

// Event Attendance
export interface EventAttendance {
  id: string;
  eventId: string;
  userId: string;
  status: 'on-time' | 'late';
  updatedAt: Date | string;
  event?: Event;
  user?: PublicUser;
}

// Event Reminder
export interface EventReminder {
  id: string;
  eventId: string;
  userId: string;
  remindAt: Date | string;
  sent: boolean;
  event?: Event;
  user?: PublicUser;
  // Composite key: [eventId, userId, remindAt]
}

// Event Request (voting system)
export interface EventRequest {
  id: string;
  title: string;
  description?: string | null;
  eventType: string;
  location?: string | null;
  startTime: Date | string;
  endTime?: Date | string | null;
  maxPlayers?: number | null;
  createdAt: Date | string;
  status: 'voting' | 'finalized' | 'cancelled' | 'expired';
  voteDeadline?: Date | string | null;
  voteThreshold?: number | null;
  creatorId: string;
  groupId: string;
  finalizedEventId?: string | null;
}

// Event Request with relations
export interface EventRequestWithDetails extends EventRequest {
  creator?: PublicUser;
  group?: Group;
  votes?: EventVote[];
  _count?: {
    votes: number;
  };
}

// Event Vote
export interface EventVote {
  id: string;
  vote: 'yes' | 'no';
  createdAt: Date | string;
  eventRequestId: string;
  userId: string;
  user?: PublicUser;
}

// Create Event data
export interface CreateEventData {
  groupId: string;
  title: string;
  description?: string;
  eventType: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  startTime: Date | string;
  endTime?: Date | string;
  maxPlayers?: number;
  isPublic?: boolean;
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceEnd?: Date | string;
}

// Update Event data
export interface UpdateEventData {
  title?: string;
  description?: string;
  eventType?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  startTime?: Date | string;
  endTime?: Date | string;
  maxPlayers?: number;
  status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  isPublic?: boolean;
}

// Event search/filter params
export interface EventSearchParams {
  groupId?: string;
  search?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  city?: string;
  country?: string;
  status?: string;
  offset?: number;
  limit?: number;
}

// Create Event Request data
export interface CreateEventRequestData {
  groupId: string;
  title: string;
  description?: string;
  eventType: string;
  location?: string;
  startTime: Date | string;
  endTime?: Date | string;
  maxPlayers?: number;
  voteDeadline?: Date | string;
  voteThreshold?: number;
}
