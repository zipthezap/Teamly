import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { Request, Response } from 'express';
import {
  Prisma,
  TeamUpResponseStatus,
} from '@prisma/client';
import * as teamUpService from '../../services/teamUpService';
import { dispatchPushNotifications } from '../../services/pushNotificationService';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors';
import {
  computeRoleFitForApplication,
  getWaitlistRank,
  buildAutoFillWindow,
} from './_helpers';
import { BLOCKING_APPLICATION_STATUSES, REAPPLY_ELIGIBLE_STATUSES } from './_constants';

export const respondToTeamUpRequest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message, requestPositionId, applicantSkillLevel } = req.body;

  // Sanitize the message
  const sanitized = teamUpService.sanitizeTeamUpData({ message });
  teamUpService.validateTeamUpTextLengths({ message: sanitized.message });
  const sanitizedApplicantSkillLevel =
    teamUpService.parseSkillLevel(applicantSkillLevel, 'applicantSkillLevel') ?? undefined;

  const teamUpRequest: any = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { 
      status: true, 
      creatorId: true, 
      title: true,
      sportType: true,
      dateTime: true,
      playersNeeded: true,
      city: true,
      country: true,
      skillLevel: true,
      // @ts-ignore
      positions: {
        select: {
          id: true,
          name: true,
          slotsNeeded: true,
          skillLevelRequired: true,
        },
      },
      creator: {
        select: {
          email: true,
          name: true
        }
      }
    }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  if (teamUpRequest.status !== 'open') {
    throw new BadRequestError('This TeamUp request is no longer accepting responses');
  }

  if (teamUpRequest.creatorId === req.user!.id) {
    throw new BadRequestError('You cannot respond to your own TeamUp request');
  }

  // Check if user has already responded (cancelled/declined responses may be reapplied)
  const existingResponse: any = await prisma.teamUpResponse.findFirst({
    where: {
      teamUpRequestId: id,
      userId: req.user!.id
    }
  });

  if (existingResponse && !REAPPLY_ELIGIBLE_STATUSES.includes(existingResponse.status)) {
    throw new BadRequestError('You have already responded to this request');
  }

  const hasPositionRequirements = teamUpRequest.positions.length > 0;
  if (hasPositionRequirements && !requestPositionId) {
    throw new BadRequestError('requestPositionId is required for this TeamUp request');
  }

  let selectedPosition: any = null;
  if (requestPositionId) {
    selectedPosition = teamUpRequest.positions.find((position: any) => position.id === requestPositionId);
    if (!selectedPosition) {
      throw new BadRequestError('Invalid requestPositionId for this TeamUp request');
    }
  }

  // Perform the slot-fill check and response upsert atomically to prevent
  // two concurrent requests from overfilling the same position slot.
  const applicantProfile = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { city: true, country: true },
  });

  const { score: matchScore, reasons: matchReasons } = computeRoleFitForApplication({
    selectedPosition,
    requestSkillLevel: teamUpRequest.skillLevel,
    requestCity: teamUpRequest.city,
    requestCountry: teamUpRequest.country,
    applicantSkillLevel: sanitizedApplicantSkillLevel ?? null,
    applicantCity: applicantProfile?.city ?? null,
    applicantCountry: applicantProfile?.country ?? null,
  });

  const response: any = await prisma.$transaction(async (tx) => {
    let nextStatus: 'pending' | 'waitlisted' = 'pending';
    let waitlistRank: number | null = null;
    let autoFillOfferedAt: Date | null = null;
    let autoFillExpiresAt: Date | null = null;

    if (selectedPosition) {
      const acceptedForPosition = await tx.teamUpResponse.count({
        where: {
          teamUpRequestId: id,
          // @ts-ignore
          requestPositionId: selectedPosition.id,
          status: 'accepted',
        },
      });
      if (acceptedForPosition >= selectedPosition.slotsNeeded) {
        nextStatus = 'waitlisted';
        waitlistRank = await getWaitlistRank(tx as typeof prisma, id, selectedPosition.id);
      } else {
        nextStatus = 'pending';
      }
    } else {
      const acceptedCount = await tx.teamUpResponse.count({
        where: { teamUpRequestId: id, status: 'accepted' },
      });
      if (acceptedCount >= teamUpRequest.playersNeeded) {
        nextStatus = 'waitlisted';
        waitlistRank = await getWaitlistRank(tx as typeof prisma, id, null);
      }
    }

    if (nextStatus === 'waitlisted') {
      const autoFillWindow = buildAutoFillWindow();
      autoFillOfferedAt = autoFillWindow.offeredAt;
      autoFillExpiresAt = autoFillWindow.expiresAt;
    }

    const responseData = {
      message: sanitized.message,
      status: nextStatus,
      // @ts-ignore
      requestPositionId: selectedPosition?.id ?? null,
      applicantSkillLevel: sanitizedApplicantSkillLevel ?? null,
      matchScore,
      matchReasons,
      waitlistRank,
      autoFillOfferedAt,
      autoFillExpiresAt,
      rsvpStatus: 'unset' as const,
    };

    if (existingResponse) {
      // Reapplication: update the cancelled/declined record back to pending
      return tx.teamUpResponse.update({
        where: { id: existingResponse.id },
        data: responseData,
        // @ts-ignore
        include: {
          user: { select: { id: true, name: true, email: true, profilePicture: true } },
          // @ts-ignore
          requestPosition: { select: { id: true, name: true, slotsNeeded: true, skillLevelRequired: true } },
        },
      });
    }

    return tx.teamUpResponse.create({
      data: {
        teamUpRequestId: id,
        userId: req.user!.id,
        ...responseData,
      },
      // @ts-ignore
      include: {
        user: { select: { id: true, name: true, email: true, profilePicture: true } },
        // @ts-ignore
        requestPosition: { select: { id: true, name: true, slotsNeeded: true, skillLevelRequired: true } },
      },
    });
  }, { isolationLevel: 'Serializable' });

  // Create notification for the request creator
  try {
    await prisma.teamUpNotification.create({
      data: {
        userId: teamUpRequest.creatorId,
        teamUpRequestId: id,
        type: 'teamup_response',
        params: {
          name: req.user!.name,
          title: teamUpRequest.title,
          sportType: teamUpRequest.sportType
        },
        metadata: {
          responseId: response.id,
          responderId: req.user!.id,
          responderName: req.user!.name
        }
      }
    });

    // Send email notification
    const emailHtml = `
      <h2>New Response to Your TeamUp Request</h2>
      <p>Hi ${teamUpRequest.creator.name},</p>
      <p><strong>${req.user!.name}</strong> has responded to your TeamUp request:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0;">${teamUpRequest.title}</h3>
        <p><strong>Sport:</strong> ${teamUpRequest.sportType}</p>
        <p><strong>Date:</strong> ${new Date(teamUpRequest.dateTime).toLocaleString()}</p>
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
      </div>
      <p>Log in to your account to accept or decline this response.</p>
    `;

    await prisma.emailQueue.create({
      data: {
        recipient: teamUpRequest.creator.email,
        subject: `New Response to "${teamUpRequest.title}"`,
        htmlContent: emailHtml,
        templateType: 'teamup_response',
        status: 'pending',
        scheduledAt: new Date()
      }
    });

    await dispatchPushNotifications({
      userIds: [teamUpRequest.creatorId],
      notificationKind: 'teamup',
      notificationType: 'teamup_response',
      entityId: id,
      params: {
        name: req.user!.name,
        title: teamUpRequest.title,
        sportType: teamUpRequest.sportType,
      },
      metadata: {
        actionUrl: `/teamup/${id}`,
      },
    });
  } catch (notifError) {
    logger.error('Failed to create TeamUp response notification:', 'teamUpController', { error: notifError });
    // Don't fail the response if notification fails
  }

  res.status(201).json({
    message:
      response.status === 'waitlisted'
        ? 'Response submitted and added to waitlist'
        : 'Response submitted',
    response,
    waitlisted: response.status === 'waitlisted',
    matchScore,
    matchReasons,
  });
};

