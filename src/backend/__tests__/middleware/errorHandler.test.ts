import { Request, Response, NextFunction } from 'express';
import { errorHandler, isPrismaError, prismaErrorHandler } from '../../middleware/errorHandler';
import { ApiError, BadRequestError, NotFoundError, ConflictError } from '../../utils/errors';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from '../../utils/logger';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      path: '/test-path',
      method: 'GET',
    };
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('errorHandler', () => {
    it('should handle ApiError with 400 status', () => {
      const error = new BadRequestError('Invalid request');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid request',
        code: undefined,
      });
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should handle ApiError with 404 status', () => {
      const error = new NotFoundError('Resource not found', 'RESOURCE_NOT_FOUND');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Resource not found',
        code: 'RESOURCE_NOT_FOUND',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle ApiError with 409 status', () => {
      const error = new ConflictError('Email already exists', 'EMAIL_EXISTS');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Email already exists',
        code: 'EMAIL_EXISTS',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle ApiError with 500 status and log as error', () => {
      const error = new ApiError('Internal error', 500, false, 'INTERNAL_ERROR');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Internal error',
        code: 'INTERNAL_ERROR',
      });
      expect(logger.error).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should handle generic Error as 500', () => {
      const error = new Error('Unexpected error');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unexpected error',
        code: undefined,
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Test error',
        code: undefined,
        stack: 'Error stack trace',
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Test error',
        code: undefined,
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('isPrismaError', () => {
    it('should return true for Prisma error codes starting with P', () => {
      const error = { code: 'P2002', name: 'PrismaClientKnownRequestError' };
      expect(isPrismaError(error)).toBe(true);
    });

    it('should return true for errors with Prisma in the name', () => {
      const error = { name: 'PrismaClientValidationError' };
      expect(isPrismaError(error)).toBe(true);
    });

    it('should return false for non-Prisma errors', () => {
      const error = new Error('Regular error');
      expect(isPrismaError(error)).toBe(false);
    });

    it('should return false for errors without code or name', () => {
      const error = { message: 'Some error' };
      expect(isPrismaError(error)).toBe(false);
    });
  });

  describe('prismaErrorHandler', () => {
    it('should handle P2002 unique constraint violation', () => {
      const prismaError = {
        code: 'P2002',
        meta: { target: ['email'] },
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('A record with this email already exists');
      expect(apiError.statusCode).toBe(409);
      expect(apiError.code).toBe('DUPLICATE_RECORD');
    });

    it('should handle P2003 foreign key constraint violation', () => {
      const prismaError = {
        code: 'P2003',
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('Related record not found');
      expect(apiError.statusCode).toBe(400);
      expect(apiError.code).toBe('INVALID_REFERENCE');
    });

    it('should handle P2025 record not found', () => {
      const prismaError = {
        code: 'P2025',
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('Record not found');
      expect(apiError.statusCode).toBe(404);
      expect(apiError.code).toBe('NOT_FOUND');
    });

    it('should handle P1001 database connection error', () => {
      const prismaError = {
        code: 'P1001',
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('Database connection error');
      expect(apiError.statusCode).toBe(503);
      expect(apiError.code).toBe('DATABASE_CONNECTION_ERROR');
      expect(apiError.isOperational).toBe(false);
    });

    it('should handle P1002 database connection error', () => {
      const prismaError = {
        code: 'P1002',
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('Database connection error');
      expect(apiError.statusCode).toBe(503);
      expect(apiError.code).toBe('DATABASE_CONNECTION_ERROR');
    });

    it('should handle P2024 timeout error', () => {
      const prismaError = {
        code: 'P2024',
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('Database operation timed out');
      expect(apiError.statusCode).toBe(504);
      expect(apiError.code).toBe('DATABASE_TIMEOUT');
    });

    it('should handle PrismaClientValidationError', () => {
      const prismaError = {
        name: 'PrismaClientValidationError',
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('Invalid data provided');
      expect(apiError.statusCode).toBe(400);
      expect(apiError.code).toBe('VALIDATION_ERROR');
    });

    it('should handle PrismaClientInitializationError', () => {
      const prismaError = {
        name: 'PrismaClientInitializationError',
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('Database initialization error');
      expect(apiError.statusCode).toBe(503);
      expect(apiError.code).toBe('DATABASE_INIT_ERROR');
    });

    it('should handle PrismaClientKnownRequestError', () => {
      const prismaError = {
        name: 'PrismaClientKnownRequestError',
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('Database request error');
      expect(apiError.statusCode).toBe(500);
      expect(apiError.code).toBe('DATABASE_REQUEST_ERROR');
    });

    it('should handle unknown Prisma errors', () => {
      const prismaError = {
        code: 'P9999',
        name: 'UnknownPrismaError',
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('Database operation failed');
      expect(apiError.statusCode).toBe(500);
      expect(apiError.code).toBe('DATABASE_ERROR');
    });

    it('should handle P2002 with non-array target', () => {
      const prismaError = {
        code: 'P2002',
        meta: { target: 'email' }, // not an array
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('A record with this field already exists');
      expect(apiError.statusCode).toBe(409);
    });

    it('should handle P2002 without meta', () => {
      const prismaError = {
        code: 'P2002',
      };

      const apiError = prismaErrorHandler(prismaError);

      expect(apiError.message).toBe('A record with this field already exists');
      expect(apiError.statusCode).toBe(409);
    });
  });

  describe('errorHandler with Prisma errors', () => {
    it('should convert Prisma errors to ApiErrors before handling', () => {
      const prismaError = {
        code: 'P2002',
        meta: { target: ['email'] },
        message: 'Unique constraint failed',
        name: 'PrismaClientKnownRequestError',
        stack: 'stack trace',
      };

      errorHandler(
        prismaError as unknown as Error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'A record with this email already exists',
        code: 'DUPLICATE_RECORD',
      });
    });
  });
});
