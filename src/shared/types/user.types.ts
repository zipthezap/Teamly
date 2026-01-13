export interface UserProfilePicture {
  id: string;
  userId: string;
  url: string;
  createdAt: Date | string;
  isCurrent: boolean;
  deletedAt?: Date | string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  updatedAt: Date | string;
}
/**
 * User-related TypeScript interfaces based on Prisma schema
 */

// Main User interface
export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  // Two-Factor Authentication
  twoFactorEnabled: boolean;
  twoFactorSecret?: string | null;
  twoFactorBackupCodes: string[];
  // Email notification fields
  emailNotifications: boolean;
  emailVerified: boolean;
  emailVerificationToken?: string | null;
  // Password reset fields
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | string | null;
  // Security fields
  failedLoginAttempts: number;
  accountLockedUntil?: Date | string | null;
  // Location fields
  city?: string | null;
  country?: string | null;
  address?: string | null;
  postalCode?: string | null;
  discoveryRadius?: number | null;
  // Profile picture
  profilePicture?: string | null;
  profilePictures?: UserProfilePicture[];
}

// User data without sensitive fields (for public-facing APIs)
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  city?: string | null;
  country?: string | null;
  profilePicture?: string | null;
  profilePictures?: UserProfilePicture[];
  online?: boolean;  // Online status (optional, may be added by some endpoints)
}

// User data for profile responses
export interface UserProfile extends Omit<User, 'password' | 'twoFactorSecret' | 'twoFactorBackupCodes' | 'emailVerificationToken' | 'passwordResetToken'> {
}

// User registration data
export interface UserRegistrationData {
  email: string;
  password: string;
  name: string;
}

// User login data
export interface UserLoginData {
  email: string;
  password: string;
  twoFactorToken?: string;
}

// User update data
export interface UserUpdateData {
  name?: string;
  city?: string;
  country?: string;
  address?: string;
  postalCode?: string;
  discoveryRadius?: number;
  emailNotifications?: boolean;
}

// Password update data
export interface PasswordUpdateData {
  currentPassword?: string;
  newPassword: string;
}

// JWT Token Payload
export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

// Auth response
export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: PublicUser;
}

// Refresh Token
export interface RefreshToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date | string;
  createdAt: Date | string;
}

// Revoked Token
export interface RevokedToken {
  id: string;
  token: string;
  userId: string;
  revokedAt: Date | string;
  expiresAt: Date | string;
  reason?: string | null;
}

// User Session
export interface UserSession {
  id: string;
  userId: string;
  token: string;
  deviceInfo?: string | null;
  ipAddress?: string | null;
  lastActive: Date | string;
  createdAt: Date | string;
  expiresAt: Date | string;
}
