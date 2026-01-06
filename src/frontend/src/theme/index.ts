import { createTheme, alpha } from '@mui/material/styles';

// Design tokens
const colors = {
  primary: {
    main: '#2196f3',
    light: '#64b5f6',
    dark: '#1976d2',
  },
  secondary: {
    main: '#f50057',
    light: '#ff4081',
    dark: '#c51162',
  },
  success: {
    main: '#4caf50',
    light: '#81c784',
    dark: '#388e3c',
  },
  warning: {
    main: '#ff9800',
    light: '#ffb74d',
    dark: '#f57c00',
  },
  error: {
    main: '#f44336',
    light: '#e57373',
    dark: '#d32f2f',
  },
  background: {
    default: '#0a1929',
    paper: '#132f4c',
  },
};

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: colors.primary,
    secondary: colors.secondary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    background: colors.background,
    divider: 'rgba(255, 255, 255, 0.12)',
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      letterSpacing: '0.00735em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '0em',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '0.0075em',
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${alpha('#ffffff', 0.1)}`,
          backgroundImage: `linear-gradient(${alpha('#ffffff', 0.05)}, ${alpha('#ffffff', 0.05)})`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${alpha('#ffffff', 0.1)}`,
          backgroundImage: `linear-gradient(${alpha('#ffffff', 0.05)}, ${alpha('#ffffff', 0.05)})`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: `0 12px 24px ${alpha('#000000', 0.4)}, 0 0 0 1px ${alpha(colors.primary.main, 0.5)}`,
            borderColor: alpha(colors.primary.main, 0.5),
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '10px 24px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          boxShadow: `0 4px 12px ${alpha(colors.primary.main, 0.3)}`,
          '&:hover': {
            boxShadow: `0 6px 20px ${alpha(colors.primary.main, 0.4)}`,
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            transition: 'all 0.2s ease-in-out',
            '&.Mui-focused': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: 2,
              },
            },
          },
        },
      },
    },
  },
});

export default theme;
