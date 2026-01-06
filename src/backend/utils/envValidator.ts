/**
 * Environment variable validation utility
 * Validates required environment variables on application startup
 */

interface EnvVarConfig {
  name: string;
  required: boolean;
  defaultValue?: string;
  validate?: (value: string) => boolean;
  errorMessage?: string;
}

const ENV_VARS: EnvVarConfig[] = [
  {
    name: 'DATABASE_URL',
    required: true,
    validate: (value: string) => value.startsWith('postgresql://'),
    errorMessage: 'DATABASE_URL must be a valid PostgreSQL connection string'
  },
  {
    name: 'JWT_SECRET',
    required: true,
    validate: (value: string) => value.length >= 32,
    errorMessage: 'JWT_SECRET must be at least 32 characters long for security'
  },
  {
    name: 'PORT',
    required: false,
    defaultValue: '3000',
    validate: (value: string) => !isNaN(Number(value)) && Number(value) > 0 && Number(value) < 65536,
    errorMessage: 'PORT must be a valid port number (1-65535)'
  },
  {
    name: 'NODE_ENV',
    required: false,
    defaultValue: 'development'
  },
  {
    name: 'EMAIL_FROM',
    required: false,
    defaultValue: 'noreply@teamly.app',
    validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    errorMessage: 'EMAIL_FROM must be a valid email address'
  }
];

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

/**
 * Validates all environment variables and returns validation results
 */
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const config of ENV_VARS) {
    const value = process.env[config.name];

    // Check if required variable is missing
    if (config.required && !value) {
      errors.push(`Missing required environment variable: ${config.name}`);
      continue;
    }

    // Set default value if not provided
    if (!value && config.defaultValue) {
      process.env[config.name] = config.defaultValue;
      continue;
    }

    // Validate value if validator provided
    if (value && config.validate && !config.validate(value)) {
      errors.push(config.errorMessage || `Invalid value for ${config.name}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates environment variables and throws an error if validation fails
 * Should be called at application startup
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();

  if (!result.valid) {
    const errorMessage = 'Environment validation failed:\n' + result.errors.map(e => `  - ${e}`).join('\n');
    throw new EnvironmentValidationError(errorMessage);
  }
}

/**
 * Gets an environment variable with a type-safe return
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value || defaultValue!;
}

/**
 * Gets a numeric environment variable
 */
export function getEnvNumber(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${name} is not set`);
    }
    return defaultValue;
  }
  
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${name} is not a valid number`);
  }
  
  return num;
}

/**
 * Gets a boolean environment variable
 */
export function getEnvBoolean(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  
  return value.toLowerCase() === 'true' || value === '1';
}
