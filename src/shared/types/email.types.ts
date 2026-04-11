/**
 * Email-related TypeScript interfaces based on Prisma schema
 */

// Enums for type safety
export enum EmailQueueStatus {
  pending = 'pending',
  sent = 'sent',
  failed = 'failed',
  retry = 'retry',
}

// Email Preference
export interface EmailPreference {
  id: string;
  userId: string;
  sessionInvites: boolean;
  sessionReminders: boolean;
  sessionUpdates: boolean;
  sessionCancellations: boolean;
  groupInvites: boolean;
  commentMentions: boolean;
  nearbyTeamUps: boolean;
  muteSessionInvites: boolean;
  muteSessionReminders: boolean;
  muteSessionUpdates: boolean;
  muteSessionCancellations: boolean;
  muteGroupInvites: boolean;
  muteGroupRequests: boolean;
  muteNearbyGroups: boolean;
  muteSessionCreated: boolean;
  muteNearbyTeamUps: boolean;
  pushEnabled: boolean;
  pushSessions: boolean;
  pushGroups: boolean;
  pushTeamUp: boolean;
  pushTournaments: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Update Email Preference data
export interface UpdateEmailPreferenceData {
  sessionInvites?: boolean;
  sessionReminders?: boolean;
  sessionUpdates?: boolean;
  sessionCancellations?: boolean;
  groupInvites?: boolean;
  commentMentions?: boolean;
  nearbyTeamUps?: boolean;
  muteSessionInvites?: boolean;
  muteSessionReminders?: boolean;
  muteSessionUpdates?: boolean;
  muteSessionCancellations?: boolean;
  muteGroupInvites?: boolean;
  muteGroupRequests?: boolean;
  muteNearbyGroups?: boolean;
  muteSessionCreated?: boolean;
  muteNearbyTeamUps?: boolean;
  pushEnabled?: boolean;
  pushSessions?: boolean;
  pushGroups?: boolean;
  pushTeamUp?: boolean;
  pushTournaments?: boolean;
}

// Email Queue
export interface EmailQueue {
  id: string;
  recipient: string;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  templateType?: string | null;
  templateData?: Record<string, unknown> | null;
  status: 'pending' | 'sent' | 'failed' | 'retry';
  attempts: number;
  maxAttempts: number;
  lastError?: string | null;
  createdAt: Date | string;
  scheduledAt: Date | string;
  sentAt?: Date | string | null;
}

// Create Email Queue data
export interface CreateEmailQueueData {
  recipient: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateType?: string;
  templateData?: Record<string, unknown>;
  scheduledAt?: Date | string;
}
