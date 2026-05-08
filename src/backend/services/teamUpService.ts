import { BadRequestError } from '../utils/errors';
import { sanitizeString } from '../utils/validation';

export const VALID_REQUEST_TYPES = ['need_players', 'looking_for_play'] as const;
export type TeamUpRequestType = (typeof VALID_REQUEST_TYPES)[number];

export const VALID_SKILL_LEVELS = ['any', 'beginner', 'intermediate', 'advanced'] as const;
export type TeamUpSkillLevel = (typeof VALID_SKILL_LEVELS)[number];

export const TEAMUP_LIMITS = {
  title: 100,
  description: 1000,
  message: 500,
  location: 200,
  locationName: 120,
  city: 100,
  country: 100,
  sportType: 50,
  skillLevel: 20,
  positionName: 50,
} as const;

type TeamUpPositionInput = {
  name?: unknown;
  slotsNeeded?: unknown;
  skillLevelRequired?: unknown;
};

type TeamUpRequestWithPositionData = {
  positions?: Array<{ id: string; slotsNeeded: number }>;
  responses?: Array<{ status: string; requestPositionId?: string | null }>;
};

export const sanitizeTeamUpData = (data: {
  title?: string;
  description?: string;
  sportType?: string;
  location?: string;
  locationName?: string;
  city?: string;
  country?: string;
  skillLevel?: string;
  message?: string;
}) => {
  return {
    title: data.title ? sanitizeString(data.title) : undefined,
    description: data.description ? sanitizeString(data.description) : undefined,
    sportType: data.sportType ? sanitizeString(data.sportType) : undefined,
    location: data.location ? sanitizeString(data.location) : undefined,
    locationName: data.locationName ? sanitizeString(data.locationName) : undefined,
    city: data.city ? sanitizeString(data.city) : undefined,
    country: data.country ? sanitizeString(data.country) : undefined,
    skillLevel: data.skillLevel ? sanitizeString(data.skillLevel) : undefined,
    message: data.message ? sanitizeString(data.message) : undefined,
  };
};

export const assertMaxLength = (
  value: string | null | undefined,
  fieldName: string,
  maxLength: number
): void => {
  if (value && value.length > maxLength) {
    throw new BadRequestError(`${fieldName} must be ${maxLength} characters or fewer`);
  }
};

export const validateTeamUpTextLengths = (data: {
  title?: string | null;
  description?: string | null;
  sportType?: string | null;
  location?: string | null;
  locationName?: string | null;
  city?: string | null;
  country?: string | null;
  skillLevel?: string | null;
  message?: string | null;
}): void => {
  assertMaxLength(data.title, 'title', TEAMUP_LIMITS.title);
  assertMaxLength(data.description, 'description', TEAMUP_LIMITS.description);
  assertMaxLength(data.sportType, 'sportType', TEAMUP_LIMITS.sportType);
  assertMaxLength(data.location, 'location', TEAMUP_LIMITS.location);
  assertMaxLength(data.locationName, 'locationName', TEAMUP_LIMITS.locationName);
  assertMaxLength(data.city, 'city', TEAMUP_LIMITS.city);
  assertMaxLength(data.country, 'country', TEAMUP_LIMITS.country);
  assertMaxLength(data.skillLevel, 'skillLevel', TEAMUP_LIMITS.skillLevel);
  assertMaxLength(data.message, 'message', TEAMUP_LIMITS.message);
};

export const parseSkillLevel = (skillLevel: unknown, fieldName: string): string | null => {
  const normalized =
    typeof skillLevel === 'string' ? sanitizeString(skillLevel).toLowerCase() : '';
  if (!normalized) return null;
  if (!VALID_SKILL_LEVELS.includes(normalized as TeamUpSkillLevel)) {
    throw new BadRequestError(
      `${fieldName} must be one of: ${VALID_SKILL_LEVELS.join(', ')}`
    );
  }
  return normalized;
};

export const parseTeamUpPositions = (positionsInput: unknown) => {
  if (positionsInput === undefined || positionsInput === null) return [];
  if (!Array.isArray(positionsInput)) {
    throw new BadRequestError('positions must be an array');
  }

  const parsed = positionsInput.map((raw, index) => {
    const position = raw as TeamUpPositionInput;
    const sanitizedName =
      typeof position.name === 'string' ? sanitizeString(position.name) : '';

    if (!sanitizedName) {
      throw new BadRequestError(`positions[${index}].name is required`);
    }
    assertMaxLength(
      sanitizedName,
      `positions[${index}].name`,
      TEAMUP_LIMITS.positionName
    );

    const slotsNeeded = Number.parseInt(String(position.slotsNeeded ?? 1), 10);
    if (!Number.isFinite(slotsNeeded) || slotsNeeded < 1) {
      throw new BadRequestError(`positions[${index}].slotsNeeded must be at least 1`);
    }

    const skillLevelRequired = parseSkillLevel(
      position.skillLevelRequired,
      `positions[${index}].skillLevelRequired`
    );

    return {
      name: sanitizedName,
      slotsNeeded,
      skillLevelRequired,
    };
  });

  const normalizedNames = parsed.map((position) => position.name.toLowerCase());
  const seenNames = new Set<string>();
  const duplicateNames = normalizedNames.filter((name) => {
    if (seenNames.has(name)) return true;
    seenNames.add(name);
    return false;
  });
  if (duplicateNames.length > 0) {
    throw new BadRequestError('positions cannot contain duplicate names');
  }

  return parsed;
};

export const deriveRequestLevelFieldsFromPositions = (
  parsedPositions: Array<{ slotsNeeded: number; skillLevelRequired: string | null }>
) => {
  const derivedPlayersNeeded = parsedPositions.reduce(
    (sum, position) => sum + position.slotsNeeded,
    0
  );
  const presentSkillLevels = parsedPositions
    .map((position) => position.skillLevelRequired)
    .filter((skill): skill is string => Boolean(skill));
  const uniqueSkillLevels = [...new Set(presentSkillLevels)];
  const derivedSkillLevel = uniqueSkillLevels.length === 1 ? uniqueSkillLevels[0] : null;
  return { derivedPlayersNeeded, derivedSkillLevel };
};

export const withPositionAvailability = <T extends TeamUpRequestWithPositionData>(request: T) => {
  const acceptedByPosition = new Map<string, number>();
  (request.responses ?? [])
    .filter((response) => response.status === 'accepted' && response.requestPositionId)
    .forEach((response) => {
      const positionId = response.requestPositionId as string;
      acceptedByPosition.set(positionId, (acceptedByPosition.get(positionId) ?? 0) + 1);
    });

  const positionsWithAvailability = (request.positions ?? []).map((position) => {
    const acceptedCount = acceptedByPosition.get(position.id) ?? 0;
    const slotsAvailable = Math.max(position.slotsNeeded - acceptedCount, 0);
    return {
      ...position,
      acceptedCount,
      slotsAvailable,
      isOpen: slotsAvailable > 0,
    };
  });

  return {
    ...request,
    positions: positionsWithAvailability,
  };
};

export const normalizeLocationToken = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return normalized || null;
};
