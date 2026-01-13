/**
 * Type definitions for controller request/response patterns
 */

import { Request } from 'express';
import { AuthenticatedUser } from './express';

/**
 * Authenticated request with typed user
 */
export interface AuthenticatedRequest<TBody = any, TParams = any, TQuery = any> extends Request<TParams, any, TBody, TQuery> {
  user: AuthenticatedUser;
  token?: string;
}

/**
 * Helper type for route parameters
 */
export type RouteParams<T extends string> = {
  [K in T]: string;
};

/**
 * Common query parameters
 */
export interface PaginationQuery {
  page?: string;
  limit?: string;
  offset?: string;
}

export interface SearchQuery {
  search?: string;
  q?: string;
}

export interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
}

export interface LocationQuery {
  latitude?: string;
  longitude?: string;
  maxDistance?: string;
}
