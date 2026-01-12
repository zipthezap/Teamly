import prisma from '../config/database';
import { 
  MatchStatus, 
  BracketStage
} from '../../shared/types/tournament.types';

/**
 * Sanitize tournament data to prevent XSS attacks
 */
export const sanitizeTournamentData = (data: {
  name?: string;
  description?: string;
  location?: string;
  locationName?: string;
  prizesDescription?: string;
  rulesDescription?: string;
}) => {
  return {
    name: data.name?.trim() || '',
    description: data.description?.trim() || '',
    location: data.location?.trim() || '',
    locationName: data.locationName?.trim() || '',
    prizesDescription: data.prizesDescription?.trim() || '',
    rulesDescription: data.rulesDescription?.trim() || ''
  };
};

/**
 * Validate tournament dates
 */
export const validateTournamentDates = (startDate: Date | string, endDate?: Date | string) => {
  const start = new Date(startDate);
  const now = new Date();
  
  if (start < now) {
    return { valid: false, error: 'Start date must be in the future' };
  }
  
  if (endDate) {
    const end = new Date(endDate);
    if (end <= start) {
      return { valid: false, error: 'End date must be after start date' };
    }
  }
  
  return { valid: true };
};

/**
 * Check if user is tournament organizer
 */
export const isOrganizer = (tournament: { organizerId: string }, userId: string): boolean => {
  return tournament.organizerId === userId;
};

/**
 * Check if user is team captain
 */
export const isTeamCaptain = async (teamId: string, userId: string): Promise<boolean> => {
  const team = await prisma.tournamentTeam.findUnique({
    where: { id: teamId },
    select: { captainUserId: true }
  });
  
  return team?.captainUserId === userId;
};

/**
 * Check if user is a registered player on a team
 */
export const isRegisteredPlayer = async (teamId: string, userId: string): Promise<boolean> => {
  const count = await prisma.tournamentPlayer.count({
    where: { 
      teamId,
      userId
    }
  });
  
  return count > 0;
};

/**
 * Check if user can submit score for a match
 * User can submit if they are:
 * - The tournament organizer
 * - Team captain of either team
 * - Registered player on either team
 * - Registered player on the referee team
 */
export const canSubmitScore = async (
  match: { homeTeamId: string; awayTeamId: string; refereeTeamId?: string | null },
  tournament: { organizerId: string },
  userId: string
): Promise<boolean> => {
  // Check if organizer
  if (tournament.organizerId === userId) {
    return true;
  }
  
  // Check if captain of either team
  const isHomeCaptain = await isTeamCaptain(match.homeTeamId, userId);
  if (isHomeCaptain) return true;
  
  const isAwayCaptain = await isTeamCaptain(match.awayTeamId, userId);
  if (isAwayCaptain) return true;
  
  // Check if registered player on either team
  const isHomePlayer = await isRegisteredPlayer(match.homeTeamId, userId);
  if (isHomePlayer) return true;
  
  const isAwayPlayer = await isRegisteredPlayer(match.awayTeamId, userId);
  if (isAwayPlayer) return true;
  
  // Check if registered player on referee team
  if (match.refereeTeamId) {
    const isRefereePlayer = await isRegisteredPlayer(match.refereeTeamId, userId);
    if (isRefereePlayer) return true;
    
    // Also check if captain of referee team
    const isRefereeCaptain = await isTeamCaptain(match.refereeTeamId, userId);
    if (isRefereeCaptain) return true;
  }
  
  return false;
};

/**
 * Generate brackets for single elimination tournament
 */
export const generateSingleEliminationBrackets = async (tournamentId: string) => {
  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    orderBy: { createdAt: 'asc' }
  });
  
  if (teams.length < 2) {
    throw new BadRequestError('At least 2 teams are required to generate brackets', 'INSUFFICIENT_TEAMS');
  }
  
  // Calculate rounds needed
  const numTeams = teams.length;
  
  // Determine bracket stage based on number of teams
  let stage: BracketStage = BracketStage.FINALS;
  if (numTeams > 16) stage = BracketStage.ROUND_OF_32;
  else if (numTeams > 8) stage = BracketStage.ROUND_OF_16;
  else if (numTeams > 4) stage = BracketStage.QUARTER_FINALS;
  else if (numTeams > 2) stage = BracketStage.SEMI_FINALS;
  
  // Create first round matches
  const matches = [];
  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 < teams.length) {
      matches.push({
        tournamentId,
        homeTeamId: teams[i].id,
        awayTeamId: teams[i + 1].id,
        stage,
        status: MatchStatus.SCHEDULED
      });
    }
  }
  
  // Create matches in database
  const createdMatches = await prisma.tournamentMatch.createMany({
    data: matches
  });
  
  return createdMatches;
};

/**
 * Generate brackets for round robin tournament
 */
export const generateRoundRobinBrackets = async (tournamentId: string) => {
  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    orderBy: { createdAt: 'asc' }
  });
  
  if (teams.length < 2) {
    throw new BadRequestError('At least 2 teams are required to generate brackets', 'INSUFFICIENT_TEAMS');
  }
  
  // Generate all possible match combinations
  const matches = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        tournamentId,
        homeTeamId: teams[i].id,
        awayTeamId: teams[j].id,
        status: MatchStatus.SCHEDULED
      });
    }
  }
  
  // Create matches in database
  const createdMatches = await prisma.tournamentMatch.createMany({
    data: matches
  });
  
  return createdMatches;
};

/**
 * Generate brackets for groups + knockout format
 */
