import React, { ReactNode } from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { SvgIconComponent } from '@mui/icons-material';

interface EmptyStateProps {
  icon: SvgIconComponent;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  gradient?: string;
}

/**
 * Reusable empty state component for when there's no data to display
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  gradient = 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.02) 100%)'
}) => {
  return (
    <Paper 
      sx={{ 
        p: 6, 
        textAlign: 'center',
        background: gradient,
        border: '2px dashed rgba(255, 255, 255, 0.1)',
      }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          p: 3,
          borderRadius: '50%',
          background: 'rgba(33, 150, 243, 0.1)',
          mb: 3
        }}
      >
        <Icon sx={{ fontSize: 64, color: 'primary.main', opacity: 0.7 }} />
      </Box>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button
          variant="contained"
          size="large"
          onClick={onAction}
          sx={{ 
            px: 4,
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Paper>
  );
};

export default EmptyState;
