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

/**
 * Transaction configuration
 * Controls database transaction settings
 */
export const TRANSACTION = {
  /**
   * Maximum time to wait for a transaction lock in milliseconds
   * Default: 5000ms (5 seconds)
   * Can be overridden via TRANSACTION_MAX_WAIT_MS environment variable
   */
  MAX_WAIT_MS: parseInt(process.env.TRANSACTION_MAX_WAIT_MS || '5000', 10),
  
  /**
   * Transaction timeout in milliseconds
   * Default: 10000ms (10 seconds)
   * Can be overridden via TRANSACTION_TIMEOUT_MS environment variable
   */
  TIMEOUT_MS: parseInt(process.env.TRANSACTION_TIMEOUT_MS || '10000', 10),
};

/**
 * Email retry configuration
 * Controls email delivery retry behavior
 */
export const EMAIL_RETRY = {
  /**
   * Base delay between retries in milliseconds
   * Default: 300000ms (5 minutes)
   * Can be overridden via EMAIL_RETRY_BASE_DELAY_MS environment variable
   */
  BASE_DELAY_MS: parseInt(process.env.EMAIL_RETRY_BASE_DELAY_MS || '300000', 10),
  
  /**
   * Exponential backoff multiplier
   * Default: 2 (delays: 5min, 10min, 20min, etc.)
   * Can be overridden via EMAIL_RETRY_BACKOFF_MULTIPLIER environment variable
   */
  BACKOFF_MULTIPLIER: parseFloat(process.env.EMAIL_RETRY_BACKOFF_MULTIPLIER || '2'),
};

export default {
  ACCOUNT_LOCKOUT,
  PASSWORD_RESET,
  SESSION,
  TRANSACTION,
  EMAIL_RETRY,
};
