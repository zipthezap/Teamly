import React, { ReactNode } from 'react';
import { Container, Paper, Box, ContainerProps, PaperProps } from '@mui/material';

interface FormContainerProps {
  children: ReactNode;
  maxWidth?: ContainerProps['maxWidth'];
  paperElevation?: PaperProps['elevation'];
}

/**
 * Reusable container for form pages with consistent styling
 */
export const FormContainer: React.FC<FormContainerProps> = ({ 
  children, 
  maxWidth = 'sm',
  paperElevation = 3 
}) => {
  return (
    <Container maxWidth={maxWidth} sx={{ mt: 8 }}>
      <Paper elevation={paperElevation} sx={{ p: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center">
          {children}
        </Box>
      </Paper>
    </Container>
  );
};
