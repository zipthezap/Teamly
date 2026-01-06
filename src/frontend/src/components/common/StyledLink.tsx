import React from 'react';
import { Link as RouterLink, LinkProps as RouterLinkProps } from 'react-router-dom';
import { Link as MuiLink, LinkProps as MuiLinkProps } from '@mui/material';

interface StyledLinkProps extends Omit<MuiLinkProps, 'component' | 'to'> {
  to: string;
}

/**
 * A styled Link component that combines react-router-dom's Link with Material-UI's Link styling.
 * Uses MUI's sx prop system to avoid inline styles.
 */
export const StyledLink: React.FC<StyledLinkProps> = ({ to, children, sx, ...props }) => {
  return (
    <MuiLink
      component={RouterLink}
      to={to}
      underline="none"
      sx={{
        color: 'primary.dark',
        '&:hover': {
          color: 'primary.main',
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiLink>
  );
};

export default StyledLink;
