/**
 * Security configuration constants
 * Centralized configuration for security-related settings
 */

/**
 * Account lockout configuration
 * Controls how many failed login attempts trigger an account lock
 */
export const ACCOUNT_LOCKOUT = {
  /**
   * Maximum number of failed login attempts before account is locked
   * Default: 5 attempts
   * Can be overridden via ACCOUNT_LOCKOUT_MAX_ATTEMPTS environment variable
   */
  MAX_ATTEMPTS: parseInt(process.env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS || '5', 10),
  
  /**
   * Duration in minutes for which the account will be locked
   * Default: 15 minutes
   * Can be overridden via ACCOUNT_LOCKOUT_DURATION_MINUTES environment variable
   */
  LOCK_DURATION_MINUTES: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MINUTES || '15', 10),
};

/**
 * Password reset configuration
 * Controls password reset token expiration
 */
export const PASSWORD_RESET = {
  /**
   * Duration in hours for which a password reset token is valid
   * Default: 1 hour
   * Can be overridden via PASSWORD_RESET_TOKEN_EXPIRY_HOURS environment variable
   */
  TOKEN_EXPIRY_HOURS: parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY_HOURS || '1', 10),
};

/**
 * Session configuration
 * Controls JWT token settings
 */
export const SESSION = {
  /**
   * JWT token expiration duration
   * Default: 7 days
   * Can be overridden via JWT_EXPIRY_DAYS environment variable
   */
  JWT_EXPIRY_DAYS: parseInt(process.env.JWT_EXPIRY_DAYS || '7', 10),
};

export default {
  ACCOUNT_LOCKOUT,
  PASSWORD_RESET,
  SESSION,
};
