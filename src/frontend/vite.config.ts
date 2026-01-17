import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 3001,
    fs: {
      // Allow serving files from parent directory (for shared types)
      allow: ['..'],
    },
    allowedHosts: ['winona-ungraced-nondefensively.ngrok-free.dev'],
  },
});
