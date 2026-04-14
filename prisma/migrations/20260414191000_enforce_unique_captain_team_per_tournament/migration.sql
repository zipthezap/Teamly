-- Deduplicate legacy rows before adding uniqueness constraint.
-- Keep the most recent team registration per (tournamentId, captainUserId).
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
