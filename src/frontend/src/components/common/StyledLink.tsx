import React from 'react';
import { Link as RouterLink, LinkProps as RouterLinkProps } from 'react-router-dom';

interface StyledLinkProps extends Omit<RouterLinkProps, 'to'> {
  to: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A styled Link component that combines react-router-dom's Link with custom Tailwind styling.
 */
export const StyledLink: React.FC<StyledLinkProps> = ({ to, children, className, ...props }) => {
  return (
    <RouterLink
      to={to}
      className={`text-blue-600 hover:text-blue-800 transition underline-offset-2 hover:underline font-medium ${className || ''}`}
      {...props}
    >
      {children}
    </RouterLink>
  );
};

export default StyledLink;
