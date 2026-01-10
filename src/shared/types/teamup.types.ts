/**
 * TeamUp-related TypeScript interfaces based on Prisma schema
 */

import { PublicUser } from './user.types';

// TeamUp Request
export interface TeamUpRequest {
  id: string;
  title: string;
  description?: string | null;
  sportType: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  city?: string | null;
  country?: string | null;
  dateTime: Date | string;
  playersNeeded: number;
  skillLevel?: string | null;
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
  _count?: {
    responses: number;
  };
}

// TeamUp Response
export interface TeamUpResponse {
  id: string;
  message?: string | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date | string;
  teamUpRequestId: string;
  userId: string;
  user?: PublicUser;
  teamUpRequest?: {
    id: string;
    title: string;
    sportType: string;
    dateTime: Date | string;
  };
}

// Create TeamUp Request data
export interface CreateTeamUpRequestData {
  title: string;
  description?: string;
  sportType: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  dateTime: Date | string;
  playersNeeded: number;
  skillLevel?: string;
}

// Update TeamUp Request data
export interface UpdateTeamUpRequestData {
  title?: string;
  description?: string;
  sportType?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  dateTime?: Date | string;
  playersNeeded?: number;
  skillLevel?: string;
  status?: 'open' | 'filled' | 'cancelled' | 'expired';
}

// TeamUp Request filters
export interface TeamUpRequestFilters {
  sportType?: string;
  city?: string;
  country?: string;
  skillLevel?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