export const handleTeamUpResponse = async (req: Request, res: Response) => {
  const { id, responseId } = req.params;
  const { action } = req.body;

  if (!action || !['accept', 'decline'].includes(action)) {
    throw new BadRequestError('Action must be "accept" or "decline"');
  }

  // Verify the creator owns this request (outside transaction for early exit)
  const teamUpRequest: any = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: {
      creatorId: true,
      playersNeeded: true,
      title: true,
      sportType: true,
      dateTime: true,
      location: true,
      // @ts-ignore
      positions: {
        select: {
          id: true,
          name: true,
          slotsNeeded: true,
          skillLevelRequired: true,
        },
      },
    }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  if (teamUpRequest.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can manage responses');
  }

  const existingResponse: any = await prisma.teamUpResponse.findUnique({
    where: { id: responseId },
    // @ts-ignore
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePicture: true
        }
      },
      // @ts-ignore
      requestPosition: {
        select: {
          id: true,
          name: true,
          slotsNeeded: true,
          skillLevelRequired: true,
        },
      },
    }
  });

  if (!existingResponse) {
    throw new NotFoundError('Response not found');
  }

  if (existingResponse.teamUpRequestId !== id) {
    throw new BadRequestError('Response does not belong to this TeamUp request');
  }

  // Use a transaction to atomically update the response status and conditionally
  // mark the request as filled, preventing concurrent accepts from over-booking.
  const { updated, requestFilled } = await prisma.$transaction(async (tx) => {
    const hasPositionRequirements = teamUpRequest.positions.length > 0;

    // When accepting, verify we haven't already filled all spots
    if (action === 'accept') {
      const acceptedRoleForSameUser = await tx.teamUpResponse.findFirst({
        where: {
          teamUpRequestId: id,
          userId: existingResponse.userId,
          status: 'accepted',
          id: { not: responseId },
        },
        select: { id: true },
      });
      if (acceptedRoleForSameUser) {
        throw new BadRequestError(
          'This user already has an accepted application for this TeamUp request'
        );
      }

      if (hasPositionRequirements) {
        if (!existingResponse.requestPositionId) {
          throw new BadRequestError('Response is missing requestPositionId');
        }
        const selectedPosition = teamUpRequest.positions.find(
          (position: any) => position.id === existingResponse.requestPositionId
        );
        if (!selectedPosition) {
          throw new BadRequestError('Selected position is no longer available');
        }

        const acceptedForPosition = await tx.teamUpResponse.count({
          where: {
            teamUpRequestId: id,
            // @ts-ignore
            requestPositionId: existingResponse.requestPositionId,
            status: 'accepted',
            id: { not: responseId },
          },
        });
        if (acceptedForPosition >= selectedPosition.slotsNeeded) {
          throw new BadRequestError('Cannot accept: selected position is already filled');
        }
      } else {
        const acceptedCount = await tx.teamUpResponse.count({
          where: { teamUpRequestId: id, status: 'accepted', id: { not: responseId } },
        });
        if (acceptedCount >= teamUpRequest.playersNeeded) {
          throw new BadRequestError('Cannot accept: all available spots are already filled');
        }
      }
    }

    const updated = await tx.teamUpResponse.update({
      where: { id: responseId },
      data: { status: action === 'accept' ? 'accepted' : 'declined' },
      // @ts-ignore
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true
          }
        },
        // @ts-ignore
        requestPosition: {
          select: {
            id: true,
            name: true,
            slotsNeeded: true,
            skillLevelRequired: true,
          },
        },
      }
    });

    // Auto-fill: recount after update and mark request filled if needed
    let requestFilled = false;
    if (action === 'accept') {
      if (teamUpRequest.positions.length > 0) {
        const acceptedResponses: any[] = await tx.teamUpResponse.findMany({
          where: {
            teamUpRequestId: id,
            status: 'accepted',
            // @ts-ignore
            requestPositionId: { not: null },
          },
          // @ts-ignore
          select: { requestPositionId: true },
        });
        const acceptedByPosition = new Map<string, number>();
        acceptedResponses.forEach((response) => {
          if (!response.requestPositionId) return;
          acceptedByPosition.set(
            response.requestPositionId,
            (acceptedByPosition.get(response.requestPositionId) ?? 0) + 1
          );
        });
        requestFilled = teamUpRequest.positions.every((position: any) => {
          const acceptedCount = acceptedByPosition.get(position.id) ?? 0;
          return acceptedCount >= position.slotsNeeded;
        });
      } else {
        const newAcceptedCount = await tx.teamUpResponse.count({
          where: { teamUpRequestId: id, status: 'accepted' },
        });
        requestFilled = newAcceptedCount >= teamUpRequest.playersNeeded;
      }

      if (requestFilled) {
        await tx.teamUpRequest.update({
          where: { id },
          data: { status: 'filled' }
        });
      }
    }

    return { updated, requestFilled };
  });

  // Send notifications outside the transaction (non-blocking)
  try {
    await prisma.teamUpNotification.create({
      data: {
        userId: existingResponse.userId,
        teamUpRequestId: id,
        type: action === 'accept' ? 'teamup_accepted' : 'teamup_declined',
        params: {
          title: teamUpRequest.title,
          sportType: teamUpRequest.sportType
        },
        metadata: {
          responseId: responseId,
          action: action,
          location: teamUpRequest.location,
          dateTime: teamUpRequest.dateTime
        }
      }
    });

    // Send email notification
    const emailHtml = action === 'accept' 
      ? `
        <h2>Your Response Was Accepted! 🎉</h2>
        <p>Hi ${existingResponse.user.name},</p>
        <p>Great news! Your response to the following TeamUp request has been accepted:</p>
        <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #3b82f6;">
          <h3 style="margin-top: 0; color: #1e40af;">${teamUpRequest.title}</h3>
          <p><strong>Sport:</strong> ${teamUpRequest.sportType}</p>
          <p><strong>Date:</strong> ${new Date(teamUpRequest.dateTime).toLocaleString()}</p>
          ${teamUpRequest.location ? `<p><strong>Location:</strong> ${teamUpRequest.location}</p>` : ''}
        </div>
        <p>Get ready for the game! Make sure to arrive on time.</p>
      `
      : `
        <h2>Response Status Update</h2>
        <p>Hi ${existingResponse.user.name},</p>
        <p>Thank you for your interest. Unfortunately, your response to the following TeamUp request was not accepted:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0;">${teamUpRequest.title}</h3>
          <p><strong>Sport:</strong> ${teamUpRequest.sportType}</p>
          <p><strong>Date:</strong> ${new Date(teamUpRequest.dateTime).toLocaleString()}</p>
        </div>
        <p>Keep looking for other opportunities on TeamUp!</p>
      `;

    await prisma.emailQueue.create({
      data: {
        recipient: existingResponse.user.email,
        subject: action === 'accept' 
          ? `You're In! Response Accepted for "${teamUpRequest.title}"`
          : `Response Update for "${teamUpRequest.title}"`,
        htmlContent: emailHtml,
        templateType: action === 'accept' ? 'teamup_accepted' : 'teamup_declined',
        status: 'pending',
        scheduledAt: new Date()
      }
    });

    await dispatchPushNotifications({
      userIds: [existingResponse.userId],
      notificationKind: 'teamup',
      notificationType: action === 'accept' ? 'teamup_accepted' : 'teamup_declined',
      entityId: id,
      params: {
        title: teamUpRequest.title,
        sportType: teamUpRequest.sportType,
      },
      metadata: {
        actionUrl: `/teamup/${id}`,
      },
    });
  } catch (notifError) {
    logger.error('Failed to create TeamUp action notification:', 'teamUpController', { error: notifError });
    // Don't fail the response if notification fails
  }

  res.json({ message: `Response ${action}ed`, response: updated, requestFilled });
};

