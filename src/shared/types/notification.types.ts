/**
 * Notification-related TypeScript interfaces based on Prisma schema
 */

import { PublicUser } from './user.types';

// Base notification interface
export interface BaseNotification {
  id: string;
  userId: string;
  type: string;
  params?: Record<string, unknown> | null;
  createdAt: Date | string;
  read: boolean;
  user?: PublicUser;
}

// Combined notification type for unified notification fetching
export type Notification = SessionNotification | GroupNotification | TeamUpNotification;

// Re-export from their respective files for convenience
export interface SessionNotification extends BaseNotification {
  sessionId: string;
  type: 'join' | 'leave' | 'late' | 'confirmed' | 'declined' | 'status_change' | 'comment' | 'session_updated' | 'session_cancelled';
  metadata?: Record<string, unknown> | null;
}

export interface GroupNotification extends BaseNotification {
  groupId: string;
  type: 'accepted' | 'invited' | 'join_request' | 'session_created' | 'nearby_created' | 'removed';
}

export interface TeamUpNotification extends BaseNotification {
  teamUpRequestId: string;
  type: 'teamup_response' | 'teamup_accepted' | 'teamup_declined' | 'teamup_nearby';
  metadata?: Record<string, unknown> | null;
}

// Notification query parameters
export interface NotificationQueryParams {
  includeRead?: boolean;
  limit?: number;
  offset?: number;
  type?: string;
  notificationType?: 'session' | 'group' | 'teamup' | 'tournament';
  startDate?: string;
  endDate?: string;
}

// Notification stats
export interface NotificationStats {
  unreadCount: number;
  totalCount: number;
  byType: {
    session: number;
    group: number;
    teamup: number;
  };
}
