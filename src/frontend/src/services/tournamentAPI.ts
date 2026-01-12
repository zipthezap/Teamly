import axios, { AxiosInstance } from 'axios';
import {
  Tournament,
  TournamentWithDetails,
  CreateTournamentDto,
  UpdateTournamentDto,
  TournamentTeam,
  CreateTeamDto,
  UpdateTeamDto,
  TournamentMatch,
  SubmitScoreDto,
  TournamentStanding,
  GenerateBracketsDto,
  TournamentStatus,
  CreateMatchDto,
  UpdateMatchDto,
  AssignRefereeDto,
  AssignPoolDto
} from '../../../shared/types';

const API_BASE_URL = typeof import.meta.env.VITE_API_URL !== 'undefined' 
  ? import.meta.env.VITE_API_URL 
  : 'http://localhost:3000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Tournament API methods
export const tournamentAPI = {
  // Create a new tournament
  createTournament: async (data: CreateTournamentDto): Promise<Tournament> => {
    const response = await api.post('/tournaments', data);
    return response.data;
  },

  // Get all tournaments (with optional filters)
  getTournaments: async (filters?: {
    groupId?: string;
    status?: TournamentStatus;
    sportType?: string;
  }): Promise<Tournament[]> => {
    const response = await api.get('/tournaments', { params: filters });
    return response.data;
  },

  // Get a single tournament by ID
  getTournament: async (id: string): Promise<TournamentWithDetails> => {
    const response = await api.get(`/tournaments/${id}`);
    return response.data;
  },

  // Update a tournament
  updateTournament: async (id: string, data: UpdateTournamentDto): Promise<Tournament> => {
    const response = await api.put(`/tournaments/${id}`, data);
    return response.data;
  },

  // Delete a tournament
  deleteTournament: async (id: string): Promise<void> => {
    await api.delete(`/tournaments/${id}`);
  },

  // Add a team to a tournament
  addTeam: async (tournamentId: string, data: CreateTeamDto): Promise<TournamentTeam> => {
    const response = await api.post(`/tournaments/${tournamentId}/teams`, data);
    return response.data;
  },

  // Update a team
  updateTeam: async (tournamentId: string, teamId: string, data: UpdateTeamDto): Promise<TournamentTeam> => {
    const response = await api.put(`/tournaments/${tournamentId}/teams/${teamId}`, data);
    return response.data;
  },

  // Delete a team
  deleteTeam: async (tournamentId: string, teamId: string): Promise<void> => {
    await api.delete(`/tournaments/${tournamentId}/teams/${teamId}`);
  },

  // Assign team to pool
  assignTeamToPool: async (tournamentId: string, teamId: string, data: AssignPoolDto): Promise<TournamentTeam> => {
    const response = await api.put(`/tournaments/${tournamentId}/teams/${teamId}/pool`, data);
    return response.data;
  },

  // Generate tournament brackets
  generateBrackets: async (tournamentId: string, data?: GenerateBracketsDto): Promise<{ message: string; matchesCreated: number }> => {
    const response = await api.post(`/tournaments/${tournamentId}/generate-brackets`, data || {});
    return response.data;
  },

  // Manual bracket management
  // Create a match manually
  createMatch: async (tournamentId: string, data: CreateMatchDto): Promise<TournamentMatch> => {
    const response = await api.post(`/tournaments/${tournamentId}/matches`, data);
    return response.data;
  },

  // Update a match
  updateMatch: async (tournamentId: string, matchId: string, data: UpdateMatchDto): Promise<TournamentMatch> => {
    const response = await api.put(`/tournaments/${tournamentId}/matches/${matchId}`, data);
    return response.data;
  },

  // Delete a match
  deleteMatch: async (tournamentId: string, matchId: string): Promise<void> => {
    await api.delete(`/tournaments/${tournamentId}/matches/${matchId}`);
  },

  // Assign referee to a match
  assignReferee: async (tournamentId: string, matchId: string, data: AssignRefereeDto): Promise<TournamentMatch> => {
    const response = await api.put(`/tournaments/${tournamentId}/matches/${matchId}/referee`, data);
    return response.data;
  },

  // Submit match score
  submitScore: async (tournamentId: string, matchId: string, data: SubmitScoreDto): Promise<TournamentMatch> => {
    const response = await api.post(`/tournaments/${tournamentId}/matches/${matchId}/score`, data);
    return response.data;
  },

  // Get tournament standings
  getStandings: async (tournamentId: string, groupName?: string): Promise<TournamentStanding[]> => {
    const response = await api.get(`/tournaments/${tournamentId}/standings`, {
      params: groupName ? { groupName } : undefined
    });
    return response.data;
  }
};

export default tournamentAPI;
