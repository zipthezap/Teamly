/**
 * Utility functions for status-related operations
 */

import { TournamentStatus } from '../../../shared/types';

/**
 * Get color for TeamUp response status
 */
export const getTeamUpStatusColor = (status: string): 'success' | 'error' | 'default' | 'warning' => {
  switch (status) {
    case 'accepted':
      return 'success';
    case 'declined':
      return 'error';
    case 'pending':
      return 'warning';
    default:
      return 'default';
  }
};

/**
 * Get color for tournament status
 */
export const getTournamentStatusColor = (status: TournamentStatus): 'default' | 'info' | 'warning' | 'success' | 'error' => {
  switch (status) {
    case TournamentStatus.DRAFT:
      return 'default';
    case TournamentStatus.REGISTRATION:
      return 'info';
    case TournamentStatus.IN_PROGRESS:
      return 'warning';
    case TournamentStatus.COMPLETED:
      return 'success';
    case TournamentStatus.CANCELLED:
      return 'error';
    default:
      return 'default';
  }
};

/**
 * Get color for participant status (for styling classes)
 */
export const getParticipantStatusColor = (status: string): string => {
  switch (status) {
    case 'accepted':
    case 'going':
      return 'bg-green-100 text-green-800';
    case 'maybe':
      return 'bg-yellow-100 text-yellow-800';
    case 'declined':
    case 'not_going':
      return 'bg-red-100 text-red-800';
    case 'pending':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};
