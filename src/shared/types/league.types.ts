export enum LeagueStatus {
  draft = 'draft',
  registration = 'registration',
  active = 'active',
  completed = 'completed',
  cancelled = 'cancelled',
}

export interface League {
  id: string;
  title: string;
  description?: string;
  sport: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  startDate: string;
  endDate?: string;
  sessionCount?: number;
  status: LeagueStatus;
  isPublic: boolean;
  isPremium: boolean;
  maxTeams?: number;
  creatorId: string;
  groupId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueTeam {
  id: string;
  name: string;
  leagueId: string;
  captainUserId?: string;
  createdAt: string;
}

export interface LeaguePlayer {
  id: string;
  teamId: string;
  userId?: string;
  playerName?: string;
  jerseyNumber?: number;
  createdAt: string;
}

export interface LeagueMatch {
  id: string;
  leagueId: string;
  roundNumber?: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  status: string;
  scheduledAt?: string;
  playedAt?: string;
  createdAt: string;
}

export interface LeagueStanding {
  id: string;
  leagueId: string;
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  updatedAt: string;
}

export interface LeagueWithDetails extends League {
  creator: { id: string; name: string };
  group: { id: string; name: string };
  teams?: LeagueTeamWithDetails[];
  standings?: (LeagueStanding & { team: LeagueTeam })[];
}

export interface LeagueTeamWithDetails extends LeagueTeam {
  captain?: { id: string; name: string };
  players?: LeaguePlayer[];
}

export interface LeagueSessionEntry {
  id: string;
  leagueId: string;
  sessionId: string;
  roundNumber?: number;
}

export interface CreateLeagueData {
  title: string;
  description?: string;
  sport: string;
  groupId: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  startDate: string;
  endDate?: string;
  sessionCount?: number;
  isPublic?: boolean;
  maxTeams?: number;
}

export interface UpdateLeagueData extends Partial<CreateLeagueData> {
  status?: LeagueStatus;
}
