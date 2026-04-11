/**
 * ProfileAvatar Component
 * Reusable avatar component for displaying user profile pictures
 */

import React from 'react';
import Avatar, { AvatarProps } from '@mui/material/Avatar';
import { getImageUrl, getInitials } from '../../utils/imageUtils';

export interface ProfileAvatarProps extends Omit<AvatarProps, 'src' | 'children'> {
  /** User's profile picture URL string or object with url property */
  picture?: { url: string } | string | null;
  /** User's name for generating initials */
  name: string;
  /** Size of the avatar in pixels */
  size?: number;
  /** Alternative variant (default is 'circular') */
  variant?: 'circular' | 'rounded' | 'square';
  /** Background color for avatar (when no picture) */
  bgcolor?: string;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  picture,
  name,
  size = 40,
  variant = 'circular',
  bgcolor = 'primary.main',
  sx,
  ...props
}) => {
  // Handle both string and object picture formats
  const pictureUrl = typeof picture === 'string' 
    ? picture 
    : (picture && typeof picture === 'object' && 'url' in picture) 
      ? picture.url 
      : null;
  const imageUrl = getImageUrl(pictureUrl);
  const initials = getInitials(name);

  return (
    <Avatar
      src={imageUrl || undefined}
      variant={variant}
      sx={{
        width: size,
        height: size,
        bgcolor: imageUrl ? undefined : bgcolor,
        ...sx,
      }}
      {...props}
    >
      {!imageUrl && initials}
    </Avatar>
  );
};

export default ProfileAvatar;
