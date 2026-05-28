/**
 * Schema-based request body validator middleware.
 *
 * Accepts a schema mapping field names to validator functions and runs ALL validators
 * before short-circuiting, so clients receive every violation in one response rather
 * than one at a time.
 *
 * Usage:
 *   router.post('/foo', validateBody({ name: (v) => isRequired(v, 'name') }), handler);
 */

import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../utils/errors';
import { ValidationError } from '../utils/validation';

type Validator = (value: unknown) => void;

export type BodySchema = Record<string, Validator>;

/**
 * Creates an Express middleware that validates req.body against the provided schema.
 * All violations are collected and returned in a single 400 response with the
 * `fields` array populated.
 */
export function validateBody(schema: BodySchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const violations: { field: string; message: string }[] = [];

    for (const [field, validator] of Object.entries(schema)) {
      try {
        validator(req.body?.[field]);
      } catch (err) {
        if (err instanceof ValidationError) {
          violations.push({ field, message: err.message });
        } else if (err instanceof BadRequestError) {
          violations.push({ field, message: err.message });
        } else if (err instanceof Error) {
          violations.push({ field, message: err.message });
        }
      }
    }

    if (violations.length > 0) {
      const message = violations.map((v) => `${v.field}: ${v.message}`).join('; ');
      const fields = violations.map((v) => v.field);
      return next(new BadRequestError(message, 'VALIDATION_ERROR', undefined, fields));
    }

    next();
  };
}
