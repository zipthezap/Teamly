import { Request, Response } from 'express';

import prisma from '../../config/database';
import * as locationService from '../../services/locationService';
import { recordSearchQuery } from '../../services/metricsService';
import { BadRequestError } from '../../utils/errors';
import { parseCoordinates, parseFloatStrict } from '../../utils/validation';

export const getNearbyEvents = async (req: Request, res: Response) => {
  const { latitude, longitude, radius = 10, limit = 50 } = req.query;

  if (!latitude || !longitude) {
    throw new BadRequestError('Latitude and longitude are required');
  }

  const { lat, lon } = parseCoordinates(latitude, longitude);
  const radiusKm = parseFloatStrict(radius, 'Radius');
  const parsedLimit = parseFloatStrict(limit, 'Limit');
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    throw new BadRequestError('Limit must be an integer between 1 and 100');
  }
  const safeLimit = parsedLimit;

  if (radiusKm <= 0 || radiusKm > 100) {
    throw new BadRequestError('Radius must be between 0 and 100 kilometers');
  }

  recordSearchQuery('sessions');

  const { latDelta, lonDelta } = locationService.calculateBoundingBox(lat, radiusKm);

  const sessions = await prisma.session.findMany({
    where: {
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } },
        { latitude: { gte: lat - latDelta, lte: lat + latDelta } },
        { longitude: { gte: lon - lonDelta, lte: lon + lonDelta } },
      ],
      status: 'upcoming',
      archived: false,
    },
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true },
      },
      group: {
        select: { id: true, name: true },
      },
      participants: {
        select: {
          id: true,
          userId: true,
          status: true,
        },
      },
      _count: {
        select: { participants: true },
      },
    },
    orderBy: { startTime: 'asc' },
    take: Math.min(safeLimit * 10, 500),
  });

  const nearbyEvents = locationService.filterByLocation(sessions, lat, lon, radiusKm).slice(0, safeLimit);
  const enrichedEvents = nearbyEvents.map((session) => locationService.enrichWithLocationInfo(session));

  res.json({
    results: enrichedEvents,
    total: enrichedEvents.length,
    center: { latitude: lat, longitude: lon },
    radius: radiusKm,
  });
};