// TeamUp API Types

export interface TeamUpRequest {
  id: string;
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
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  expiresAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  creatorId: string;
  creator?: {
    id: string;
    name: string;
    email: string;
    city?: string;
    country?: string;
    profilePicture?: string;
  };
  responses?: TeamUpResponse[];
  _count?: {
    responses: number;
  };
}

export interface TeamUpResponse {
  id: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date | string;
  teamUpRequestId: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
  teamUpRequest?: {
    id: string;
    title: string;
    sportType: string;
    dateTime: Date | string;
  };
}

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

export interface UpdateTeamUpRequestData extends Partial<CreateTeamUpRequestData> {
  status?: 'open' | 'filled' | 'cancelled' | 'expired';
}

export interface TeamUpRequestFilters {
  sportType?: string;
  city?: string;
  country?: string;
  skillLevel?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
