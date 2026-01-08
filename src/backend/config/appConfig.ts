/**
 * Centralized Application Configuration
 * Provides type-safe access to environment variables and application settings
 */

import { logger } from '../utils/logger';

interface AppConfig {
  // Server configuration
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  isDevelopment: boolean;

  // Database configuration
  databaseUrl: string;

  // Security configuration
  jwtSecret: string;
  jwtExpiryDays: number;
  
  // CORS configuration
  frontendUrl: string;
  corsOrigin: string | string[];

  // Rate limiting configuration
  rateLimitWindow: number;
  rateLimitMaxRequests: number;
  authRateLimitMaxRequests: number;

  // Email configuration
  emailHost?: string;
  emailPort?: number;
  emailUser?: string;
  emailPassword?: string;
  emailFrom?: string;

  // Feature flags
  enableEmailNotifications: boolean;
  enableTwoFactor: boolean;

  // Performance configuration
  slowRequestThresholdMs: number;
  requestBodySizeLimit: string;
}

/**
 * Parses boolean from string or returns default
 */
const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

/**
 * Parses integer from string or returns default
 */
const parseInteger = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Loads and validates application configuration
 */
const loadConfig = (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';

  const config: AppConfig = {
    // Server
    port: parseInteger(process.env.PORT, 3000),
    nodeEnv,
    isProduction,
    isDevelopment,

    // Database
    databaseUrl: process.env.DATABASE_URL || '',

    // Security
    jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
    jwtExpiryDays: parseInteger(process.env.JWT_EXPIRY_DAYS, 7),

    // CORS
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
    corsOrigin: isProduction 
      ? process.env.FRONTEND_URL || 'http://localhost:3001'
      : '*',

    // Rate limiting
    rateLimitWindow: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000), // 15 minutes
    rateLimitMaxRequests: parseInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 300),
    authRateLimitMaxRequests: parseInteger(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 5),

    // Email
    emailHost: process.env.EMAIL_HOST,
    emailPort: parseInteger(process.env.EMAIL_PORT, 587),
    emailUser: process.env.EMAIL_USER,
    emailPassword: process.env.EMAIL_PASSWORD,
    emailFrom: process.env.EMAIL_FROM || 'noreply@teamly.app',

    // Feature flags
    enableEmailNotifications: parseBoolean(process.env.ENABLE_EMAIL_NOTIFICATIONS, true),
    enableTwoFactor: parseBoolean(process.env.ENABLE_TWO_FACTOR, true),

    // Performance
    slowRequestThresholdMs: parseInteger(process.env.SLOW_REQUEST_THRESHOLD_MS, 1000),
    requestBodySizeLimit: process.env.REQUEST_BODY_SIZE_LIMIT || '10mb',
  };

  // Warn about missing critical configuration in production
  if (isProduction) {
    if (!config.databaseUrl) {
      logger.warn('DATABASE_URL is not set', 'Config');
    }
    if (config.jwtSecret === 'development-secret-change-in-production') {
      logger.warn('JWT_SECRET is using default value - this is insecure!', 'Config');
    }
  }

  return config;
};

// Export singleton config instance
export const config = loadConfig();

/**
 * Logs the current configuration (without sensitive values)
 */
export const logConfig = (): void => {
  logger.info('Application configuration loaded', 'Config', {
    nodeEnv: config.nodeEnv,
    port: config.port,
    isProduction: config.isProduction,
    corsOrigin: config.corsOrigin,
    enableEmailNotifications: config.enableEmailNotifications,
    enableTwoFactor: config.enableTwoFactor,
    slowRequestThreshold: `${config.slowRequestThresholdMs}ms`,
    requestBodySizeLimit: config.requestBodySizeLimit
  });
};
