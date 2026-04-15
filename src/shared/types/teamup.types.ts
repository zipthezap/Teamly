/**
 * TeamUp-related TypeScript interfaces based on Prisma schema
 */

import { PublicUser } from './user.types';

// Enums for type safety
export enum TeamUpRequestType {
  need_players = 'need_players',
  looking_for_play = 'looking_for_play',
}

export enum TeamUpRequestStatus {
  open = 'open',
  filled = 'filled',
  cancelled = 'cancelled',
  expired = 'expired',
}

export enum TeamUpResponseStatus {
  pending = 'pending',
  accepted = 'accepted',
  declined = 'declined',
}

// TeamUp Request
export interface TeamUpRequest {
  id: string;
  title: string;
  description?: string | null;
  sportType: string;
  requestType: 'need_players' | 'looking_for_play';
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  city?: string | null;
  country?: string | null;
  dateTime: Date | string;
  playersNeeded: number;
  skillLevel?: string | null;
  positions?: TeamUpRequestPosition[];
  createdAt: Date | string;
  updatedAt: Date | string;
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  expiresAt?: Date | string | null;
  creatorId: string;
}

// TeamUp Request with relations
export interface TeamUpRequestWithDetails extends TeamUpRequest {
  creator?: PublicUser;
  responses?: TeamUpResponse[];
  comments?: TeamUpComment[];
  _count?: {
    responses: number;
    comments?: number;
  };
}

export interface TeamUpRequestPosition {
  id: string;
  teamUpRequestId: string;
  name: string;
  slotsNeeded: number;
  skillLevelRequired?: string | null;
  acceptedCount?: number;
  slotsAvailable?: number;
  isOpen?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// TeamUp Response
export interface TeamUpResponse {
  id: string;
  message?: string | null;
  applicantSkillLevel?: string | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date | string;
  teamUpRequestId: string;
  requestPositionId?: string | null;
  requestPosition?: TeamUpRequestPosition | null;
  userId: string;
  user?: PublicUser;
  teamUpRequest?: {
    id: string;
    title: string;
    sportType: string;
    requestType: 'need_players' | 'looking_for_play';
    dateTime: Date | string;
  };
}

// TeamUp Comment
export interface TeamUpComment {
  id: string;
  content: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  teamUpRequestId: string;
  userId: string;
  user?: PublicUser;
}

// Create TeamUp Request data
export interface CreateTeamUpRequestData {
  title: string;
  description?: string;
  sportType: string;
  requestType: 'need_players' | 'looking_for_play';
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  dateTime?: Date | string;
  playersNeeded?: number;
  skillLevel?: string;
  positions?: Array<{
    name: string;
    slotsNeeded?: number;
    skillLevelRequired?: string;
  }>;
}

// Update TeamUp Request data
export interface UpdateTeamUpRequestData {
  title?: string;
  description?: string;
  sportType?: string;
  requestType?: 'need_players' | 'looking_for_play';
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  dateTime?: Date | string;
  playersNeeded?: number;
  skillLevel?: string;
  positions?: Array<{
    name: string;
    slotsNeeded?: number;
    skillLevelRequired?: string;
  }>;
  status?: 'open' | 'filled' | 'cancelled' | 'expired';
}

// TeamUp Request filters
export interface TeamUpRequestFilters {
  sportType?: string;
  requestType?: 'need_players' | 'looking_for_play';
  city?: string;
  country?: string;
  skillLevel?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}