export const getMyTeamUpResponses = async (req: Request, res: Response) => {
  const { limit = '50', offset = '0' } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 100);
  const parsedOffset = Math.max(parseInt(String(offset), 10) || 0, 0);

  const [responses, total]: [any[], number] = await prisma.$transaction([
    prisma.teamUpResponse.findMany({
      where: {
        teamUpRequest: {
          creatorId: req.user!.id
        }
      },
      // @ts-ignore
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true
          }
        },
        // @ts-ignore
        requestPosition: {
          select: {
            id: true,
            name: true,
            slotsNeeded: true,
            skillLevelRequired: true,
          },
        },
        teamUpRequest: {
          select: {
            id: true,
            title: true,
            sportType: true,
            requestType: true,
            dateTime: true,
            // @ts-ignore
            positions: {
              select: {
                id: true,
                name: true,
                slotsNeeded: true,
                skillLevelRequired: true,
              },
            },
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parsedLimit,
      skip: parsedOffset,
    }),
    prisma.teamUpResponse.count({
      where: {
        teamUpRequest: {
          creatorId: req.user!.id
        }
      },
    }),
  ]);

  res.json({
    data: responses.map((response) => ({
      ...response,
      reapplicationEligible: REAPPLY_ELIGIBLE_STATUSES.includes(response.status),
      blocksReapply: BLOCKING_APPLICATION_STATUSES.includes(response.status),
      canUpdateRsvp: response.status === 'accepted',
    })),
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
      hasMore: parsedOffset + responses.length < total,
    },
  });
};

