import React, { ReactNode } from 'react';
import { useTheme } from '@mui/material/styles';

interface FormContainerProps {
  children: ReactNode;
  maxWidth?: string | number;
  className?: string;
}

/**
 * Reusable container for form pages with consistent styling
 */
export const FormContainer: React.FC<FormContainerProps> = ({
  children,
  maxWidth = '28rem',
  className = '',
}) => {
  const theme = useTheme();

  return (
    <div className={`mx-auto mt-16 w-full`} style={{ maxWidth }}>
      <div
        className={`rounded-xl p-8 ${className}`}
        style={{
          background: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 12px 30px rgba(2, 6, 23, 0.25)'
              : '0 10px 24px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div className="flex flex-col items-center">
          {children}
        </div>
      </div>
    </div>
  );
};
