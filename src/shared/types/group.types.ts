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
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  city?: string | null;
  country?: string | null;
  picture?: string | null;
  creatorId: string;
}

// Group with relations
export interface GroupWithDetails extends Group {
  creator?: PublicUser;
  members?: GroupMember[];
  _count?: {
    members: number;
    events: number;
  };
}

// Group Member
export interface GroupMember {
  id: string;
  role: 'member' | 'admin';
  joinedAt: Date | string;
  userId: string;
  groupId: string;
  user?: PublicUser;
}

// Group Join Request
export interface GroupJoinRequest {
  id: string;
  groupId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date | string;
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
