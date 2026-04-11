// Shared color palette for avatars
export const AVATAR_COLORS: string[] = [
  'primary.main',
  'secondary.main',
  'success.main',
  'warning.main',
];

// Get avatar color by index
export const getAvatarColor = (index: number): string => {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
};
