import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

const commonTheme = {
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Helvetica Neue', sans-serif",
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontWeight: 650, letterSpacing: '-0.01em' },
    h4: { fontWeight: 650, letterSpacing: '-0.01em' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 14,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
};

export const getAppTheme = (mode: PaletteMode) =>
  createTheme({
    ...commonTheme,
    palette: {
      mode,
      primary: {
        main: '#2563eb',
        light: '#60a5fa',
        dark: '#1d4ed8',
      },
      secondary: {
        main: '#7c3aed',
      },
      background:
        mode === 'dark'
          ? {
              default: '#0b1220',
              paper: '#111827',
            }
          : {
              default: '#f8fafc',
              paper: '#ffffff',
            },
      text:
        mode === 'dark'
          ? {
              primary: '#e5e7eb',
              secondary: '#9ca3af',
            }
          : {
              primary: '#0f172a',
              secondary: '#475569',
            },
      divider: mode === 'dark' ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 23, 42, 0.1)',
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: mode === 'dark' ? '#0b1220' : '#f8fafc',
            color: mode === 'dark' ? '#e5e7eb' : '#0f172a',
          },
        },
      },
      MuiContainer: {
        styleOverrides: {
          root: {
            paddingLeft: '16px',
            paddingRight: '16px',
            '@media (min-width: 600px)': {
              paddingLeft: '24px',
              paddingRight: '24px',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: mode === 'dark' ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(15,23,42,0.06)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: mode === 'dark' ? '1px solid rgba(148,163,184,0.14)' : '1px solid rgba(15,23,42,0.07)',
            boxShadow: mode === 'dark' ? '0 12px 30px rgba(2, 6, 23, 0.3)' : '0 12px 30px rgba(15, 23, 42, 0.08)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            cursor: 'pointer',
            minHeight: 42,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '@media (max-width: 600px)': {
              '& .MuiInputBase-input': {
                fontSize: '16px',
              },
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            '@media (max-width: 600px)': {
              padding: '12px',
            },
          },
        },
      },
      MuiSnackbar: {
        defaultProps: {
          anchorOrigin: { vertical: 'top', horizontal: 'right' },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            alignItems: 'center',
          },
        },
      },
    },
  });
