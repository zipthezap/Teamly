/**
 * Custom Error Classes
 * Provides structured error handling with HTTP status codes
 */

/**
 * Base API Error class
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad Request', code?: string) {
    super(message, 400, true, code);
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized', code?: string) {
    super(message, 401, true, code);
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden', code?: string) {
    super(message, 403, true, code);
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found', code?: string) {
    super(message, 404, true, code);
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends ApiError {
  constructor(message: string = 'Resource conflict', code?: string) {
    super(message, 409, true, code);
  }
}

/**
 * 422 Unprocessable Entity
 */
export class ValidationError extends ApiError {
  constructor(message: string = 'Validation failed', code?: string) {
    super(message, 422, true, code);
  }
}

/**
 * 423 Locked
 */
export class LockedError extends ApiError {
  constructor(message: string = 'Resource locked', code?: string) {
    super(message, 423, true, code);
  }
}

/**
 * 429 Too Many Requests
 */
export class TooManyRequestsError extends ApiError {
  constructor(message: string = 'Too many requests', code?: string) {
    super(message, 429, true, code);
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error', code?: string) {
    super(message, 500, false, code);
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service unavailable', code?: string) {
    super(message, 503, false, code);
  }
}
