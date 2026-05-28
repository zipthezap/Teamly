import { BadRequestError } from '../../utils/errors';
import { MAX_MATCH_SCORE, TIMEZONE_IANA_LIKE_REGEX, TIME_24H_HH_MM_REGEX } from './_constants';
import { VALID_PLAYOFF_SIZES } from '../../../shared/types/tournament.types';

export const parseTimeToMinutes = (time: string): number => {
  const match = TIME_24H_HH_MM_REGEX.exec(time);
  if (!match) {
    throw new BadRequestError('Time must be in HH:mm format');
  }
  return Number(match[1]) * 60 + Number(match[2]);
};

export const parseNonNegativeInteger = (value: unknown, fieldName: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestError(`${fieldName} must be a non-negative integer`);
  }
  return parsed;
};

export const parseMatchScoreInput = (value: unknown, fieldName: string): number => {
  if (value === null || value === undefined) {
    throw new BadRequestError(`${fieldName} is required`);
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    throw new BadRequestError(`${fieldName} must be a whole number`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new BadRequestError(`${fieldName} must be a whole number`);
  }
  if (parsed < 0) {
    throw new BadRequestError('Scores cannot be negative');
  }
  if (parsed > MAX_MATCH_SCORE) {
    throw new BadRequestError(`Scores must be ${MAX_MATCH_SCORE} or less`);
  }

  return parsed;
};

export const parseBoolean = (value: unknown, fieldName: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new BadRequestError(`${fieldName} must be a boolean`);
  }
  return value;
};

export const parsePlayoffSize = (value: unknown): number => {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    !(VALID_PLAYOFF_SIZES as readonly number[]).includes(value)
  ) {
    throw new BadRequestError('playoffSize must be one of 2, 4, 8, or 16');
  }
  return value;
};

export const parseIntegerInRange = (
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestError(`${fieldName} must be an integer between ${min} and ${max}`);
  }
  return parsed;
};

export const assertValidTournamentTimezone = (value: unknown): string => {
  if (typeof value !== 'string' || !TIMEZONE_IANA_LIKE_REGEX.test(value.trim())) {
    throw new BadRequestError('timezone must be a valid IANA timezone string (e.g. "Europe/Berlin" or "UTC")');
  }
  const normalized = value.trim();
  if (normalized === 'UTC') return normalized;
  try {
    // Throws RangeError when the timezone is unknown.
    new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date());
  } catch {
    throw new BadRequestError('timezone must reference a real IANA timezone');
  }
  return normalized;
};
