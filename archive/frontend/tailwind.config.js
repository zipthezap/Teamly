/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e3f2fd',
          100: '#bbdefb',
          200: '#90caf9',
          300: '#64b5f6',
          400: '#42a5f5',
          500: '#2196f3',
          600: '#1e88e5',
          700: '#1976d2',
          800: '#1565c0',
          900: '#0d47a1',
        },
        dark: {
          bg: '#0f1419',
          card: '#1a202c',
          cardHover: '#2d3748',
          border: '#374151',
          text: '#e5e7eb',
          textSecondary: '#9ca3af',
        },
      },
    },
  },
  plugins: [],
}
