import React from 'react';
import { Link as RouterLink, LinkProps as RouterLinkProps } from 'react-router-dom';

  to: string;
  className?: string;
}

/**
 * A styled Link component that combines react-router-dom's Link with Material-UI's Link styling.
 * Uses MUI's sx prop system to avoid inline styles.
 */
  return (
    <RouterLink
      to={to}
      className={`text-blue-600 hover:text-blue-800 transition underline-offset-2 hover:underline font-medium ${props.className || ''}`}
      {...props}
    >
      {children}
    </RouterLink>
  );
};

export default StyledLink;
