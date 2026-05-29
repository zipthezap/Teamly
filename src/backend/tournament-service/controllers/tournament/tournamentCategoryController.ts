import { Request, Response } from 'express';

import prisma from '../../../config/database';
import { logger } from '../../../utils/logger';
import { BadRequestError, ForbiddenError } from '../../../utils/errors';
import { isRequired } from '../../../utils/validation';
import { ensureResourceExists } from '../../../utils/controllerHelpers';
import { isPrismaUniqueError } from '../../../utils/typeGuards';
import * as tournamentService from '../../../services/tournamentService';
import { TournamentStatus } from '../../../../shared/types/tournament.types';
import {
  DEFAULT_PAGE_SIZE,
  MAX_NAME_LENGTH,
  MAX_PAGE_SIZE,
} from './_constants';

const isTournamentEditLocked = (tournament: {
  status: string;
  startDate: Date;
}): boolean => {
  if (
    tournament.status === TournamentStatus.CANCELLED ||
    tournament.status === TournamentStatus.COMPLETED ||
    tournament.status === TournamentStatus.IN_PROGRESS
  ) {
    return true;
  }

  return new Date() >= new Date(tournament.startDate);
};

const assertTournamentSetupEditable = (
  tournament: { status: string; startDate: Date },
  message: string
): void => {
  if (isTournamentEditLocked(tournament)) {
    throw new BadRequestError(message);
  }
};

export const getCategories = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page, limit } = req.query;

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(
    Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );
  const skip = (parsedPage - 1) * parsedLimit;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  const [categories, total] = await Promise.all([
    prisma.tournamentCategory.findMany({
      where: { tournamentId: id },
      orderBy: { sortOrder: 'asc' },
      skip,
      take: parsedLimit,
      include: {
        pools: {
          include: {
            teams: { select: { id: true, name: true } },
            waitlist: {
              orderBy: { position: 'asc' },
              include: { team: { select: { id: true, name: true } } },
            },
          },
        },
      },
    }),
    prisma.tournamentCategory.count({ where: { tournamentId: id } }),
  ]);

  res.json({
    data: categories,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  });
};

export const createCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { name, description, sortOrder } = req.body;

  isRequired(name, 'Name');
  if (name.trim().length > MAX_NAME_LENGTH) {
    throw new BadRequestError(
      `Category name must be at most ${MAX_NAME_LENGTH} characters`
    );
  }

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  const isOrganizerOrAdmin = await tournamentService.isOrganizerOrAdmin(
    tournament!,
    userId
  );
  if (!isOrganizerOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can manage categories');
  }

  assertTournamentSetupEditable(
    tournament!,
    'Categories can only be managed before the tournament starts'
  );

  try {
    const category = await prisma.tournamentCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || undefined,
        sortOrder: sortOrder ?? 0,
        tournamentId: id,
      },
    });

    logger.info('Category created', 'TournamentController', {
      tournamentId: id,
      categoryId: category.id,
      userId,
    });
    res.status(201).json(category);
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError(
        'A category with this name already exists in the tournament'
      );
    }
    throw error;
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  const { id, categoryId } = req.params;
  const userId = req.user!.id;
  const { name, description, sortOrder } = req.body;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  const isOrganizerOrAdmin = await tournamentService.isOrganizerOrAdmin(
    tournament!,
    userId
  );
  if (!isOrganizerOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can manage categories');
  }

  assertTournamentSetupEditable(
    tournament!,
    'Categories can only be managed before the tournament starts'
  );

  const category = await prisma.tournamentCategory.findFirst({
    where: { id: categoryId, tournamentId: id },
  });
  ensureResourceExists(category, 'Category');

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description?.trim() || null;
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

  try {
    const updated = await prisma.tournamentCategory.update({
      where: { id: categoryId },
      data: updateData,
    });

    res.json(updated);
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError(
        'A category with this name already exists in the tournament'
      );
    }
    throw error;
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id, categoryId } = req.params;
  const userId = req.user!.id;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  const isOrganizerOrAdmin = await tournamentService.isOrganizerOrAdmin(
    tournament!,
    userId
  );
  if (!isOrganizerOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can manage categories');
  }

  assertTournamentSetupEditable(
    tournament!,
    'Categories can only be managed before the tournament starts'
  );

  const category = await prisma.tournamentCategory.findFirst({
    where: { id: categoryId, tournamentId: id },
  });
  ensureResourceExists(category, 'Category');

  await prisma.tournamentCategory.delete({ where: { id: categoryId } });

  logger.info('Category deleted', 'TournamentController', {
    tournamentId: id,
    categoryId,
    userId,
  });
  res.json({ message: 'Category deleted successfully' });
};

export const assignPoolToCategory = async (req: Request, res: Response) => {
  const { id, poolId } = req.params;
  const userId = req.user!.id;
  const { categoryId } = req.body;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  const isOrganizerOrAdmin = await tournamentService.isOrganizerOrAdmin(
    tournament!,
    userId
  );
  if (!isOrganizerOrAdmin) {
    throw new ForbiddenError(
      'Only the organizer or a co-organizer can assign pools to categories'
    );
  }

  assertTournamentSetupEditable(
    tournament!,
    'Categories can only be managed before the tournament starts'
  );

  const pool = await prisma.tournamentPool.findFirst({
    where: { id: poolId, tournamentId: id },
  });
  ensureResourceExists(pool, 'Pool');

  if (categoryId) {
    const category = await prisma.tournamentCategory.findFirst({
      where: { id: categoryId, tournamentId: id },
    });
    ensureResourceExists(category, 'Category');
  }

  const updated = await prisma.tournamentPool.update({
    where: { id: poolId },
    data: { categoryId: categoryId || null },
    include: {
      category: { select: { id: true, name: true } },
    },
  });

  res.json(updated);
};
