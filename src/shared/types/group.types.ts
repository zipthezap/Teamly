/**
 * Group-related TypeScript interfaces based on Prisma schema
 */

import { PublicUser } from './user.types';

// Main Group interface
export interface Group {
  id: string;
  name: string;
  description?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  isPublic: boolean;
  privacy?: 'public' | 'private'; // Derived from isPublic for backwards compatibility
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  city?: string | null;
  country?: string | null;
  picture?: string | null;
  creatorId: string;
  // Enhanced group settings
  sportType?: string | null;
  maxMembers?: number | null;
  autoApproveJoinRequests?: boolean;
  tags?: string | null;
}

// Group with relations
export interface GroupWithDetails extends Group {
  creator?: PublicUser;
  members?: GroupMember[];
  events?: Array<{ id: string; startTime: Date | string }>;  // Optional for some API responses
  memberCount?: number;  // Legacy/optional field
  eventCount?: number;   // Legacy/optional field
  _count?: {
    members: number;
    events: number;
  };
}

// Group Member
export interface GroupMember {
  id: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt: Date | string;
  userId: string;
  groupId: string;
  user?: PublicUser;
  // Legacy inline fields (when user object not populated)
  name?: string;
  email?: string;
  profilePicture?: string;
  online?: boolean;
}

// Group Join Request
export interface GroupJoinRequest {
  id: string;
  groupId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date | string;
  createdBy?: 'user' | 'invite';
  user?: PublicUser;
  group?: Group;
}

// Group Message (Chat)
export interface GroupMessage {
  id: string;
  content: string;
  createdAt: Date | string;
  userId: string;
  groupId: string;
  user?: PublicUser;
  // Legacy fields for backwards compatibility
  sender?: string;
  time?: string;
  text?: string;
}

// Create Group data
export interface CreateGroupData {
  name: string;
  description?: string;
  isPublic?: boolean;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  sportType?: string;
  maxMembers?: number;
  autoApproveJoinRequests?: boolean;
  tags?: string;
}

// Update Group data
export interface UpdateGroupData {
  name?: string;
  description?: string;
  isPublic?: boolean;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  sportType?: string;
  maxMembers?: number;
  autoApproveJoinRequests?: boolean;
  tags?: string;
}

// Group search/filter params
export interface GroupSearchParams {
  search?: string;
  isPublic?: boolean;
  city?: string;
  country?: string;
  limit?: number;
  offset?: number;
}