export const getMyTeamUpApplications = async (req: Request, res: Response) => {
  const { limit = '50', offset = '0' } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 100);
  const parsedOffset = Math.max(parseInt(String(offset), 10) || 0, 0);

  const [responses, total]: [any[], number] = await prisma.$transaction([
    prisma.teamUpResponse.findMany({
      where: {
        userId: req.user!.id
      },
      // @ts-ignore
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true
          }
        },
        // @ts-ignore
        requestPosition: {
          select: {
            id: true,
            name: true,
            slotsNeeded: true,
            skillLevelRequired: true,
          },
        },
        teamUpRequest: {
          select: {
            id: true,
            title: true,
            sportType: true,
            requestType: true,
            dateTime: true,
            city: true,
            location: true,
            status: true,
            // @ts-ignore
            positions: {
              select: {
                id: true,
                name: true,
                slotsNeeded: true,
                skillLevelRequired: true,
              },
              orderBy: { createdAt: 'asc' },
            },
            creator: {
              select: {
                id: true,
                name: true,
                profilePicture: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parsedLimit,
      skip: parsedOffset,
    }),
    prisma.teamUpResponse.count({
      where: { userId: req.user!.id },
    }),
  ]);

  res.json({
    data: responses.map((response) => ({
      ...response,
      reapplicationEligible: REAPPLY_ELIGIBLE_STATUSES.includes(response.status),
      blocksReapply: BLOCKING_APPLICATION_STATUSES.includes(response.status),
      canUpdateRsvp: response.status === 'accepted',
    })),
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
      hasMore: parsedOffset + responses.length < total,
    },
  });
};

