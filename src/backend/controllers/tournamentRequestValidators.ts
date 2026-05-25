import { BadRequestError } from '../utils/errors';

export const parseEnumInput = <T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string
): T => {
  if (typeof value !== 'string' || !allowedValues.includes(value as T)) {
    throw new BadRequestError(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
  }
  return value as T;
};

export const normalizeIdArrayInput = (
  value: unknown,
  fieldName: string,
  maxItems: number
): string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestError(`${fieldName} must be a non-empty array`);
  }
  if (value.length > maxItems) {
    throw new BadRequestError(`${fieldName} cannot exceed ${maxItems} items`);
  }

  const normalized = [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    ),
  ];

  if (normalized.length === 0) {
    throw new BadRequestError(`${fieldName} must contain at least one valid id`);
  }

  return normalized;
};
