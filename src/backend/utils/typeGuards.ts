/**
 * Type guard utilities for runtime type checking
 * Provides safe type narrowing without unsafe 'as' assertions
 */

/**
 * Type guard for Prisma unique constraint errors
 */
export function isPrismaUniqueError(error: unknown): error is { code: string; meta?: { target?: string[] } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    (error as Record<string, unknown>).code === 'P2002'
  );
}

/**
 * Type guard for Prisma record not found errors
 */
export function isPrismaNotFoundError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    (error as Record<string, unknown>).code === 'P2025'
  );
}

/**
 * Type guard for objects with a code property
 */
export function hasErrorCode(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  );
}

/**
 * Type guard for objects with an id property
 */
export function hasId(obj: unknown): obj is { id: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    typeof (obj as Record<string, unknown>).id === 'string'
  );
}

/**
 * Type guard for user objects with id, email, and name
 */
export function isUserWithEmail(obj: unknown): obj is { id: string; email: string; name: string } {
  const record = obj as Record<string, unknown>;
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj &&
    'name' in obj &&
    typeof record.id === 'string' &&
    typeof record.email === 'string' &&
    typeof record.name === 'string'
  );
}

/**
 * Type guard for objects with emailNotifications property
 */
export function hasEmailNotifications(obj: unknown): obj is { emailNotifications: boolean } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'emailNotifications' in obj &&
    typeof (obj as Record<string, unknown>).emailNotifications === 'boolean'
  );
}

/**
 * Type guard for JWT decode result with exp property
 */
export function hasExpiration(obj: unknown): obj is { exp: number } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'exp' in obj &&
    typeof (obj as Record<string, unknown>).exp === 'number'
  );
}

/**
 * Type guard for objects with groupId property
 */
export function hasGroupId(obj: unknown): obj is { groupId: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'groupId' in obj &&
    typeof (obj as Record<string, unknown>).groupId === 'string'
  );
}

/**
 * Type guard for Prisma query event logging
 */
export function isPrismaQueryEvent(obj: unknown): obj is { duration: number; query: string; params: string } {
  const record = obj as Record<string, unknown>;
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'duration' in obj &&
    'query' in obj &&
    'params' in obj &&
    typeof record.duration === 'number' &&
    typeof record.query === 'string' &&
    typeof record.params === 'string'
  );
}

/**
 * Type guard for location objects
 */
export function hasLocation(obj: unknown): obj is { 
  latitude: number | null; 
  longitude: number | null;
  locationName?: string | null;
  city?: string | null;
  country?: string | null;
} {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  
  const o = obj as Record<string, unknown>;
  
  return (
    'latitude' in o &&
    'longitude' in o &&
    (o.latitude === null || typeof o.latitude === 'number') &&
    (o.longitude === null || typeof o.longitude === 'number')
  );
}