export const withdrawTeamUpResponse = async (req: Request, res: Response) => {
  const { id } = req.params;

  const teamUpRequest = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  const existingResponse = await prisma.teamUpResponse.findFirst({
    where: {
      teamUpRequestId: id,
      userId: req.user!.id,
    },
    select: { id: true, status: true, requestPositionId: true },
  });

  if (!existingResponse) {
    throw new NotFoundError('Response not found');
  }

  if (!['pending', 'accepted', 'waitlisted'].includes(existingResponse.status)) {
    throw new BadRequestError('Only pending, accepted, or waitlisted responses can be withdrawn');
  }

  const promotedResponses = await prisma.$transaction(async (tx) => {
    await tx.teamUpResponse.update({
      where: { id: existingResponse.id },
      data: { status: 'cancelled' },
    });

    if (existingResponse.status !== 'accepted') {
      return [];
    }

    await tx.teamUpRequest.update({
      where: { id },
      data: { status: 'open' },
    });

    const candidates = await tx.teamUpResponse.findMany({
      where: {
        teamUpRequestId: id,
        status: 'waitlisted',
        // @ts-ignore
        requestPositionId: existingResponse.requestPositionId ?? null,
      },
      orderBy: [{ waitlistRank: 'asc' }, { createdAt: 'asc' }],
      take: 1,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (candidates.length === 0) {
      return [];
    }

    const autoFillWindow = buildAutoFillWindow();
    const promoted = await tx.teamUpResponse.update({
      where: { id: candidates[0].id },
      data: {
        status: 'pending',
        waitlistRank: null,
        autoFillOfferedAt: autoFillWindow.offeredAt,
        autoFillExpiresAt: autoFillWindow.expiresAt,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return [promoted];
  });

  if (promotedResponses.length > 0) {
    await Promise.all(
      promotedResponses.map(async (promoted) => {
        try {
          await prisma.teamUpNotification.create({
            data: {
              userId: promoted.userId,
              teamUpRequestId: id,
              type: 'teamup_response',
              params: {
                title: 'Auto-fill confirmation requested',
                sportType: 'teamup',
              },
              metadata: {
                actionUrl: `/teamup/${id}`,
                autoFill: true,
                expiresAt: promoted.autoFillExpiresAt,
              },
            },
          });
        } catch (error) {
          logger.error('Failed to notify promoted waitlisted response', 'teamUpController', { error });
        }
      })
    );
  }

  res.json({
    message: 'Response withdrawn',
    autoFillPromotedCount: promotedResponses.length,
  });
};

export const bulkHandleTeamUpResponses = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, responseIds } = req.body ?? {};

  if (!action || !['accept', 'decline'].includes(action)) {
    throw new BadRequestError('Action must be "accept" or "decline"');
  }
  if (!Array.isArray(responseIds) || responseIds.length === 0) {
    throw new BadRequestError('responseIds must be a non-empty array');
  }

  const requestRecord = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { creatorId: true, playersNeeded: true },
  });
  if (!requestRecord) throw new NotFoundError('TeamUp request not found');
  if (requestRecord.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can manage responses');
  }

  const uniqueResponseIds = [...new Set(responseIds.map((value) => String(value)))];
  const responses = await prisma.teamUpResponse.findMany({
    where: {
      id: { in: uniqueResponseIds },
      teamUpRequestId: id,
    },
    select: { id: true, status: true },
  });

  const acceptedCount = await prisma.teamUpResponse.count({
    where: { teamUpRequestId: id, status: 'accepted' },
  });
  const acceptedInPayload = responses.filter((item) => item.status !== 'accepted').length;
  if (action === 'accept' && acceptedCount + acceptedInPayload > requestRecord.playersNeeded) {
    throw new BadRequestError('Bulk accept exceeds available slots');
  }

  const updateData: Prisma.TeamUpResponseUpdateManyMutationInput =
    action === 'accept'
      ? {
          status: TeamUpResponseStatus.accepted,
        }
      : {
          status: TeamUpResponseStatus.declined,
          rsvpStatus: 'unset',
          rsvpUpdatedAt: null,
        };

  await prisma.teamUpResponse.updateMany({
    where: { id: { in: responses.map((item) => item.id) } },
    data: updateData,
  });

  if (action === 'accept') {
    const refreshedAccepted = await prisma.teamUpResponse.count({
      where: { teamUpRequestId: id, status: 'accepted' },
    });
    if (refreshedAccepted >= requestRecord.playersNeeded) {
      await prisma.teamUpRequest.update({
        where: { id },
        data: { status: 'filled' },
      });
    }
  }

  res.json({
    message: `Bulk ${action} completed`,
    updatedCount: responses.length,
  });
};
