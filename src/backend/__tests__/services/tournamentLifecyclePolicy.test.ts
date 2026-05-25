import { describe, expect, it } from 'vitest';
import { TournamentStatus } from '../../../shared/types/tournament.types';
import {
  canPerformTournamentLifecycleAction,
  canTransitionTournamentStatus,
  isTerminalTournamentStatus,
} from '../../services/tournamentLifecyclePolicy';

describe('tournamentLifecyclePolicy', () => {
  describe('canPerformTournamentLifecycleAction', () => {
    it('allows registrations only during draft/registration', () => {
      expect(canPerformTournamentLifecycleAction('register_team', TournamentStatus.DRAFT).allowed).toBe(true);
      expect(canPerformTournamentLifecycleAction('register_team', TournamentStatus.REGISTRATION).allowed).toBe(true);
      expect(canPerformTournamentLifecycleAction('register_team', TournamentStatus.REGISTRATION_CLOSED).allowed).toBe(false);
      expect(canPerformTournamentLifecycleAction('register_team', TournamentStatus.IN_PROGRESS).allowed).toBe(false);
    });

    it('allows group match generation only during registration_closed', () => {
      expect(canPerformTournamentLifecycleAction('generate_group_matches', TournamentStatus.REGISTRATION_CLOSED).allowed).toBe(true);
      expect(canPerformTournamentLifecycleAction('generate_group_matches', TournamentStatus.IN_PROGRESS).allowed).toBe(false);
    });

    it('allows start match in_progress or explicit early-start from registration_closed', () => {
      expect(canPerformTournamentLifecycleAction('start_match', TournamentStatus.IN_PROGRESS).allowed).toBe(true);
      expect(
        canPerformTournamentLifecycleAction('start_match', TournamentStatus.REGISTRATION_CLOSED, {
          allowEarlyStart: true,
        }).allowed
      ).toBe(true);
      expect(canPerformTournamentLifecycleAction('start_match', TournamentStatus.REGISTRATION_CLOSED).allowed).toBe(false);
    });
  });

  describe('canTransitionTournamentStatus', () => {
    it('accepts valid forward transitions and same-state transition', () => {
      expect(canTransitionTournamentStatus(TournamentStatus.DRAFT, TournamentStatus.DRAFT)).toBe(true);
      expect(canTransitionTournamentStatus(TournamentStatus.DRAFT, TournamentStatus.REGISTRATION)).toBe(true);
      expect(canTransitionTournamentStatus(TournamentStatus.REGISTRATION_CLOSED, TournamentStatus.IN_PROGRESS)).toBe(true);
      expect(canTransitionTournamentStatus(TournamentStatus.IN_PROGRESS, TournamentStatus.COMPLETED)).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(canTransitionTournamentStatus(TournamentStatus.COMPLETED, TournamentStatus.IN_PROGRESS)).toBe(false);
      expect(canTransitionTournamentStatus(TournamentStatus.CANCELLED, TournamentStatus.DRAFT)).toBe(false);
      expect(canTransitionTournamentStatus(TournamentStatus.DRAFT, TournamentStatus.COMPLETED)).toBe(false);
    });
  });

  describe('isTerminalTournamentStatus', () => {
    it('marks completed/cancelled as terminal', () => {
      expect(isTerminalTournamentStatus(TournamentStatus.COMPLETED)).toBe(true);
      expect(isTerminalTournamentStatus(TournamentStatus.CANCELLED)).toBe(true);
      expect(isTerminalTournamentStatus(TournamentStatus.IN_PROGRESS)).toBe(false);
    });
  });
});
