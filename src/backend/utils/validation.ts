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
 * Note: This is a basic email validation. For production use, consider a library like 'validator.js'
 * for more comprehensive RFC 5322 compliance and edge case handling.
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
 * Validates password with strong requirements
 * Requires at least 8 characters, uppercase, lowercase, number, and special character
 */
export function validateStrongPassword(password: string): void {
  isRequired(password, 'Password');
  
  if (password.length < 8) {
    throw new ValidationError(
      'Password must be at least 8 characters long',
      'password',
      'PASSWORD_TOO_SHORT'
    );
  }
  
  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    throw new ValidationError(
      'Password must contain at least one uppercase letter',
      'password',
      'PASSWORD_MISSING_UPPERCASE'
    );
  }
  
  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    throw new ValidationError(
      'Password must contain at least one lowercase letter',
      'password',
      'PASSWORD_MISSING_LOWERCASE'
    );
  }
  
  // Check for number
  if (!/[0-9]/.test(password)) {
    throw new ValidationError(
      'Password must contain at least one number',
      'password',
      'PASSWORD_MISSING_NUMBER'
    );
  }
  
  // Check for special character
  if (!/[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?-]/.test(password)) {
    throw new ValidationError(
      'Password must contain at least one special character',
      'password',
      'PASSWORD_MISSING_SPECIAL'
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
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
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
  if (!Number.isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a valid finite number`, fieldName, 'INVALID_NUMBER');
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
 * Escapes HTML special characters to prevent XSS attacks
 * This should be used for user-generated content that will be displayed as HTML
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Sanitizes user input to prevent XSS and other injection attacks
 * Trims whitespace and escapes HTML characters
 */
export function sanitizeUserInput(value: string): string {
  return escapeHtml(sanitizeString(value));
}

/**
 * Validates and sanitizes string fields in an object based on provided validators.
 * Only validates fields that have validators provided. All string values are sanitized (trimmed).
 */
export function validateAndSanitize<T extends Record<string, unknown>>(
  data: T,
  validators: Partial<Record<keyof T, (value: unknown) => void>>
): T {
  const sanitized = { ...data };
  
  for (const key of Object.keys(validators)) {
    const typedKey = key as keyof T;
    const validator = validators[typedKey];
    const value = sanitized[typedKey];
    
    if (validator && typeof validator === 'function') {
      validator(value);
    }
    
    // Sanitize strings
    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeString(value);
    }
  }
  
  return sanitized;
}
