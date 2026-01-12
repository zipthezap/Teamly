/**
 * Type definitions for authenticated requests
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

export {};
