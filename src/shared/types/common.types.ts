/**
 * Common API response types and utility types
 */

// Generic API Success Response
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: PaginationMeta;
  };
}

// Generic API Error Response
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

// API Response type (can be success or error)
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Pagination metadata
export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage?: boolean;
  hasPreviousPage?: boolean;
}

// Pagination query params
export interface PaginationParams {
  page?: number;
  perPage?: number;
  limit?: number;
  offset?: number;
}

// Sort params
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Generic search params
export interface SearchParams extends PaginationParams, SortParams {
  search?: string;
  filter?: Record<string, unknown>;
}

// Validation error
export interface ValidationError {
  field: string;
  message: string;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  error?: string;
  errors?: ValidationError[];
}

// Coordinates
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Location data
export interface LocationData {
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
}

// Date range
export interface DateRange {
  startDate?: Date | string;
  endDate?: Date | string;
}

// Status counts
export interface StatusCounts {
  [status: string]: number;
}

// ID parameter
export type ID = string | number;

// Optional ID
export type OptionalID = ID | null | undefined;
