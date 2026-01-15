import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './index.css';
import './i18n';

import App from './App';
import QueryClientProviderWrapper from './providers/QueryClientProviderWrapper';
import { darkTheme } from './theme';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { AuthProvider } from './contexts/AuthContext';

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <AuthProvider>
    <I18nextProvider i18n={i18n}>
      <QueryClientProviderWrapper>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </QueryClientProviderWrapper>
    </I18nextProvider>
    </AuthProvider>
  </React.StrictMode>
);
