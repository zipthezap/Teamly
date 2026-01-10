/**
 * Email-related TypeScript interfaces based on Prisma schema
 */

// Email Preference
export interface EmailPreference {
  id: string;
  userId: string;
  eventInvites: boolean;
  eventReminders: boolean;
  eventUpdates: boolean;
  eventCancellations: boolean;
  groupInvites: boolean;
  commentMentions: boolean;
  nearbyTeamUps: boolean;
  muteEventInvites: boolean;
  muteEventReminders: boolean;
  muteEventUpdates: boolean;
  muteEventCancellations: boolean;
  muteGroupInvites: boolean;
  muteGroupRequests: boolean;
  muteNearbyGroups: boolean;
  muteEventCreated: boolean;
  muteNearbyTeamUps: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Update Email Preference data
export interface UpdateEmailPreferenceData {
  eventInvites?: boolean;
  eventReminders?: boolean;
  eventUpdates?: boolean;
  eventCancellations?: boolean;
  groupInvites?: boolean;
  commentMentions?: boolean;
  nearbyTeamUps?: boolean;
  muteEventInvites?: boolean;
  muteEventReminders?: boolean;
  muteEventUpdates?: boolean;
  muteEventCancellations?: boolean;
  muteGroupInvites?: boolean;
  muteGroupRequests?: boolean;
  muteNearbyGroups?: boolean;
  muteEventCreated?: boolean;
  muteNearbyTeamUps?: boolean;
}

// Email Queue
export interface EmailQueue {
  id: string;
  recipient: string;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  templateType?: string | null;
  templateData?: Record<string, any> | null;
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
  templateData?: Record<string, any>;
  scheduledAt?: Date | string;
}
