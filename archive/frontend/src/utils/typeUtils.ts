/**
 * Utility functions for type conversions and null handling
 */

/**
 * Converts null to undefined, leaves other values unchanged
 * Useful for MUI components that expect undefined instead of null
 */
export const nullToUndefined = <T>(value: T | null | undefined): T | undefined => {
  return value === null ? undefined : value;
};

/**
 * Converts undefined to null, leaves other values unchanged
 */
export const undefinedToNull = <T>(value: T | null | undefined): T | null => {
  return value === undefined ? null : value;
};

/**
 * Type guard to check if a value is defined (not null or undefined)
 */
export const isDefined = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};

/**
 * Safely access a property with null/undefined handling
 */
export const safeGet = <T, K extends keyof T>(
  obj: T | null | undefined,
  key: K
): T[K] | undefined => {
  return obj?.[key];
};

/**
 * Convert string|null to string|undefined
 */
export const toOptionalString = (value: string | null | undefined): string | undefined => {
  return value ?? undefined;
};

/**
 * Convert number|null to number|undefined
 */
export const toOptionalNumber = (value: number | null | undefined): number | undefined => {
  return value ?? undefined;
};
