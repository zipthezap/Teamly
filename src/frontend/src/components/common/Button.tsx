import React from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps, CircularProgress } from '@mui/material';

export interface ButtonProps extends MuiButtonProps {
  loading?: boolean;
}

/**
 * Enhanced button component with loading state
 */
export const Button: React.FC<ButtonProps> = ({ 
  children, 
  loading = false,
  disabled,
  startIcon,
  ...props 
}) => {
  return (
    <MuiButton
      {...props}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
    >
      {children}
    </MuiButton>
  );
};

export default Button;
