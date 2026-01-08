import crypto from 'crypto';

/**
 * Generates a cryptographically secure invite token
 * @returns A 64-character hexadecimal string (32 bytes)
 */
export const createInviteToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};
