import { sanitizeString } from '../utils/validation';

/**
 * Sanitizes TeamUp request data inputs
 */
export const sanitizeTeamUpData = (data: {
  title?: string;
  description?: string;
  sportType?: string;
  location?: string;
  locationName?: string;
  city?: string;
  country?: string;
  skillLevel?: string;
  message?: string;
}) => {
  return {
    title: data.title ? sanitizeString(data.title) : undefined,
    description: data.description ? sanitizeString(data.description) : undefined,
    sportType: data.sportType ? sanitizeString(data.sportType) : undefined,
    location: data.location ? sanitizeString(data.location) : undefined,
    locationName: data.locationName ? sanitizeString(data.locationName) : undefined,
    city: data.city ? sanitizeString(data.city) : undefined,
    country: data.country ? sanitizeString(data.country) : undefined,
    skillLevel: data.skillLevel ? sanitizeString(data.skillLevel) : undefined,
    message: data.message ? sanitizeString(data.message) : undefined
  };
};
