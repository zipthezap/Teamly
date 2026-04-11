import { Request, Response } from 'express';
import { leagueService } from '../services/leagueService';
import { asyncHandler } from '../middleware/asyncHandler';

export const createLeague = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const league = await leagueService.createLeague(req.body, userId);
  res.status(201).json(league);
});

export const getLeagues = asyncHandler(async (req: Request, res: Response) => {
  const result = await leagueService.getLeagues(req.query as any);
  res.json(result);
});

export const getLeagueById = asyncHandler(async (req: Request, res: Response) => {
  const league = await leagueService.getLeagueById(req.params.id);
  res.json(league);
});

export const updateLeague = asyncHandler(async (req: Request, res: Response) => {
  const league = await leagueService.updateLeague(req.params.id, req.body, req.user!.id);
  res.json(league);
});

export const deleteLeague = asyncHandler(async (req: Request, res: Response) => {
  await leagueService.deleteLeague(req.params.id, req.user!.id);
  res.json({ message: 'League deleted successfully' });
});

export const addTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await leagueService.addTeam(req.params.id, req.body, req.user!.id);
  res.status(201).json(team);
});

export const removeTeam = asyncHandler(async (req: Request, res: Response) => {
  await leagueService.removeTeam(req.params.id, req.params.teamId, req.user!.id);
  res.json({ message: 'Team removed successfully' });
});

export const getStandings = asyncHandler(async (req: Request, res: Response) => {
  const standings = await leagueService.getStandings(req.params.id);
  res.json(standings);
});

export const linkSession = asyncHandler(async (req: Request, res: Response) => {
  const entry = await leagueService.linkSession(
    req.params.id,
    req.body.sessionId,
    req.body.roundNumber,
    req.user!.id
  );
  res.status(201).json(entry);
});

export const updateMatch = asyncHandler(async (req: Request, res: Response) => {
  const match = await leagueService.updateMatch(req.params.id, req.params.matchId, req.body, req.user!.id);
  res.json(match);
});
