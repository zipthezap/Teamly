import prisma from '../../config/database';
import { Request, Response } from 'express';
import {
  Prisma,
  TeamUpModerationStatus,
} from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { sanitizeString } from '../../utils/validation';
import { auditLog } from '../../utils/prismaExtended';
import { requireSystemAdmin } from './_helpers';
import * as teamUpService from '../../services/teamUpService';

export const reportTeamUpRequest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body ?? {};
  const sanitizedReason =
    typeof reason === 'string' ? sanitizeString(reason).trim() : '';

  if (!sanitizedReason) {
    throw new BadRequestError('reason is required');
  }

  teamUpService.assertMaxLength(sanitizedReason, 'reason', teamUpService.TEAMUP_LIMITS.message);

  const requestRecord = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { id: true, creatorId: true },
  });

  if (!requestRecord) {
    throw new NotFoundError('TeamUp request not found');
  }

  await prisma.$transaction(async (tx) => {
    await auditLog(tx as typeof prisma).create({
      data: {
        entityType: 'teamup',
        entityId: id,
        actorId: req.user!.id,
        action: 'reported',
        metadata: {
          reason: sanitizedReason,
          reportedCreatorId: requestRecord.creatorId,
        },
      },
    });
    await tx.teamUpModerationCase.create({
      data: {
        teamUpRequestId: id,
        reporterId: req.user!.id,
        reason: sanitizedReason,
        status: 'open',
        metadata: {
          reportedCreatorId: requestRecord.creatorId,
        },
      },
    });
  });

  res.status(201).json({ message: 'TeamUp request reported' });
};

export const listTeamUpModerationCases = async (req: Request, res: Response) => {
  requireSystemAdmin(req);
  const { status = 'open', limit = '50', offset = '0' } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
  const parsedOffset = Math.max(parseInt(String(offset), 10) || 0, 0);

  const normalizedStatus = String(status);
  const where: Prisma.TeamUpModerationCaseWhereInput =
    normalizedStatus === 'all'
      ? {}
      : {
          status: normalizedStatus as TeamUpModerationStatus,
        };
  const [cases, total] = await prisma.$transaction([
    prisma.teamUpModerationCase.findMany({
      where,
      include: {
        teamUpRequest: {
          select: {
            id: true,
            title: true,
            creatorId: true,
            status: true,
          },
        },
        reporter: {
          select: { id: true, name: true, email: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: parsedLimit,
      skip: parsedOffset,
    }),
    prisma.teamUpModerationCase.count({ where }),
  ]);

  res.json({
    data: cases,
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
      hasMore: parsedOffset + cases.length < total,
    },
  });
};

export const updateTeamUpModerationCase = async (req: Request, res: Response) => {
  requireSystemAdmin(req);
  const { caseId } = req.params;
  const { status, resolutionNote, assigneeId } = req.body ?? {};

  if (!status || !['open', 'in_review', 'resolved', 'dismissed'].includes(status)) {
    throw new BadRequestError('status must be one of: open, in_review, resolved, dismissed');
  }

  const updated = await prisma.teamUpModerationCase.update({
    where: { id: caseId },
    data: {
      status,
      resolutionNote:
        typeof resolutionNote === 'string' ? sanitizeString(resolutionNote) : undefined,
      assigneeId: assigneeId ? String(assigneeId) : undefined,
      decisionAt: ['resolved', 'dismissed'].includes(status) ? new Date() : null,
      decidedByUserId: ['resolved', 'dismissed'].includes(status) ? req.user!.id : null,
    },
    include: {
      teamUpRequest: { select: { id: true, title: true } },
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  res.json(updated);
};