export const generateGroupsKnockoutBrackets = async (
  tournamentId: string, 
  numberOfGroups: number = 4
) => {
  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    orderBy: { createdAt: 'asc' }
  });
  
  if (teams.length < numberOfGroups * 2) {
    throw new BadRequestError(
      `At least ${numberOfGroups * 2} teams are required for ${numberOfGroups} groups`,
      'INSUFFICIENT_TEAMS_FOR_GROUPS'
    );
  }
  
  // Distribute teams into groups
  const groups: { [key: string]: typeof teams } = {};
  const groupNames = Array.from({ length: numberOfGroups }, (_, i) => 
    String.fromCharCode(65 + i) // A, B, C, D, etc.
  );
  
  teams.forEach((team, index) => {
    const groupName = groupNames[index % numberOfGroups];
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(team);
  });
  
  // Generate round-robin matches within each group
  const matches = [];
  for (const [groupName, groupTeams] of Object.entries(groups)) {
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        matches.push({
          tournamentId,
          homeTeamId: groupTeams[i].id,
          awayTeamId: groupTeams[j].id,
          groupName,
          stage: BracketStage.GROUP_STAGE,
          status: MatchStatus.SCHEDULED
        });
      }
    }
  }
  
  // Create matches in database
  const createdMatches = await prisma.tournamentMatch.createMany({
    data: matches
  });
  
  return createdMatches;
};

/**
 * Update tournament standings after a match
 */
export const updateStandings = async (matchId: string) => {
  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true }
  });
  
  if (!match || match.homeScore === null || match.awayScore === null) {
    return;
  }
  
  const { homeTeamId, awayTeamId, homeScore, awayScore, groupName } = match;
  
  // Determine match outcome
  let homeWin = 0, homeDraw = 0, homeLoss = 0;
  let awayWin = 0, awayDraw = 0, awayLoss = 0;
  let homePoints = 0, awayPoints = 0;
  
  if (homeScore > awayScore) {
    homeWin = 1;
    awayLoss = 1;
    homePoints = 3;
  } else if (homeScore < awayScore) {
    homeLoss = 1;
    awayWin = 1;
    awayPoints = 3;
  } else {
    homeDraw = 1;
    awayDraw = 1;
    homePoints = 1;
    awayPoints = 1;
  }
  
  // Update or create standings for home team
  const homeWhere = groupName 
    ? { tournamentId_teamId_groupName: { tournamentId: match.tournamentId, teamId: homeTeamId, groupName } }
    : { tournamentId_teamId_groupName: { tournamentId: match.tournamentId, teamId: homeTeamId, groupName: null } };
    
  await prisma.tournamentStanding.upsert({
    where: homeWhere,
    update: {
      points: { increment: homePoints },
      wins: { increment: homeWin },
      draws: { increment: homeDraw },
      losses: { increment: homeLoss },
      goalsFor: { increment: homeScore },
      goalsAgainst: { increment: awayScore }
    },
    create: {
      tournamentId: match.tournamentId,
      teamId: homeTeamId,
      groupName: groupName || null,
      points: homePoints,
      wins: homeWin,
      draws: homeDraw,
      losses: homeLoss,
      goalsFor: homeScore,
      goalsAgainst: awayScore
    }
  });
  
  // Update or create standings for away team
  const awayWhere = groupName 
    ? { tournamentId_teamId_groupName: { tournamentId: match.tournamentId, teamId: awayTeamId, groupName } }
    : { tournamentId_teamId_groupName: { tournamentId: match.tournamentId, teamId: awayTeamId, groupName: null } };
    
  await prisma.tournamentStanding.upsert({
    where: awayWhere,
    update: {
      points: { increment: awayPoints },
      wins: { increment: awayWin },
      draws: { increment: awayDraw },
      losses: { increment: awayLoss },
      goalsFor: { increment: awayScore },
      goalsAgainst: { increment: homeScore }
    },
    create: {
      tournamentId: match.tournamentId,
      teamId: awayTeamId,
      groupName: groupName || null,
      points: awayPoints,
      wins: awayWin,
      draws: awayDraw,
      losses: awayLoss,
      goalsFor: awayScore,
      goalsAgainst: homeScore
    }
  });
};

/**
 * Advance winners to next round in knockout tournament
 */
export const advanceWinners = async (tournamentId: string, currentStage: BracketStage) => {
  // Get completed matches from current stage
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      stage: currentStage,
      status: MatchStatus.COMPLETED
    }
  });
  
  if (matches.length === 0) {
    return;
  }
  
  // Determine next stage
  const stageOrder = [
    BracketStage.ROUND_OF_32,
    BracketStage.ROUND_OF_16,
    BracketStage.QUARTER_FINALS,
    BracketStage.SEMI_FINALS,
    BracketStage.FINALS
  ];
  
  const currentIndex = stageOrder.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex === stageOrder.length - 1) {
    return; // Already at finals or invalid stage
  }
  
  const nextStage = stageOrder[currentIndex + 1];
  
  // Get winners from each match
  const winners = matches.map(match => {
    if (match.homeScore! > match.awayScore!) {
      return match.homeTeamId;
    } else {
      return match.awayTeamId;
    }
  });
  
  // Create next round matches
  const nextMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      nextMatches.push({
        tournamentId,
        homeTeamId: winners[i],
        awayTeamId: winners[i + 1],
        stage: nextStage,
        status: MatchStatus.SCHEDULED
      });
    }
  }
  
  if (nextMatches.length > 0) {
    await prisma.tournamentMatch.createMany({
      data: nextMatches
    });
  }
};
