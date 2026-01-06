import React, { ReactNode } from 'react';
import { Box, Typography, SxProps, Theme } from '@mui/material';

interface FormHeaderProps {
  icon?: ReactNode;
  title: string;
  iconSx?: SxProps<Theme>;
}

/**
 * Reusable form header with optional icon and title
 */
export const FormHeader: React.FC<FormHeaderProps> = ({ 
  icon, 
  title,
  iconSx = { fontSize: 48, mb: 2, color: 'primary.main' }
}) => {
  return (
    <>
      {icon && (
        <Box sx={iconSx}>
          {icon}
        </Box>
      )}
      <Typography variant="h4" component="h1" gutterBottom>
        {title}
      </Typography>
    </>
  );
};
