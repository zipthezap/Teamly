import { Request, Response } from 'express';

import prisma from '../../config/database';
import * as locationService from '../../services/locationService';
import { recordSearchQuery } from '../../services/metricsService';
import { BadRequestError } from '../../utils/errors';
import { parseCoordinates, parseFloatStrict } from '../../utils/validation';

export const getNearbyGroups = async (req: Request, res: Response) => {
  const { latitude, longitude, radius, limit = 50 } = req.query;

  if (!latitude || !longitude) {
    throw new BadRequestError('Latitude and longitude are required');
  }

  const { lat, lon } = parseCoordinates(latitude, longitude);
  const parsedLimit = parseFloatStrict(limit, 'Limit');
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    throw new BadRequestError('Limit must be an integer between 1 and 100');
  }
  const safeLimit = parsedLimit;

  let radiusKm: number;
  if (radius) {
    radiusKm = parseFloatStrict(radius, 'Radius');
  } else {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { discoveryRadius: true },
    });
    radiusKm = user?.discoveryRadius || 25;
  }

  const coordValidation = locationService.validateCoordinates(lat, lon);
  if (!coordValidation.valid) {
    throw new BadRequestError(coordValidation.error || 'Invalid coordinates');
  }

  if (radiusKm <= 0 || radiusKm > 100) {
    throw new BadRequestError('Radius must be a number between 0 and 100 kilometers');
  }

  recordSearchQuery('groups');

  const { latDelta, lonDelta } = locationService.calculateBoundingBox(lat, radiusKm);

  const groups = await prisma.group.findMany({
    where: {
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } },
        { latitude: { gte: lat - latDelta, lte: lat + latDelta } },
        { longitude: { gte: lon - lonDelta, lte: lon + lonDelta } },
      ],
      isPublic: true,
      members: { none: { userId: req.user!.id } },
    },
    include: {
      creator: {
        select: { id: true, name: true, profilePicture: true },
      },
      _count: {
        select: {
          members: true,
          sessions: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(safeLimit * 10, 500),
  });

  const nearbyGroups = locationService.filterByLocation(groups, lat, lon, radiusKm).slice(0, safeLimit);

  const enrichedGroups = nearbyGroups.map((group) => locationService.enrichWithLocationInfo(group));

  res.json({
    results: enrichedGroups,
    total: enrichedGroups.length,
    center: { latitude: lat, longitude: lon },
    radius: radiusKm,
    usingUserPreference: !radius,
  });
};
