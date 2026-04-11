/**
 * Common UI Components
 * Reusable components for loading states, errors, and empty states
 */

import React from 'react';
import { Box, Alert, CircularProgress, Typography } from '@mui/material';

interface LoadingStateProps {
  message?: string;
  size?: number;
}

/**
 * Standard loading state component
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Loading...', 
  size = 40 
}) => {
  return (
    <Box 
      display="flex" 
      flexDirection="column" 
      alignItems="center" 
      justifyContent="center" 
      minHeight="200px"
      gap={2}
    >
      <CircularProgress size={size} />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  severity?: 'error' | 'warning' | 'info';
}

/**
 * Standard error state component
 */
export const ErrorState: React.FC<ErrorStateProps> = ({ 
  message, 
  onRetry,
  severity = 'error'
}) => {
  return (
    <Box my={2}>
      <Alert 
        severity={severity}
        action={
          onRetry ? (
            <button 
              onClick={onRetry}
              style={{ 
                textDecoration: 'underline', 
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                color: 'inherit'
              }}
            >
              Retry
            </button>
          ) : undefined
        }
      >
        {message}
      </Alert>
    </Box>
  );
};

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Standard empty state component
 */
export const EmptyStateComponent: React.FC<EmptyStateProps> = ({ 
  message, 
  icon,
  action 
}) => {
  return (
    <Box 
      display="flex" 
      flexDirection="column" 
      alignItems="center" 
      justifyContent="center" 
      minHeight="200px"
      gap={2}
      p={3}
    >
      {icon}
      <Typography variant="body1" color="text.secondary" textAlign="center">
        {message}
      </Typography>
      {action}
    </Box>
  );
};

interface SuccessStateProps {
  message: string;
  onClose?: () => void;
}

/**
 * Standard success message component
 */
export const SuccessState: React.FC<SuccessStateProps> = ({ 
  message, 
  onClose 
}) => {
  return (
    <Box my={2}>
      <Alert 
        severity="success"
        onClose={onClose}
      >
        {message}
      </Alert>
    </Box>
  );
};
