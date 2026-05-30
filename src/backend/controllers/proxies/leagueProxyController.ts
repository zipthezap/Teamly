import { Request, Response } from 'express';

import {
  addTeam as addTeamLegacy,
  createLeague as createLeagueLegacy,
  deleteLeague as deleteLeagueLegacy,
  getLeagueById as getLeagueByIdLegacy,
  getLeagues as getLeaguesLegacy,
  getStandings as getStandingsLegacy,
  linkSession as linkSessionLegacy,
  removeTeam as removeTeamLegacy,
  updateLeague as updateLeagueLegacy,
  updateMatch as updateMatchLegacy,
} from '../leagueController';
import { proxyJsonServiceRequest } from './serviceProxy';

const TOURNAMENT_SERVICE_URL = process.env.TOURNAMENT_SERVICE_URL;

export const getLeagues = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, TOURNAMENT_SERVICE_URL, '/api/leagues', getLeaguesLegacy, 'tournament-service', {
    failClosed: true,
    failClosedMessage: 'League routes are unavailable without tournament-service',
    proxyName: 'LeagueProxyController',
  });

export const createLeague = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, TOURNAMENT_SERVICE_URL, '/api/leagues', createLeagueLegacy, 'tournament-service', {
    failClosed: true,
    failClosedMessage: 'League routes are unavailable without tournament-service',
    proxyName: 'LeagueProxyController',
  });

export const getLeagueById = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, TOURNAMENT_SERVICE_URL, `/api/leagues/${req.params.id}`, getLeagueByIdLegacy, 'tournament-service', {
    failClosed: true,
    failClosedMessage: 'League routes are unavailable without tournament-service',
    proxyName: 'LeagueProxyController',
  });

export const updateLeague = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, TOURNAMENT_SERVICE_URL, `/api/leagues/${req.params.id}`, updateLeagueLegacy, 'tournament-service', {
    failClosed: true,
    failClosedMessage: 'League routes are unavailable without tournament-service',
    proxyName: 'LeagueProxyController',
  });

export const deleteLeague = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, TOURNAMENT_SERVICE_URL, `/api/leagues/${req.params.id}`, deleteLeagueLegacy, 'tournament-service', {
    failClosed: true,
    failClosedMessage: 'League routes are unavailable without tournament-service',
    proxyName: 'LeagueProxyController',
  });

export const addTeam = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, TOURNAMENT_SERVICE_URL, `/api/leagues/${req.params.id}/teams`, addTeamLegacy, 'tournament-service', {
    failClosed: true,
    failClosedMessage: 'League routes are unavailable without tournament-service',
    proxyName: 'LeagueProxyController',
  });

export const removeTeam = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    TOURNAMENT_SERVICE_URL,
    `/api/leagues/${req.params.id}/teams/${req.params.teamId}`,
    removeTeamLegacy,
    'tournament-service',
    {
      failClosed: true,
      failClosedMessage: 'League routes are unavailable without tournament-service',
      proxyName: 'LeagueProxyController',
    }
  );

export const getStandings = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, TOURNAMENT_SERVICE_URL, `/api/leagues/${req.params.id}/standings`, getStandingsLegacy, 'tournament-service', {
    failClosed: true,
    failClosedMessage: 'League routes are unavailable without tournament-service',
    proxyName: 'LeagueProxyController',
  });

export const linkSession = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, TOURNAMENT_SERVICE_URL, `/api/leagues/${req.params.id}/sessions`, linkSessionLegacy, 'tournament-service', {
    failClosed: true,
    failClosedMessage: 'League routes are unavailable without tournament-service',
    proxyName: 'LeagueProxyController',
  });

export const updateMatch = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    TOURNAMENT_SERVICE_URL,
    `/api/leagues/${req.params.id}/matches/${req.params.matchId}`,
    updateMatchLegacy,
    'tournament-service',
    {
      failClosed: true,
      failClosedMessage: 'League routes are unavailable without tournament-service',
      proxyName: 'LeagueProxyController',
    }
  );