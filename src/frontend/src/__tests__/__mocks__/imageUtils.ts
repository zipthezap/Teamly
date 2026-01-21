// Mock for imageUtils to avoid import.meta issues in tests
export const getImageUrl = jest.fn((picture?: string | null): string | undefined => {
  if (!picture) return undefined;
  if (typeof picture === 'string') return picture;
  return undefined;
});

export const getInitials = jest.fn((name?: string): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});
