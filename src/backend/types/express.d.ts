/**
 * Type definitions for Express Request extensions
 */

/**
 * Authenticated user interface with minimal required properties
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  city?: string | null;
  country?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      token?: string;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    inviteGroupId?: string;
  }
}
