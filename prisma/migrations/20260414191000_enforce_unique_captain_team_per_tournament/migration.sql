-- Deduplicate legacy rows before adding uniqueness constraint.
-- Keep the most recent team registration per (tournamentId, captainUserId).
-- Related data is handled by existing FK rules on TournamentTeam relations
-- (CASCADE for dependent rows and SET NULL where configured).
WITH ranked_teams AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tournamentId", "captainUserId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS row_num
  FROM "TournamentTeam"
  WHERE "captainUserId" IS NOT NULL
)
DELETE FROM "TournamentTeam" t
USING ranked_teams r
WHERE t."id" = r."id"
  AND r.row_num > 1;

-- Enforce one captain-owned team per tournament.
CREATE UNIQUE INDEX "TournamentTeam_tournamentId_captainUserId_key"
  ON "TournamentTeam"("tournamentId", "captainUserId");
