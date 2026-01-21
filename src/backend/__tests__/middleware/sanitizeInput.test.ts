import { Request, Response, NextFunction } from 'express';
import { sanitizeInput } from '../../middleware/sanitizeInput';

describe('Sanitize Input Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      params: {},
    };
    mockResponse = {};
    mockNext = jest.fn();
  });

  describe('sanitizeInput', () => {
    it('should trim whitespace from body strings', () => {
      mockRequest.body = {
        name: '  John Doe  ',
        email: ' test@example.com ',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.name).toBe('John Doe');
      expect(mockRequest.body.email).toBe('test@example.com');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should trim whitespace from nested objects', () => {
      mockRequest.body = {
        user: {
          name: '  Jane Doe  ',
          address: {
            street: '  123 Main St  ',
            city: ' New York ',
          },
        },
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.user.name).toBe('Jane Doe');
      expect(mockRequest.body.user.address.street).toBe('123 Main St');
      expect(mockRequest.body.user.address.city).toBe('New York');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should trim whitespace from arrays', () => {
      mockRequest.body = {
        tags: ['  sports  ', ' basketball ', '  outdoor  '],
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.tags).toEqual(['sports', 'basketball', 'outdoor']);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should trim whitespace from query parameters', () => {
      mockRequest.query = {
        search: '  test query  ',
        sort: ' name ',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.query.search).toBe('test query');
      expect(mockRequest.query.sort).toBe('name');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should trim whitespace from route parameters', () => {
      mockRequest.params = {
        id: '  123  ',
        slug: ' event-name ',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.params.id).toBe('123');
      expect(mockRequest.params.slug).toBe('event-name');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve non-string values', () => {
      mockRequest.body = {
        age: 25,
        active: true,
        score: 99.5,
        tags: null,
        description: undefined,
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.age).toBe(25);
      expect(mockRequest.body.active).toBe(true);
      expect(mockRequest.body.score).toBe(99.5);
      expect(mockRequest.body.tags).toBeNull();
      expect(mockRequest.body.description).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty strings', () => {
      mockRequest.body = {
        name: '',
        email: '   ',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.name).toBe('');
      expect(mockRequest.body.email).toBe('');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle arrays of objects with strings', () => {
      mockRequest.body = {
        users: [
          { name: '  Alice  ', email: ' alice@example.com ' },
          { name: '  Bob  ', email: ' bob@example.com ' },
        ],
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.users[0].name).toBe('Alice');
      expect(mockRequest.body.users[0].email).toBe('alice@example.com');
      expect(mockRequest.body.users[1].name).toBe('Bob');
      expect(mockRequest.body.users[1].email).toBe('bob@example.com');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle deeply nested structures', () => {
      mockRequest.body = {
        level1: {
          level2: {
            level3: {
              value: '  deeply nested  ',
            },
          },
        },
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.level1.level2.level3.value).toBe('deeply nested');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle mixed data types in arrays', () => {
      mockRequest.body = {
        mixed: ['  string  ', 42, true, null, { name: '  nested  ' }],
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.mixed[0]).toBe('string');
      expect(mockRequest.body.mixed[1]).toBe(42);
      expect(mockRequest.body.mixed[2]).toBe(true);
      expect(mockRequest.body.mixed[3]).toBeNull();
      expect(mockRequest.body.mixed[4].name).toBe('nested');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty body, query, and params', () => {
      mockRequest.body = {};
      mockRequest.query = {};
      mockRequest.params = {};

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body).toEqual({});
      expect(mockRequest.query).toEqual({});
      expect(mockRequest.params).toEqual({});
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle null body', () => {
      mockRequest.body = null;

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle undefined body', () => {
      mockRequest.body = undefined;

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve special characters while trimming', () => {
      mockRequest.body = {
        description: '  Text with @#$%^&*() special chars!  ',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.description).toBe('Text with @#$%^&*() special chars!');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve newlines and tabs inside strings', () => {
      mockRequest.body = {
        text: '  Line 1\nLine 2\tTabbed  ',
      };

      sanitizeInput(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body.text).toBe('Line 1\nLine 2\tTabbed');
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
