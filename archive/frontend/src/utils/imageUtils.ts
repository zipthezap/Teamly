/**
 * Constructs a full image URL from a relative path or returns the URL as-is if it's already absolute
 * @param picture - The picture path (relative or absolute URL)
 * @param fallback - Optional fallback image URL if picture is not provided
 * @returns Full image URL or fallback (undefined if no picture or fallback)
 */
export const getImageUrl = (picture?: string | null, fallback?: string | null): string | undefined => {
  if (!picture) {
    return fallback ?? undefined;
  }
  
  // If picture is already a full URL, return it as is
  if (picture.startsWith('http://') || picture.startsWith('https://')) {
    return picture;
  }
  
  // If picture is a relative path, construct full URL
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  if (!apiBaseUrl) {
    // In production, images should be served from the same origin
    return picture;
  }
  
  // Remove /api from the end if it exists
  const baseUrl = apiBaseUrl.replace(/\/api$/, '');
  return `${baseUrl}${picture}`;
};

/**
 * Generates initials from a name (up to 2 characters)
 * @param name - The name to generate initials from
 * @returns Initials (1-2 characters) or '?' if name is empty
 */
export const getInitials = (name?: string): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
