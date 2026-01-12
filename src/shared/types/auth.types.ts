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

// Extend Passport's User interface to include our user properties
// This provides a single source of truth for user properties
declare global {
  namespace Express {
    // Extend the empty User interface from passport with our AuthenticatedUser properties
    interface User extends AuthenticatedUser {}
    
    interface Request {
      token?: string;
    }
  }
}

export {};
