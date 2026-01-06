/**
 * Input validation utilities for API requests
 * Provides consistent validation and error messages
 */

export class ValidationError extends Error {
  public readonly field?: string;
  public readonly code: string;

  constructor(message: string, field?: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
  }
}

/**
 * Validates that a value is not empty
 */
export function isRequired(value: unknown, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
  }
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates email and throws error if invalid
 */
export function validateEmail(email: string, fieldName: string = 'Email'): void {
  isRequired(email, fieldName);
  if (!isValidEmail(email)) {
    throw new ValidationError(`${fieldName} must be a valid email address`, fieldName, 'INVALID_EMAIL');
  }
}

/**
 * Validates password strength
 */
export function validatePassword(password: string, minLength: number = 6): void {
  isRequired(password, 'Password');
  
  if (password.length < minLength) {
    throw new ValidationError(
      `Password must be at least ${minLength} characters long`,
      'password',
      'PASSWORD_TOO_SHORT'
    );
  }
}

/**
 * Validates string length
 */
export function validateStringLength(
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): void {
  if (min !== undefined && value.length < min) {
    throw new ValidationError(
      `${fieldName} must be at least ${min} characters long`,
      fieldName,
      'STRING_TOO_SHORT'
    );
  }
  
  if (max !== undefined && value.length > max) {
    throw new ValidationError(
      `${fieldName} must not exceed ${max} characters`,
      fieldName,
      'STRING_TOO_LONG'
    );
  }
}

/**
 * Validates that a value is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validates UUID and throws error if invalid
 */
export function validateUUID(value: string, fieldName: string): void {
  isRequired(value, fieldName);
  if (!isValidUUID(value)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`, fieldName, 'INVALID_UUID');
  }
}

/**
 * Validates that a number is within a range
 */
export function validateNumberRange(
  value: number,
  fieldName: string,
  min?: number,
  max?: number
): void {
  if (isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number`, fieldName, 'INVALID_NUMBER');
  }
  
  if (min !== undefined && value < min) {
    throw new ValidationError(
      `${fieldName} must be at least ${min}`,
      fieldName,
      'NUMBER_TOO_SMALL'
    );
  }
  
  if (max !== undefined && value > max) {
    throw new ValidationError(
      `${fieldName} must not exceed ${max}`,
      fieldName,
      'NUMBER_TOO_LARGE'
    );
  }
}

/**
 * Validates that a date is valid
 */
export function validateDate(value: string | Date, fieldName: string): void {
  const date = value instanceof Date ? value : new Date(value);
  
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid date`, fieldName, 'INVALID_DATE');
  }
}

/**
 * Validates that a date is in the future
 */
export function validateFutureDate(value: string | Date, fieldName: string): void {
  validateDate(value, fieldName);
  
  const date = value instanceof Date ? value : new Date(value);
  const now = new Date();
  
  if (date <= now) {
    throw new ValidationError(`${fieldName} must be in the future`, fieldName, 'DATE_MUST_BE_FUTURE');
  }
}

/**
 * Validates that a value is one of allowed values
 */
export function validateEnum<T extends string>(
  value: string,
  fieldName: string,
  allowedValues: readonly T[]
): void {
  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      fieldName,
      'INVALID_ENUM_VALUE'
    );
  }
}

/**
 * Sanitizes a string by trimming whitespace
 */
export function sanitizeString(value: string): string {
  return value.trim();
}

/**
 * Validates and sanitizes input fields for an object
 */
export function validateAndSanitize<T extends Record<string, unknown>>(
  data: T,
  validators: Partial<Record<keyof T, (value: unknown) => void>>
): T {
  const sanitized = { ...data };
  
  for (const [key, validator] of Object.entries(validators)) {
    const value = sanitized[key as keyof T];
    
    if (validator && typeof validator === 'function') {
      validator(value);
      
      // Sanitize strings
      if (typeof value === 'string') {
        sanitized[key as keyof T] = sanitizeString(value) as T[keyof T];
      }
    }
  }
  
  return sanitized;
}
