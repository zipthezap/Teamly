import React from 'react';
import { Chip, ChipProps } from '@mui/material';

export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'default';

interface StatusBadgeProps extends Omit<ChipProps, 'color'> {
  status: StatusType;
  label: string;
}

/**
 * Reusable status badge component with consistent styling
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  label,
  ...props 
}) => {
  const colorMap: Record<StatusType, ChipProps['color']> = {
    success: 'success',
    error: 'error',
    warning: 'warning',
    info: 'info',
    default: 'default'
  };

  return (
    <Chip
      label={label}
      color={colorMap[status]}
      size="small"
      sx={{
        fontWeight: 600,
        fontSize: '0.75rem',
        height: 24,
        ...props.sx
      }}
      {...props}
    />
  );
};

export default StatusBadge;
