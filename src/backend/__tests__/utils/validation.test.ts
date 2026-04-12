import { vi } from 'vitest';
import {
  ValidationError,
  isRequired,
  isValidEmail,
  validateEmail,
  validatePassword,
  validateStrongPassword,
  validateStringLength,
  isValidUUID,
  validateUUID,
  validateNumberRange,
  validateDate,
  validateFutureDate,
  validateEnum,
  sanitizeString,
  sanitizeUserInput,
  escapeHtml,
  validateNoCRLF,
  validateEmailSubject,
  validateAndSanitize,
  parseFloatStrict,
  parseIntStrict,
  parseCoordinates,
  parsePaginationParams,
} from '../../utils/validation';

describe('ValidationError', () => {
  it('should create a ValidationError with message, field, and code', () => {
    const error = new ValidationError('Test error', 'testField', 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.field).toBe('testField');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('ValidationError');
  });

  it('should use default code when not provided', () => {
    const error = new ValidationError('Test error', 'testField');
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('isRequired', () => {
  it('should throw ValidationError when value is undefined', () => {
    expect(() => isRequired(undefined, 'testField')).toThrow(ValidationError);
    expect(() => isRequired(undefined, 'testField')).toThrow('testField is required');
  });

  it('should throw ValidationError when value is null', () => {
    expect(() => isRequired(null, 'testField')).toThrow(ValidationError);
  });

  it('should throw ValidationError when value is empty string', () => {
    expect(() => isRequired('', 'testField')).toThrow(ValidationError);
  });

  it('should not throw when value is valid', () => {
    expect(() => isRequired('value', 'testField')).not.toThrow();
    expect(() => isRequired(0, 'testField')).not.toThrow();
    expect(() => isRequired(false, 'testField')).not.toThrow();
  });
});

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@example.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.com')).toBe(true);
  });

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('invalid@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('invalid@example')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('validateEmail', () => {
  it('should not throw for valid email addresses', () => {
    expect(() => validateEmail('test@example.com')).not.toThrow();
  });

  it('should throw ValidationError for invalid email', () => {
    expect(() => validateEmail('invalid')).toThrow(ValidationError);
    expect(() => validateEmail('invalid')).toThrow('Email must be a valid email address');
  });

  it('should throw ValidationError for empty email', () => {
    expect(() => validateEmail('')).toThrow(ValidationError);
  });

  it('should use custom field name in error message', () => {
    expect(() => validateEmail('invalid', 'User Email')).toThrow('User Email');
  });
});

describe('validatePassword', () => {
  it('should not throw for valid password', () => {
    expect(() => validatePassword('password123')).not.toThrow();
  });

  it('should throw ValidationError for password shorter than minimum length', () => {
    expect(() => validatePassword('short')).toThrow(ValidationError);
    expect(() => validatePassword('short')).toThrow('Password must be at least 6 characters long');
  });

  it('should throw ValidationError for empty password', () => {
    expect(() => validatePassword('')).toThrow(ValidationError);
  });

  it('should accept custom minimum length', () => {
    expect(() => validatePassword('password123', 15)).toThrow('Password must be at least 15 characters long');
    expect(() => validatePassword('verylongpassword', 15)).not.toThrow();
  });
});

describe('validateStrongPassword', () => {
  it('should not throw for strong password', () => {
    expect(() => validateStrongPassword('StrongP@ss1')).not.toThrow();
  });

  it('should throw ValidationError for password without uppercase', () => {
    expect(() => validateStrongPassword('strongp@ss1')).toThrow('Password must contain at least one uppercase letter');
  });

  it('should throw ValidationError for password without lowercase', () => {
    expect(() => validateStrongPassword('STRONGP@SS1')).toThrow('Password must contain at least one lowercase letter');
  });

  it('should throw ValidationError for password without number', () => {
    expect(() => validateStrongPassword('StrongP@ss')).toThrow('Password must contain at least one number');
  });

  it('should throw ValidationError for password without special character', () => {
    expect(() => validateStrongPassword('StrongPass1')).toThrow('Password must contain at least one special character');
  });

  it('should throw ValidationError for password shorter than 8 characters', () => {
    expect(() => validateStrongPassword('Str0ng!')).toThrow('Password must be at least 8 characters long');
  });
});

describe('validateStringLength', () => {
  it('should not throw for string within valid length range', () => {
    expect(() => validateStringLength('test', 'field', 1, 10)).not.toThrow();
  });

  it('should throw ValidationError for string shorter than minimum', () => {
    expect(() => validateStringLength('ab', 'field', 5)).toThrow('field must be at least 5 characters long');
  });

  it('should throw ValidationError for string longer than maximum', () => {
    expect(() => validateStringLength('toolong', 'field', undefined, 5)).toThrow('field must not exceed 5 characters');
  });
});

describe('isValidUUID', () => {
  it('should return true for valid UUID', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('should return false for invalid UUID', () => {
    expect(isValidUUID('invalid-uuid')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
    expect(isValidUUID('')).toBe(false);
  });
});

describe('validateUUID', () => {
  it('should not throw for valid UUID', () => {
    expect(() => validateUUID('550e8400-e29b-41d4-a716-446655440000', 'id')).not.toThrow();
  });

  it('should throw ValidationError for invalid UUID', () => {
    expect(() => validateUUID('invalid', 'id')).toThrow('id must be a valid UUID');
  });
});

describe('validateNumberRange', () => {
  it('should not throw for number within valid range', () => {
    expect(() => validateNumberRange(5, 'field', 1, 10)).not.toThrow();
  });

  it('should throw ValidationError for number below minimum', () => {
    expect(() => validateNumberRange(0, 'field', 1)).toThrow('field must be at least 1');
  });

  it('should throw ValidationError for number above maximum', () => {
    expect(() => validateNumberRange(15, 'field', undefined, 10)).toThrow('field must not exceed 10');
  });

  it('should throw ValidationError for non-finite number', () => {
    expect(() => validateNumberRange(NaN, 'field')).toThrow('field must be a valid finite number');
    expect(() => validateNumberRange(Infinity, 'field')).toThrow('field must be a valid finite number');
  });
});

describe('validateDate', () => {
  it('should not throw for valid date string', () => {
    expect(() => validateDate('2024-01-01', 'date')).not.toThrow();
  });

  it('should not throw for valid Date object', () => {
    expect(() => validateDate(new Date(), 'date')).not.toThrow();
  });

  it('should throw ValidationError for invalid date', () => {
    expect(() => validateDate('invalid-date', 'date')).toThrow('date must be a valid date');
  });
});

describe('validateFutureDate', () => {
  it('should not throw for future date', () => {
    const futureDate = new Date(Date.now() + 86400000); // Tomorrow
    expect(() => validateFutureDate(futureDate, 'date')).not.toThrow();
  });

  it('should throw ValidationError for past date', () => {
    const pastDate = new Date('2020-01-01');
    expect(() => validateFutureDate(pastDate, 'date')).toThrow('date must be in the future');
  });
});

describe('validateEnum', () => {
  const allowedValues = ['RED', 'GREEN', 'BLUE'] as const;

  it('should not throw for allowed value', () => {
    expect(() => validateEnum('RED', 'color', allowedValues)).not.toThrow();
  });

  it('should throw ValidationError for disallowed value', () => {
    expect(() => validateEnum('YELLOW', 'color', allowedValues)).toThrow('color must be one of: RED, GREEN, BLUE');
  });
});

describe('sanitizeString', () => {
  it('should trim whitespace from string', () => {
    expect(sanitizeString('  test  ')).toBe('test');
    expect(sanitizeString('\n  test\t')).toBe('test');
  });

  it('should return string unchanged if no whitespace', () => {
    expect(sanitizeString('test')).toBe('test');
  });
});

describe('sanitizeUserInput', () => {
  it('should trim whitespace from user input', () => {
    expect(sanitizeUserInput('  user input  ')).toBe('user input');
  });
});

describe('validateNoCRLF', () => {
  it('should not throw for string without line breaks', () => {
    expect(() => validateNoCRLF('valid string', 'field')).not.toThrow();
  });

  it('should throw ValidationError for string with carriage return', () => {
    expect(() => validateNoCRLF('invalid\rstring', 'field')).toThrow('field must not contain line breaks');
  });

  it('should throw ValidationError for string with line feed', () => {
    expect(() => validateNoCRLF('invalid\nstring', 'field')).toThrow('field must not contain line breaks');
  });
});

describe('validateEmailSubject', () => {
  it('should not throw for valid email subject', () => {
    expect(() => validateEmailSubject('Valid Subject')).not.toThrow();
  });

  it('should throw ValidationError for empty subject', () => {
    expect(() => validateEmailSubject('')).toThrow(ValidationError);
  });

  it('should throw ValidationError for subject with line breaks', () => {
    expect(() => validateEmailSubject('Invalid\nSubject')).toThrow(ValidationError);
  });

  it('should throw ValidationError for subject exceeding 255 characters', () => {
    const longSubject = 'a'.repeat(256);
    expect(() => validateEmailSubject(longSubject)).toThrow('Email subject must not exceed 255 characters');
  });
});

describe('parseFloatStrict', () => {
  it('should parse valid float string', () => {
    expect(parseFloatStrict('3.14', 'field')).toBe(3.14);
    expect(parseFloatStrict('42', 'field')).toBe(42);
  });

  it('should throw ValidationError for undefined', () => {
    expect(() => parseFloatStrict(undefined, 'field')).toThrow('field is required');
  });

  it('should throw ValidationError for null', () => {
    expect(() => parseFloatStrict(null, 'field')).toThrow('field is required');
  });

  it('should throw ValidationError for non-numeric string', () => {
    expect(() => parseFloatStrict('invalid', 'field')).toThrow('field must be a valid number');
  });
});

describe('parseIntStrict', () => {
  it('should parse valid integer string', () => {
    expect(parseIntStrict('42', 'field')).toBe(42);
    expect(parseIntStrict('-10', 'field')).toBe(-10);
  });

  it('should throw ValidationError for undefined', () => {
    expect(() => parseIntStrict(undefined, 'field')).toThrow('field is required');
  });

  it('should throw ValidationError for null', () => {
    expect(() => parseIntStrict(null, 'field')).toThrow('field is required');
  });

  it('should throw ValidationError for non-numeric string', () => {
    expect(() => parseIntStrict('invalid', 'field')).toThrow('field must be a valid integer');
  });
});

describe('parseCoordinates', () => {
  it('should parse valid coordinates', () => {
    const result = parseCoordinates('40.7128', '-74.0060');
    expect(result.lat).toBe(40.7128);
    expect(result.lon).toBe(-74.0060);
  });

  it('should throw ValidationError for latitude out of range', () => {
    expect(() => parseCoordinates('91', '0')).toThrow('Latitude must be between -90 and 90');
    expect(() => parseCoordinates('-91', '0')).toThrow('Latitude must be between -90 and 90');
  });

  it('should throw ValidationError for longitude out of range', () => {
    expect(() => parseCoordinates('0', '181')).toThrow('Longitude must be between -180 and 180');
    expect(() => parseCoordinates('0', '-181')).toThrow('Longitude must be between -180 and 180');
  });

  it('should throw ValidationError for invalid coordinates', () => {
    expect(() => parseCoordinates('invalid', '0')).toThrow(ValidationError);
  });
});

describe('parsePaginationParams', () => {
  it('should use default values when parameters are not provided', () => {
    const result = parsePaginationParams(undefined, undefined);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('should parse valid limit and offset', () => {
    const result = parsePaginationParams('10', '20');
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(20);
  });

  it('should clamp limit to maximum value', () => {
    const result = parsePaginationParams('200', '0', 100);
    expect(result.limit).toBe(100);
  });

  it('should ensure limit is at least 1', () => {
    const result = parsePaginationParams('0', '0');
    expect(result.limit).toBe(1);
  });

  it('should ensure offset is non-negative', () => {
    const result = parsePaginationParams('10', '-5');
    expect(result.offset).toBe(0);
  });

  it('should use custom default limit', () => {
    const result = parsePaginationParams(undefined, undefined, 100, 25);
    expect(result.limit).toBe(25);
  });

  it('should handle empty string values', () => {
    const result = parsePaginationParams('', '');
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('should handle non-numeric string values and use defaults', () => {
    const result = parsePaginationParams('abc', 'xyz');
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });
});

describe('escapeHtml', () => {
  it('should escape ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('should escape less-than and greater-than', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('should escape double quotes', () => {
    expect(escapeHtml('"value"')).toBe('&quot;value&quot;');
  });

  it('should escape single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('should escape forward slashes', () => {
    expect(escapeHtml('a/b')).toBe('a&#x2F;b');
  });

  it('should escape a full XSS payload', () => {
    const input = '<script>alert("xss")</script>';
    const result = escapeHtml(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
  });

  it('should return unchanged string when no special characters', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('should return empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('validateAndSanitize', () => {
  it('should sanitize string fields that have validators', () => {
    const result = validateAndSanitize(
      { name: '  Alice  ', age: 30 },
      { name: (_v) => {} }
    );
    expect(result.name).toBe('Alice');
    expect(result.age).toBe(30);
  });

  it('should run validators for specified fields', () => {
    const validator = vi.fn();
    validateAndSanitize({ email: 'test@example.com' }, { email: validator });
    expect(validator).toHaveBeenCalledWith('test@example.com');
  });

  it('should throw if validator throws', () => {
    const validator = () => { throw new ValidationError('bad', 'email'); };
    expect(() =>
      validateAndSanitize({ email: 'bad' }, { email: validator })
    ).toThrow(ValidationError);
  });

  it('should not modify non-string fields', () => {
    const result = validateAndSanitize({ count: 5 }, {});
    expect(result.count).toBe(5);
  });

  it('should not sanitize fields without validators', () => {
    const result = validateAndSanitize(
      { name: '  Alice  ', bio: '  bio text  ' },
      { name: (_v) => {} }
    );
    expect(result.name).toBe('Alice');
    // bio has no validator so it is not processed
    expect(result.bio).toBe('  bio text  ');
  });

  it('should run multiple validators on different fields', () => {
    const nameValidator = vi.fn();
    const emailValidator = vi.fn();
    validateAndSanitize(
      { name: '  Bob  ', email: '  bob@example.com  ' },
      { name: nameValidator, email: emailValidator }
    );
    expect(nameValidator).toHaveBeenCalledWith('  Bob  ');
    expect(emailValidator).toHaveBeenCalledWith('  bob@example.com  ');
  });
});

describe('ValidationError - instanceof checks', () => {
  it('should be an instance of Error', () => {
    const error = new ValidationError('test', 'field');
    expect(error).toBeInstanceOf(Error);
  });

  it('should be an instance of ValidationError', () => {
    const error = new ValidationError('test', 'field');
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('should work without field parameter', () => {
    const error = new ValidationError('test');
    expect(error.field).toBeUndefined();
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('parseCoordinates - boundary values', () => {
  it('should accept boundary latitude -90', () => {
    const result = parseCoordinates('-90', '0');
    expect(result.lat).toBe(-90);
  });

  it('should accept boundary latitude 90', () => {
    const result = parseCoordinates('90', '0');
    expect(result.lat).toBe(90);
  });

  it('should accept boundary longitude -180', () => {
    const result = parseCoordinates('0', '-180');
    expect(result.lon).toBe(-180);
  });

  it('should accept boundary longitude 180', () => {
    const result = parseCoordinates('0', '180');
    expect(result.lon).toBe(180);
  });

  it('should throw for null latitude', () => {
    expect(() => parseCoordinates(null, '0')).toThrow('Latitude is required');
  });
});
