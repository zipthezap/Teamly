// Shared color palette for avatars
export const AVATAR_COLORS = [
  'primary.main',
  'secondary.main',
  'success.main',
  'warning.main',
];

// Get avatar color by index
export const getAvatarColor = (index) => {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
};
