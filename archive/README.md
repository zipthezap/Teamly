# Archive

This directory contains the archived React/Vite webapp (frontend) that was previously used as the web interface for Teamly.

The project has migrated to a Flutter/Dart application (`src/mobile/`) for both mobile and web platforms.

## Contents

- `frontend/` — The original React 19 + Material-UI web application
- `Dockerfile.frontend` — Production Docker build for the React app (served via nginx)
- `Dockerfile.frontend.dev` — Development Docker build using the Vite dev server
- `nginx.conf` — nginx configuration used to serve the React build
