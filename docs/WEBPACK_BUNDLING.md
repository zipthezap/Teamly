# Webpack Bundling Guide

This project now supports webpack bundling of the frontend as an alternative to Vite for production builds.

## Why Webpack?

While Vite is excellent for local development with fast HMR (Hot Module Replacement), webpack provides additional production bundling capabilities and can be served directly from the backend server.

## Commands

### Frontend Development (Vite - Recommended for local debugging)

```bash
cd src/frontend
npm run dev
```

This starts the Vite development server on port 3001 with fast HMR. Perfect for local debugging.

### Frontend Production Build (Webpack)

```bash
# From root directory
npm run build:frontend

# Or from frontend directory
cd src/frontend
npm run build:webpack
```

This creates a production-optimized webpack bundle in `src/frontend/dist/`.

### Backend Server with Frontend Bundle

```bash
# Build the frontend first
npm run build:frontend

# Start backend with frontend serving enabled
npm run start:with-frontend
```

This starts the backend server which will serve the webpack-bundled frontend at the root path (`/`). The API will be available at `/api/*`.

### Backend Server without Frontend (API only)

```bash
npm start
```

This starts the backend in API-only mode (default behavior).

## Configuration

### Webpack Configuration

The webpack configuration is located at `src/frontend/webpack.config.cjs`. Key features:

- **Production mode**: Optimized bundle with minification
- **TypeScript support**: Uses ts-loader with transpileOnly for fast builds (type checking should be done separately)
- **CSS support**: Includes PostCSS and Tailwind CSS processing
- **Asset handling**: Images and fonts are bundled as resources
- **HTML generation**: Generates index.html with injected bundle scripts
- **Performance limits**: Set to 2MB by default, configurable via MAX_BUNDLE_SIZE environment variable

You can customize the bundle size limit:

```bash
# Build with custom bundle size limit (3MB example)
MAX_BUNDLE_SIZE=3000000 npm run build:webpack
```

### Backend Configuration

The backend server will serve the frontend bundle when the `SERVE_FRONTEND` environment variable is set to `true`:

```bash
# In .env file
SERVE_FRONTEND=true

# Optional: Custom frontend dist path (defaults to src/frontend/dist)
FRONTEND_DIST_PATH=/path/to/custom/dist
```

Or via command line:

```bash
SERVE_FRONTEND=true npm start
```

When frontend serving is enabled:
- Static files are served from `src/frontend/dist/`
- All non-API routes (`/api/*`, `/uploads/*`, `/metrics`, `/health`) return the index.html for client-side routing
- API routes still return JSON responses
- **Note**: In production, it's recommended to use a reverse proxy (e.g., nginx) for static file serving and rate limiting

## File Structure

```
src/frontend/
├── dist/                    # Webpack build output (gitignored)
├── index.html               # Vite development template
├── index.webpack.html       # Webpack production template
├── webpack.config.cjs       # Webpack configuration
├── vite.config.ts           # Vite configuration (unchanged)
└── src/                     # Source files
```

## Development Workflow

1. **Local Development**: Use `npm run dev` in the frontend directory for fast iteration with Vite
2. **Production Build**: Use `npm run build:webpack` to create webpack bundle
3. **Testing**: Use `npm run start:with-frontend` to test the full stack with bundled frontend

## Notes

- The webpack configuration uses `transpileOnly: true` for faster builds, skipping type checking
- Vite setup remains unchanged and is recommended for local development
- The webpack bundle is not committed to git (dist/ is in .gitignore)
- Performance limits are set to 2MB, appropriate for a React SPA
- Frontend dist path can be customized with `FRONTEND_DIST_PATH` environment variable
