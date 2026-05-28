import prisma from '../../config/database';
import { ForbiddenError } from '../../utils/errors';
import { Request } from 'express';
import { TEAMUP_AUTOFILL_CONFIRMATION_MINUTES } from './_constants';
import * as teamUpService from '../../services/teamUpService';

export const requireSystemAdmin = (req: Request): void => {
  const configuredAdmins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (
    !req.user?.email ||
    configuredAdmins.length === 0 ||
    !configuredAdmins.includes(req.user.email.toLowerCase())
  ) {
    throw new ForbiddenError('Admin access required');
  }
};

export const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
};

export const computeRoleFitForApplication = ({
  selectedPosition,
  requestSkillLevel,
  requestCity,
  requestCountry,
  applicantSkillLevel,
  applicantCity,
  applicantCountry,
}: {
  selectedPosition?: { name?: string | null; skillLevelRequired?: string | null } | null;
  requestSkillLevel?: string | null;
  requestCity?: string | null;
  requestCountry?: string | null;
  applicantSkillLevel?: string | null;
  applicantCity?: string | null;
  applicantCountry?: string | null;
}) => {
  let score = 50;
  const reasons: string[] = [];

  if (selectedPosition?.name) {
    score += 20;
    reasons.push(`Applied for role "${selectedPosition.name}"`);
  }

  const expectedSkill = selectedPosition?.skillLevelRequired ?? requestSkillLevel ?? null;
  if (expectedSkill && applicantSkillLevel) {
    if (expectedSkill.toLowerCase() === applicantSkillLevel.toLowerCase()) {
      score += 20;
      reasons.push('Skill level matches request');
    } else {
      score -= 10;
      reasons.push('Skill level differs from requested level');
    }
  } else if (applicantSkillLevel) {
    score += 5;
    reasons.push('Skill level provided');
  }

  const normalizedApplicantCity = teamUpService.normalizeLocationToken(applicantCity);
  const normalizedRequestCity = teamUpService.normalizeLocationToken(requestCity);
  const normalizedApplicantCountry = teamUpService.normalizeLocationToken(applicantCountry);
  const normalizedRequestCountry = teamUpService.normalizeLocationToken(requestCountry);

  if (normalizedApplicantCity && normalizedRequestCity && normalizedApplicantCity === normalizedRequestCity) {
    score += 10;
    reasons.push('Same city as the request');
  } else if (
    normalizedApplicantCountry &&
    normalizedRequestCountry &&
    normalizedApplicantCountry === normalizedRequestCountry
  ) {
    score += 5;
    reasons.push('Same country as the request');
  }

  return { score: clampScore(score), reasons };
};

export const getWaitlistRank = async (
  tx: typeof prisma,
  teamUpRequestId: string,
  requestPositionId: string | null
): Promise<number> => {
  const aggregate = await tx.teamUpResponse.aggregate({
    _max: { waitlistRank: true },
    where: {
      teamUpRequestId,
      status: 'waitlisted',
      // @ts-ignore
      requestPositionId,
    },
  });
  return (aggregate._max.waitlistRank ?? 0) + 1;
};

export const buildAutoFillWindow = () => {
  const offeredAt = new Date();
  const expiresAt = new Date(offeredAt.getTime() + TEAMUP_AUTOFILL_CONFIRMATION_MINUTES * 60 * 1000);
  return { offeredAt, expiresAt };
};
