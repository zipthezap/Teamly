// Mock for imageUtils to avoid import.meta issues in tests
import { vi } from 'vitest';

export const getImageUrl = vi.fn((picture?: string | null): string | undefined => {
  if (!picture) return undefined;
  if (typeof picture === 'string') return picture;
  return undefined;
});

export const getInitials = vi.fn((name?: string): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});
