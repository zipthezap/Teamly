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
  // Bounded quantifiers prevent catastrophic backtracking (ReDoS).
  // local@domain constraints: local ≤ 64 chars, domain ≤ 253 chars, TLD ≥ 2 chars.
  const emailRegex = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,63}$/;
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
 * Password validation constants
 */
const PASSWORD_REGEX = {
  UPPERCASE: /[A-Z]/,
  LOWERCASE: /[a-z]/,
  NUMBER: /[0-9]/,
  SPECIAL_CHAR: /[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?-]/,
};

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
  if (!PASSWORD_REGEX.UPPERCASE.test(password)) {
    throw new ValidationError(
      'Password must contain at least one uppercase letter',
      'password',
      'PASSWORD_MISSING_UPPERCASE'
    );
  }
  
  // Check for lowercase letter
  if (!PASSWORD_REGEX.LOWERCASE.test(password)) {
    throw new ValidationError(
      'Password must contain at least one lowercase letter',
      'password',
      'PASSWORD_MISSING_LOWERCASE'
    );
  }
  
  // Check for number
  if (!PASSWORD_REGEX.NUMBER.test(password)) {
    throw new ValidationError(
      'Password must contain at least one number',
      'password',
      'PASSWORD_MISSING_NUMBER'
    );
  }
  
  // Check for special character
  if (!PASSWORD_REGEX.SPECIAL_CHAR.test(password)) {
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
 * NOTE: This function should only be used when rendering to HTML views.
 * For JSON APIs with React/Vue frontends, the framework handles escaping.
 * @deprecated Use frontend escaping instead for JSON APIs
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
 * Sanitizes user input by trimming whitespace
 * Does not escape HTML - React handles XSS protection in the frontend
 */
export function sanitizeUserInput(value: string): string {
  return sanitizeString(value);
}

/**
 * Validates that a string doesn't contain CRLF characters
 * Used to prevent email header injection attacks
 */
export function validateNoCRLF(value: string, fieldName: string): void {
  if (/[\r\n]/.test(value)) {
    throw new ValidationError(
      `${fieldName} must not contain line breaks`,
      fieldName,
      'INVALID_CHARACTERS'
    );
  }
}

/**
 * Validates and sanitizes email subject to prevent header injection
 */
export function validateEmailSubject(subject: string): void {
  isRequired(subject, 'Email subject');
  validateNoCRLF(subject, 'Email subject');
  validateStringLength(subject, 'Email subject', 1, 255);
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

/**
 * Safely parses a string to a float and validates it's not NaN
 * @param value The value to parse
 * @param fieldName Name of the field for error messages
 * @returns The parsed float value
 * @throws ValidationError if the value cannot be parsed to a valid number
 */
export function parseFloatStrict(value: unknown, fieldName: string): number {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
  }

  const parsed = parseFloat(String(value));
  
  if (isNaN(parsed)) {
    throw new ValidationError(
      `${fieldName} must be a valid number`,
      fieldName,
      'INVALID_NUMBER'
    );
  }
  
  return parsed;
}

/**
 * Safely parses a string to an integer and validates it's not NaN
 * @param value The value to parse
 * @param fieldName Name of the field for error messages
 * @returns The parsed integer value
 * @throws ValidationError if the value cannot be parsed to a valid integer
 */
export function parseIntStrict(value: unknown, fieldName: string): number {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
  }

  const parsed = parseInt(String(value), 10);
  
  if (isNaN(parsed)) {
    throw new ValidationError(
      `${fieldName} must be a valid integer`,
      fieldName,
      'INVALID_INTEGER'
    );
  }
  
  return parsed;
}

/**
 * Safely parses coordinates (latitude and longitude) and validates them
 * @param latitude The latitude value to parse
 * @param longitude The longitude value to parse
 * @returns An object with parsed and validated lat and lon values
 * @throws ValidationError if coordinates are invalid
 */
