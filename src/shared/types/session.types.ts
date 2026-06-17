export enum SessionNotificationType {
  join = 'join',
  leave = 'leave',
  late = 'late',
  confirmed = 'confirmed',
  declined = 'declined',
  status_change = 'status_change',
  comment = 'comment',
  session_updated = 'session_updated',
  session_cancelled = 'session_cancelled',
}

export enum GroupNotificationType {
  accepted = 'accepted',
  invited = 'invited',
  join_request = 'join_request',
  session_created = 'session_created',
  nearby_created = 'nearby_created',
  removed = 'removed',
}

export enum TeamUpNotificationType {
  teamup_response = 'teamup_response',
  teamup_accepted = 'teamup_accepted',
  teamup_declined = 'teamup_declined',
  teamup_nearby = 'teamup_nearby',
  teamup_comment = 'teamup_comment',
}
export enum SessionParticipantStatus {
  pending = 'pending',
  confirmed = 'confirmed',
  declined = 'declined',
  waitlisted = 'waitlisted',
  co_organizer = 'co_organizer',
}

// Guest participants share the same status values as regular session participants.
// Export a runtime alias so existing code using `GuestParticipantStatus` keeps working
// but avoids duplicating enum definitions or diverging values.
export const GuestParticipantStatus = SessionParticipantStatus;
export type GuestParticipantStatus = SessionParticipantStatus;

export enum SessionRequestStatus {
  voting = 'voting',
  finalized = 'finalized',
  cancelled = 'cancelled',
  expired = 'expired',
}

export enum SessionAttendanceStatus {
  on_time = 'on_time',
  late = 'late',
}

/**
 * Event-related TypeScript interfaces based on Prisma schema
 */

import { PublicUser } from './user.types';
import { Group } from './group.types';

export enum SessionStatus {
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

export interface Session {
  id: string;
  title: string;
  description?: string | null;
  sessionType: SportType;
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
  status: SessionStatus;
  isPublic: boolean;
  inviteToken?: string | null;

  // Recurring event fields
  isRecurring: boolean;
  recurrenceRule?: string | null;
  recurrenceEnd?: Date | string | null;
  parentSessionId?: string | null;
  exceptionDates?: string[] | null;

  creatorId: string;
  groupId: string;
  
  // Legacy alias for startTime
  date?: Date | string;
}

export interface SessionWithDetails extends Session {
  creator?: PublicUser;
  group?: Group;
  participants?: SessionParticipant[];
  guestParticipants?: GuestParticipant[];
  sessionAttendances?: SessionAttendance[];
  sessionNotifications?: Array<{
    id: string;
    type: string;
    userId: string;
    user?: PublicUser;
    createdAt: Date | string;
  }>;
  _count?: {
    participants: number;
    guestParticipants: number;
    comments: number;
  };
  /** The requesting user's role in the event's group (populated by the list endpoint) */
  userGroupRole?: string | null;
}

// Event Participant
export interface SessionParticipant {
  id: string;
  status: SessionParticipantStatus;
  joinedAt: Date | string;
  sessionId: string;
  userId: string;
  user?: PublicUser;
  session?: Session;
}

// Guest Participant
export interface GuestParticipant {
  id: string;
  name: string;
  status: GuestParticipantStatus;
  joinedAt: Date | string;
  sessionId: string;
}

// Event Attendance
export interface SessionAttendance {
  id: string;
  sessionId: string;
  userId: string;
  status: 'on-time' | 'late';
  updatedAt: Date | string;
  session?: Session;
  user?: PublicUser;
}

// Event Reminder
export interface SessionReminder {
  id: string;
  sessionId: string;
  userId: string;
  remindAt: Date | string;
  sent: boolean;
  session?: Session;
  user?: PublicUser;
  // Composite key: [sessionId, userId, remindAt]
}

// Event Request (voting system)
export interface SessionRequest {
  id: string;
  title: string;
  description?: string | null;
  sessionType: string;
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
  finalizedSessionId?: string | null;
}

// Event Request with relations
export interface SessionRequestWithDetails extends SessionRequest {
  creator?: PublicUser;
  group?: Group;
  votes?: SessionVote[];
  yesVotes?: number;  // Computed field from backend
  noVotes?: number;   // Computed field from backend
  _count?: {
    votes: number;
  };
}

// Event Vote
export interface SessionVote {
  id: string;
  vote: 'yes' | 'no';
  createdAt: Date | string;
  sessionRequestId: string;
  userId: string;
  user?: PublicUser;
}

// Create Event data
export interface CreateSessionData {
  groupId: string;
  title: string;
  description?: string;
  sessionType: string;
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
export interface UpdateSessionData {
  title?: string;
  description?: string;
  sessionType?: string;
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
export interface SessionSearchParams {
  groupId?: string;
  search?: string;
  sessionType?: string;
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
export interface CreateSessionRequestData {
  groupId: string;
  title: string;
  description?: string;
  sessionType: string;
  location?: string;
  startTime: Date | string;
  endTime?: Date | string;
  maxPlayers?: number;
  voteDeadline?: Date | string;
  voteThreshold?: number;
}
