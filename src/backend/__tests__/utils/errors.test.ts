import {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  LockedError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
} from '../../utils/errors';

describe('ApiError', () => {
  it('should create an ApiError with all properties', () => {
    const error = new ApiError('Test error', 500, true, 'TEST_CODE');
    
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('ApiError');
    expect(error.stack).toBeDefined();
  });

  it('should use default values when optional parameters are not provided', () => {
    const error = new ApiError('Test error');
    
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error.code).toBeUndefined();
  });

  it('should capture stack trace', () => {
    const error = new ApiError('Test error');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ApiError');
  });
});

describe('BadRequestError', () => {
  it('should create a 400 error with default message', () => {
    const error = new BadRequestError();
    
    expect(error.message).toBe('Bad Request');
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('BadRequestError');
  });

  it('should create a 400 error with custom message and code', () => {
    const error = new BadRequestError('Invalid input', 'INVALID_INPUT');
    
    expect(error.message).toBe('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('INVALID_INPUT');
  });
});

describe('UnauthorizedError', () => {
  it('should create a 401 error with default message', () => {
    const error = new UnauthorizedError();
    
    expect(error.message).toBe('Unauthorized');
    expect(error.statusCode).toBe(401);
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('UnauthorizedError');
  });

  it('should create a 401 error with custom message and code', () => {
    const error = new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    
    expect(error.message).toBe('Invalid credentials');
    expect(error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('ForbiddenError', () => {
  it('should create a 403 error with default message', () => {
    const error = new ForbiddenError();
    
    expect(error.message).toBe('Forbidden');
    expect(error.statusCode).toBe(403);
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('ForbiddenError');
  });

  it('should create a 403 error with custom message and code', () => {
    const error = new ForbiddenError('Insufficient permissions', 'INSUFFICIENT_PERMISSIONS');
    
    expect(error.message).toBe('Insufficient permissions');
    expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });
});

describe('NotFoundError', () => {
  it('should create a 404 error with default message', () => {
    const error = new NotFoundError();
    
    expect(error.message).toBe('Resource not found');
    expect(error.statusCode).toBe(404);
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('NotFoundError');
  });

  it('should create a 404 error with custom message and code', () => {
    const error = new NotFoundError('User not found', 'USER_NOT_FOUND');
    
    expect(error.message).toBe('User not found');
    expect(error.code).toBe('USER_NOT_FOUND');
  });
});

describe('ConflictError', () => {
  it('should create a 409 error with default message', () => {
    const error = new ConflictError();
    
    expect(error.message).toBe('Resource conflict');
    expect(error.statusCode).toBe(409);
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('ConflictError');
  });

  it('should create a 409 error with custom message and code', () => {
    const error = new ConflictError('Email already exists', 'EMAIL_EXISTS');
    
    expect(error.message).toBe('Email already exists');
    expect(error.code).toBe('EMAIL_EXISTS');
  });
});

describe('ValidationError', () => {
  it('should create a 422 error with default message', () => {
    const error = new ValidationError();
    
    expect(error.message).toBe('Validation failed');
    expect(error.statusCode).toBe(422);
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('ValidationError');
  });

  it('should create a 422 error with custom message and code', () => {
    const error = new ValidationError('Invalid email format', 'INVALID_EMAIL');
    
    expect(error.message).toBe('Invalid email format');
    expect(error.code).toBe('INVALID_EMAIL');
  });
});

describe('LockedError', () => {
  it('should create a 423 error with default message', () => {
    const error = new LockedError();
    
    expect(error.message).toBe('Resource locked');
    expect(error.statusCode).toBe(423);
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('LockedError');
  });

  it('should create a 423 error with custom message and code', () => {
    const error = new LockedError('Account is locked', 'ACCOUNT_LOCKED');
    
    expect(error.message).toBe('Account is locked');
    expect(error.code).toBe('ACCOUNT_LOCKED');
  });
});

describe('TooManyRequestsError', () => {
  it('should create a 429 error with default message', () => {
    const error = new TooManyRequestsError();
    
    expect(error.message).toBe('Too many requests');
    expect(error.statusCode).toBe(429);
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe('TooManyRequestsError');
  });

  it('should create a 429 error with custom message and code', () => {
    const error = new TooManyRequestsError('Rate limit exceeded', 'RATE_LIMIT');
    
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.code).toBe('RATE_LIMIT');
  });
});

describe('InternalServerError', () => {
  it('should create a 500 error with default message', () => {
    const error = new InternalServerError();
    
    expect(error.message).toBe('Internal server error');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(false);
    expect(error.name).toBe('InternalServerError');
  });

  it('should create a 500 error with custom message and code', () => {
    const error = new InternalServerError('Database connection failed', 'DB_ERROR');
    
    expect(error.message).toBe('Database connection failed');
    expect(error.code).toBe('DB_ERROR');
    expect(error.isOperational).toBe(false);
  });
});

describe('ServiceUnavailableError', () => {
  it('should create a 503 error with default message', () => {
    const error = new ServiceUnavailableError();
    
    expect(error.message).toBe('Service unavailable');
    expect(error.statusCode).toBe(503);
    expect(error.isOperational).toBe(false);
    expect(error.name).toBe('ServiceUnavailableError');
  });

  it('should create a 503 error with custom message and code', () => {
    const error = new ServiceUnavailableError('Maintenance mode', 'MAINTENANCE');
    
    expect(error.message).toBe('Maintenance mode');
    expect(error.code).toBe('MAINTENANCE');
    expect(error.isOperational).toBe(false);
  });
});

describe('Error inheritance and instanceof checks', () => {
  it('BadRequestError should be an instance of ApiError and Error', () => {
    const error = new BadRequestError();
    expect(error).toBeInstanceOf(BadRequestError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
  });

  it('UnauthorizedError should be an instance of ApiError and Error', () => {
    const error = new UnauthorizedError();
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
  });

  it('ForbiddenError should be an instance of ApiError and Error', () => {
    const error = new ForbiddenError();
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
  });

  it('NotFoundError should be an instance of ApiError and Error', () => {
    const error = new NotFoundError();
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
  });

  it('ConflictError should be an instance of ApiError and Error', () => {
    const error = new ConflictError();
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
  });

  it('ValidationError should be an instance of ApiError and Error', () => {
    const error = new ValidationError();
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
  });

  it('LockedError should be an instance of ApiError and Error', () => {
    const error = new LockedError();
    expect(error).toBeInstanceOf(LockedError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
  });

  it('TooManyRequestsError should be an instance of ApiError and Error', () => {
    const error = new TooManyRequestsError();
    expect(error).toBeInstanceOf(TooManyRequestsError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
  });

  it('InternalServerError should be an instance of ApiError and Error', () => {
    const error = new InternalServerError();
    expect(error).toBeInstanceOf(InternalServerError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
  });

  it('ServiceUnavailableError should be an instance of ApiError and Error', () => {
    const error = new ServiceUnavailableError();
    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ApiError isOperational flag', () => {
  it('operational errors have isOperational true', () => {
    expect(new BadRequestError().isOperational).toBe(true);
    expect(new UnauthorizedError().isOperational).toBe(true);
    expect(new ForbiddenError().isOperational).toBe(true);
    expect(new NotFoundError().isOperational).toBe(true);
    expect(new ConflictError().isOperational).toBe(true);
    expect(new ValidationError().isOperational).toBe(true);
    expect(new LockedError().isOperational).toBe(true);
    expect(new TooManyRequestsError().isOperational).toBe(true);
  });

  it('non-operational errors have isOperational false', () => {
    expect(new InternalServerError().isOperational).toBe(false);
    expect(new ServiceUnavailableError().isOperational).toBe(false);
  });
});