export function parseCoordinates(
  latitude: unknown,
  longitude: unknown
): { lat: number; lon: number } {
  const lat = parseFloatStrict(latitude, 'Latitude');
  const lon = parseFloatStrict(longitude, 'Longitude');
  
  // Validate latitude range
  if (lat < -90 || lat > 90) {
    throw new ValidationError(
      'Latitude must be between -90 and 90',
      'latitude',
      'INVALID_COORDINATE'
    );
  }
  
  // Validate longitude range
  if (lon < -180 || lon > 180) {
    throw new ValidationError(
      'Longitude must be between -180 and 180',
      'longitude',
      'INVALID_COORDINATE'
    );
  }
  
  return { lat, lon };
}

/**
 * Safely parses pagination parameters with defaults and validation
 * @param limit The limit parameter
 * @param offset The offset parameter
 * @param maxLimit Maximum allowed limit (default: 100)
 * @param defaultLimit Default limit if not provided (default: 50)
 * @returns An object with validated limit and offset values
 */
export function parsePaginationParams(
  limit: unknown,
  offset: unknown,
  maxLimit: number = 100,
  defaultLimit: number = 50
): { limit: number; offset: number } {
  let parsedLimit = defaultLimit;
  let parsedOffset = 0;
  
  if (limit !== undefined && limit !== null && limit !== '') {
    const limitNum = parseInt(String(limit), 10);
    if (!isNaN(limitNum)) {
      parsedLimit = Math.max(1, Math.min(limitNum, maxLimit));
    }
  }
  
  if (offset !== undefined && offset !== null && offset !== '') {
    const offsetNum = parseInt(String(offset), 10);
    if (!isNaN(offsetNum)) {
      parsedOffset = Math.max(0, offsetNum);
    }
  }
  
  return { limit: parsedLimit, offset: parsedOffset };
}

/**
 * Validates an array of items with a per-item validator, collecting all errors.
 * Returns all violations at once rather than stopping on the first.
 * @param items The array to validate
 * @param fieldName Name of the array field (for error messages)
 * @param itemValidator A function that validates a single item (may throw ValidationError)
 * @param maxLength Maximum allowed array length
 * @throws ValidationError with all violations combined if any are found
 */
export function validateArray<T>(
  items: T[],
  fieldName: string,
  itemValidator: (item: T, index: number) => void,
  maxLength?: number
): void {
  if (maxLength !== undefined && items.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must not exceed ${maxLength} items`,
      fieldName,
      'ARRAY_TOO_LONG'
    );
  }

  const errors: string[] = [];
  for (let i = 0; i < items.length; i++) {
    try {
      itemValidator(items[i], i);
    } catch (err) {
      if (err instanceof ValidationError) {
        errors.push(`${fieldName}[${i}]: ${err.message}`);
      } else if (err instanceof Error) {
        errors.push(`${fieldName}[${i}]: ${err.message}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join('; '), fieldName, 'ARRAY_ITEM_INVALID');
  }
}

/**
 * Validates a UUID v4 string
 */
export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Validates a UUID and throws if invalid
 */
export function validateUUID(value: string, fieldName: string): void {
  if (!isValidUUID(value)) {
    throw new ValidationError(
      `${fieldName} must be a valid UUID`,
      fieldName,
      'INVALID_UUID'
    );
  }
}

/**
 * Validates a number range
 */
export function validateNumberRange(
  value: number,
  fieldName: string,
  min?: number,
  max?: number
): void {
  if (!isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`, fieldName, 'INVALID_NUMBER');
  }
  if (min !== undefined && value < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName, 'NUMBER_TOO_SMALL');
  }
  if (max !== undefined && value > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`, fieldName, 'NUMBER_TOO_LARGE');
  }
}

/**
 * Validates a date string is a valid ISO date
 */
export function validateDate(value: string | Date, fieldName: string): void {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid date`, fieldName, 'INVALID_DATE');
  }
}

/**
 * Validates a date string is in the future
 */
export function validateFutureDate(value: string | Date, fieldName: string): void {
  validateDate(value, fieldName);
  const date = value instanceof Date ? value : new Date(value);
  if (date <= new Date()) {
    throw new ValidationError(`${fieldName} must be in the future`, fieldName, 'DATE_MUST_BE_FUTURE');
  }
}

/**
 * Validates an enum value
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
