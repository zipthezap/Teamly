// Global type augmentations for Material-UI v7
// This file helps with backward compatibility for Grid component

import { GridProps as MuiGridProps } from '@mui/material/Grid';

declare module '@mui/material/Grid' {
  interface GridProps extends MuiGridProps {
    item?: boolean;
    xs?: number | boolean | 'auto';
    sm?: number | boolean | 'auto';
    md?: number | boolean | 'auto';
    lg?: number | boolean | 'auto';
    xl?: number | boolean | 'auto';
    spacing?: number;
  }
}

export {};
