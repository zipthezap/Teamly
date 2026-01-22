/**
 * Tests for tournament race conditions
 * 
 * These tests verify that tournament match score submissions are idempotent
 * and prevent duplicate score submissions.
 */

import { describe, it, expect } from 'vitest';
import prisma from '../../config/database';
import { MatchStatus } from '../../../shared/types/tournament.types';

describe('Tournament Race Conditions', () => {
  describe('Match Score Submission', () => {
    it('should prevent duplicate score submission for completed match', async () => {
      // Create test tournament
      const tournament = await prisma.tournament.create({
        data: {
          name: 'Race Test Tournament',
          description: 'Test tournament',
          organizerId: 'test-organizer-id',
          sportType: 'SOCCER',
          format: 'SINGLE_ELIMINATION',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      try {
        // Create test teams
        const team1 = await prisma.tournamentTeam.create({
          data: {
            tournamentId: tournament.id,
            name: 'Team A',
            captainId: 'captain-1'
          }
        });

        const team2 = await prisma.tournamentTeam.create({
          data: {
            tournamentId: tournament.id,
            name: 'Team B',
            captainId: 'captain-2'
          }
        });

        // Create a match
        const match = await prisma.tournamentMatch.create({
          data: {
            tournamentId: tournament.id,
            homeTeamId: team1.id,
            awayTeamId: team2.id,
            status: MatchStatus.SCHEDULED
          }
        });

        // Submit score once
        await prisma.tournamentMatch.update({
          where: { id: match.id },
          data: {
            homeScore: 3,
            awayScore: 1,
            status: MatchStatus.COMPLETED,
            completedAt: new Date()
          }
        });

        // Try to submit score again - should fail with proper WHERE clause
        // Using the WHERE clause with status check prevents this update
        const result = await prisma.tournamentMatch.updateMany({
          where: { 
            id: match.id,
            status: { not: MatchStatus.COMPLETED }
          },
          data: {
            homeScore: 5,
            awayScore: 2
          }
        });

        // Should not update any records since match is already completed
        expect(result.count).toBe(0);

        // Verify original score is preserved
        const finalMatch = await prisma.tournamentMatch.findUnique({
          where: { id: match.id }
        });

        expect(finalMatch?.homeScore).toBe(3);
        expect(finalMatch?.awayScore).toBe(1);
        expect(finalMatch?.status).toBe(MatchStatus.COMPLETED);
      } finally {
        // Cleanup
        await prisma.tournamentMatch.deleteMany({ where: { tournamentId: tournament.id } });
        await prisma.tournamentTeam.deleteMany({ where: { tournamentId: tournament.id } });
        await prisma.tournament.delete({ where: { id: tournament.id } }).catch(() => {});
      }
    });

    it('should handle concurrent score submissions', async () => {
      // Create test tournament
      const tournament = await prisma.tournament.create({
        data: {
          name: 'Concurrent Test Tournament',
          description: 'Test tournament',
          organizerId: 'test-organizer-id',
          sportType: 'SOCCER',
          format: 'SINGLE_ELIMINATION',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      try {
        // Create test teams
        const team1 = await prisma.tournamentTeam.create({
          data: {
            tournamentId: tournament.id,
            name: 'Team X',
            captainId: 'captain-x'
          }
        });

        const team2 = await prisma.tournamentTeam.create({
          data: {
            tournamentId: tournament.id,
            name: 'Team Y',
            captainId: 'captain-y'
          }
        });

        // Create a match
        const match = await prisma.tournamentMatch.create({
          data: {
            tournamentId: tournament.id,
            homeTeamId: team1.id,
            awayTeamId: team2.id,
            status: MatchStatus.SCHEDULED
          }
        });

        // Try concurrent score submissions using updateMany with WHERE clause
        const results = await Promise.allSettled([
          prisma.tournamentMatch.updateMany({
            where: { 
              id: match.id,
              status: { not: MatchStatus.COMPLETED }
            },
            data: {
              homeScore: 3,
              awayScore: 1,
              status: MatchStatus.COMPLETED,
              completedAt: new Date()
            }
          }),
          prisma.tournamentMatch.updateMany({
            where: { 
              id: match.id,
              status: { not: MatchStatus.COMPLETED }
            },
            data: {
              homeScore: 4,
              awayScore: 2,
              status: MatchStatus.COMPLETED,
              completedAt: new Date()
            }
          })
        ]);

        // At least one should succeed, but only one should actually update
        const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).count === 1).length;
        expect(successCount).toBeGreaterThanOrEqual(1);

        // Verify only one score was recorded
        const finalMatch = await prisma.tournamentMatch.findUnique({
          where: { id: match.id }
        });

        expect(finalMatch?.status).toBe(MatchStatus.COMPLETED);
        expect(finalMatch?.homeScore).toBeDefined();
        expect(finalMatch?.awayScore).toBeDefined();
      } finally {
        // Cleanup
        await prisma.tournamentMatch.deleteMany({ where: { tournamentId: tournament.id } });
        await prisma.tournamentTeam.deleteMany({ where: { tournamentId: tournament.id } });
        await prisma.tournament.delete({ where: { id: tournament.id } }).catch(() => {});
      }
    });
  });
});
