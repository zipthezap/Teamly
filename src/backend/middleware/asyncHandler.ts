/**
 * Async Handler Middleware
 * Wraps async route handlers to catch errors and pass them to error handling middleware
 * This eliminates the need for try-catch blocks in every controller function
 */

import { Request, Response, NextFunction } from 'express';

type AsyncRequestHandler<ReqType extends Request = Request> = (
  req: ReqType,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

/**
 * Wraps an async route handler to automatically catch errors
 * @param fn - Async route handler function
 * @returns Wrapped handler that catches errors
 */
export const asyncHandler = <ReqType extends Request = Request>(fn: AsyncRequestHandler<ReqType>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req as ReqType, res, next)).catch(next);
  };
};
