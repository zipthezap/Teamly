/**
 * Common API response types and utility types
 */

// Generic API Success Response
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

// Generic API Error Response
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: any;
}

// API Response type (can be success or error)
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Pagination metadata
export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
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
  filter?: Record<string, any>;
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
