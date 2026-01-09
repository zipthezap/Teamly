/**
 * Constructs a full image URL from a relative path or returns the URL as-is if it's already absolute
 * @param picture - The picture path (relative or absolute URL)
 * @param fallback - Optional fallback image URL if picture is not provided
 * @returns Full image URL or fallback
 */
export const getImageUrl = (picture?: string, fallback?: string | null): string | null => {
  if (!picture) {
    return fallback ?? null;
  }
  
  // If picture is already a full URL, return it as is
  if (picture.startsWith('http://') || picture.startsWith('https://')) {
    return picture;
  }
  
  // If picture is a relative path, construct full URL
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  if (!apiBaseUrl) {
    console.warn('VITE_API_URL is not set. Image URLs may not work correctly.');
    // In production, images should be served from the same origin
    return picture;
  }
  
  // Remove /api from the end if it exists
  const baseUrl = apiBaseUrl.replace(/\/api$/, '');
  return `${baseUrl}${picture}`;
};
