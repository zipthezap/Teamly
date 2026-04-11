# Teamly

A sports event organization app that allows individuals to set and organize small sports matches. Similar to how Tricount works for expense tracking, Teamly helps you invite friends, create groups, and organize sports events.

> 💡 **New Contributor?** Check out **[NEXT_STEPS.md](NEXT_STEPS.md)** for immediate priorities and how to get started!

## Features

- **User Management**: Register and authenticate users with JWT tokens
- **🔐 OAuth Authentication**: Sign in with Google or Facebook accounts
- **Group Management**: Create groups, invite friends, and manage group members
- **🔗 Group Invite Links**: Share invite links to let people join groups easily
- **Event Management**: Create sports events with types (football, basketball, tennis, etc.)
- **Event Participation**: Join/leave events, track participants, set max players
- **Role-Based Access**: Admin and member roles for group management
- **Modern UI**: Flutter/Dart app for both mobile and web
- **Containerized**: Docker container for backend

### 🆕 New Features

- **🏆 Tournament Hosting**: Organize and manage tournaments with comprehensive features:
  - Multiple tournament formats: Single Elimination, Double Elimination, Round Robin, Groups + Knockout
  - **🎯 Full Admin Control**: Tournament organizers have complete control over brackets and pools
    - Manual bracket management: Create, edit, and delete matches as needed
    - Custom pool creation: Build pools exactly how you want them
    - Referee assignment: Assign teams to referee matches when on break
    - Flexible scheduling: Change match times and stages anytime
  - **👥 Easy Team Registration**: Team captains can invite players via email
    - Send invitations to players who need to create accounts first
    - Track invitation status (pending, accepted, declined)
    - Automatic team membership upon acceptance
  - Team management with captain assignment
  - Automatic OR manual bracket generation
  - Score tracking and submission (by organizers and team captains)
  - Real-time standings and leaderboards
  - Support for various sports types
  - Group stage and knockout stage management
- **📸 Picture Uploads**: Secure profile and group picture uploads with comprehensive security
- **📧 Email Notifications**: Receive notifications for event invitations, updates, cancellations, and group invites
- **🔄 Recurring Events**: Create events that repeat on daily, weekly, or monthly schedules
- **💬 Event Comments**: Discuss events with threaded comments and @mentions
- **⚙️ Customizable Preferences**: Control which email notifications you receive
- **📥 Event Data Export**: Export your event history in CSV, iCalendar (.ics), or JSON formats

### ⭐ Recently Enhanced

- **🔔 Enhanced Notification System**: Comprehensive in-app notification center with:
  - Complete notification history and archiving
  - Advanced filtering by type, date, and read status
  - Full-text search across notifications
  - Priority indicators (high/medium/low)
  - Real-time auto-refresh every 30 seconds
  - Notification statistics and analytics
  - Quick actions for navigation
  - Dedicated notification center page

- **📱 Mobile Responsive**: Making Teamly fully mobile-friendly
  - ✅ ~95% Complete: Core navigation, dashboard, auth pages, groups, events, tournaments
  - 🔄 Testing & Polish: Manual validation and automated tests in progress
  - See [MOBILE_RESPONSIVE_ROADMAP.md](MOBILE_RESPONSIVE_ROADMAP.md) for details

For detailed documentation on these features, see:
- [docs/guides/FEATURES.md](docs/guides/FEATURES.md) - Core features
- [docs/guides/TOURNAMENT_TEAM_INVITATIONS.md](docs/guides/TOURNAMENT_TEAM_INVITATIONS.md) - Tournament team invitation system
- [docs/features/ENHANCED_NOTIFICATIONS.md](docs/features/ENHANCED_NOTIFICATIONS.md) - Enhanced notification system
- [docs/features/EVENT_EXPORT.md](docs/features/EVENT_EXPORT.md) - Event data export feature
- [docs/guides/PICTURE_UPLOAD.md](docs/guides/PICTURE_UPLOAD.md) - Secure picture upload feature
- [MOBILE_RESPONSIVE_ROADMAP.md](MOBILE_RESPONSIVE_ROADMAP.md) - Mobile responsive implementation roadmap

## Architecture

The application has two main components:

- **Backend** (`src/backend/`): Node.js/Express REST API
- **Mobile/Web** (`src/mobile/`): Flutter/Dart application for both mobile and web

## Tech Stack

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma v7
- **Authentication**: JWT with bcryptjs
- **API**: RESTful API

### Mobile/Web App
- **Framework**: Flutter/Dart
- **State Management**: Riverpod

## Prerequisites

- Node.js (v20 or higher)
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL (v16 or higher, if running locally)
- npm or yarn

> **💡 Windows Users:** For detailed Windows-specific setup instructions, see [docs/guides/WINDOWS_SETUP.md](docs/guides/WINDOWS_SETUP.md)

## ☁️ Cloud Deployment (Azure)

**Want to deploy this app and make it accessible to your friends 24/7?**

We've made it easy to deploy Teamly to Microsoft Azure:

```bash
# Quick deployment using our automated script
chmod +x scripts/deployment/deploy-azure.sh
./scripts/deployment/deploy-azure.sh
```

**Benefits of Azure deployment:**
- ✅ 24/7 availability (no need to keep your PC on)
- ✅ Professional hosting with 99.95% uptime
- ✅ Automated CI/CD with GitHub Actions
- ✅ Estimated cost: ~$30-40/month (Basic tier)
- ✅ Free tier available for testing

📚 **Complete Azure deployment guide**: [docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md)

---

## Quick Start with Docker (Recommended for Local Development)

The easiest way to run Teamly locally is using Docker Compose:

```bash
# Clone the repository
git clone <repository-url>
cd Teamly

# Start all services (database, backend)
docker-compose up -d

# View logs
docker-compose logs -f
```

The application will be available at:
- **Backend API**: http://localhost:3000
- **Database**: localhost:5432

To stop the services:
```bash
docker-compose down
```

## Local Development Setup

### Backend Setup

1. Install backend dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your database credentials and JWT secret.

3. Set up the database:
```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate
```

4. Start the backend server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The backend will start on `http://localhost:3000`.

> **📱 Network Access**: The backend server is configured to listen on all network interfaces (`0.0.0.0`), allowing access from other devices on your local network. To access from another device, use your machine's IP address instead of localhost (e.g., `http://192.168.1.100:3000`).

### Mobile/Web App Setup

1. Navigate to the mobile directory:
```bash
cd src/mobile
```

2. Install Flutter dependencies:
```bash
flutter pub get
```

3. Run the app:
```bash
# Mobile
flutter run

# Web
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/api
```

## Docker Architecture

The application uses separate containers:

### 1. PostgreSQL Container (`postgres`)
- Image: `postgres:16-alpine`
- Port: 5432
- Persistent storage via Docker volume

### 2. Backend Container (`backend`)
- Built from `Dockerfile.backend`
- Port: 3000
- Runs Express.js API server
- Includes Prisma for database access

## Important Notes

### Prisma v7 Configuration

This project uses Prisma v7, which has a new configuration approach:
- Database connection URL is configured in `prisma.config.ts` (not in schema.prisma)
- The `datasource` block in `schema.prisma` only specifies the provider
- Environment variables are loaded from `.env` via the config file

This is different from Prisma v4-v6 where the URL was in the schema file.

## Database Schema

- **User**: User accounts with authentication
- **Group**: Groups for organizing events
- **GroupMember**: Group membership with roles (admin/member)
- **Event**: Sports events with type, location, and timing
- **EventParticipant**: Event participation tracking with status

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (authenticated)

### Groups
- `POST /api/groups` - Create a new group
- `GET /api/groups` - Get all user's groups
- `GET /api/groups/:id` - Get group details
- `PUT /api/groups/:id` - Update group (admin only)
- `POST /api/groups/:id/invite` - Invite member to group
- `DELETE /api/groups/:id/members/:memberId` - Remove member (admin only)

### Events
- `POST /api/events` - Create a new event
- `GET /api/events` - Get all events (optional ?groupId filter)
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event (creator only)
- `DELETE /api/events/:id` - Delete event (creator only)
- `POST /api/events/:id/join` - Join an event
- `DELETE /api/events/:id/leave` - Leave an event
- `PUT /api/events/:id/status` - Update participation status

## API Usage Examples

### Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"John Doe"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Create a Group
```bash
curl -X POST http://localhost:3000/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name":"Sunday Football","description":"Weekly football matches"}'
```

### Create an Event
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "groupId":"group-uuid",
    "title":"Weekend Football Match",
    "description":"Casual game at the park",
    "eventType":"football",
    "location":"Central Park",
    "startTime":"2024-01-20T10:00:00Z",
    "maxPlayers":10
  }'
```

## Development

### Code Quality

This project follows best practices for code quality and maintainability:

- **Structured Logging**: Uses a custom logger utility (`src/backend/utils/logger.ts`) for consistent, timestamped logging with different levels (ERROR, WARN, INFO, DEBUG)
- **Type Safety**: TypeScript with enabled compiler checks for unused locals/parameters and consistent casing
- **ESLint**: Linting setup for backend code
  - Backend: TypeScript ESLint rules for Node.js
  - Run `npm run lint` in root for backend
  - Run `npm run lint:fix` to automatically fix fixable issues
- **Input Validation**: Validation utilities in `src/backend/utils/validation.ts` for consistent data validation
- **Environment Validation**: Automatic validation of required environment variables on startup
- **Backend Improvements**: 
  - **Database Connection Pooling**: Configurable pool sizes, timeouts, and query limits
  - **Response Compression**: Automatic gzip compression for responses
  - **Enhanced Rate Limiting**: User-aware rate limiting with endpoint-specific limits
  - **Request Timeouts**: Configurable timeouts to prevent hanging requests
  - **Performance Indexes**: Comprehensive database indexes for faster queries
  - **Health Monitoring**: Detailed health checks with database and memory metrics
  - **Standardized API Responses**: Consistent response format with error codes
  - See [docs/BACKEND_IMPROVEMENTS.md](docs/BACKEND_IMPROVEMENTS.md) for details
- **Scalability Features**:
  - **Redis Integration**: Optional distributed caching and rate limiting
  - **Cluster Mode Support**: PM2 configuration for multi-core utilization
  - **Prometheus Metrics**: Comprehensive monitoring and observability
  - **Distributed Rate Limiting**: Redis-backed rate limiting for horizontal scaling
  - **Response Caching**: Intelligent caching with automatic fallback to in-memory
  - **Health Checks**: Redis, database, and memory health monitoring
  - **Bulk Operations**: Batch notification inserts (100x faster for large batches)
  - **Query Optimization**: DataLoader pattern eliminates N+1 queries
  - **Connection Pool**: Optimized for high-concurrency (50 connections default)
  - **Background Jobs**: Async processing with Redis-backed job queue
  - See [docs/SCALABILITY_ENHANCEMENTS_V2.md](docs/SCALABILITY_ENHANCEMENTS_V2.md) for V2 improvements
  - See [docs/SCALABILITY_IMPROVEMENTS.md](docs/SCALABILITY_IMPROVEMENTS.md) for V1 improvements
- **Security Best Practices**: 
  - **HTTPS Support**: Optional SSL/TLS encryption for secure communication
  - Environment-based JWT secrets (never hardcoded)
  - Automatic input sanitization and XSS prevention
  - Enhanced rate limiting (10 auth requests, 500 authenticated requests per 15min)
  - Password reset protection (3 requests/hour)
  - Email verification limits (5 requests/hour)
  - Security headers via Helmet (CSP, HSTS, etc.)
  - Password strength requirements (8+ chars, mixed case, numbers, special chars)
  - Account lockout after failed login attempts (5 attempts, 15min lockout)
  - Password reset via secure email tokens
  - Request body size limits (10MB) to prevent DoS
  - Graceful shutdown and error handling

For complete security documentation, see [docs/SECURITY.md](docs/SECURITY.md).
For HTTPS setup instructions, see [docs/HTTPS_SETUP.md](docs/HTTPS_SETUP.md).
For backend improvements details, see [docs/BACKEND_IMPROVEMENTS.md](docs/BACKEND_IMPROVEMENTS.md).

### Testing

This project uses Vitest for testing the backend:

```bash
# Run backend tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (during development)
npm run test:watch
```

**Test Coverage:**
- Backend: 69 tests covering validation utilities and core logic

For detailed testing guidelines, patterns, and best practices, see [TESTING.md](TESTING.md).

### Database Management

```bash
# Open Prisma Studio (GUI for database)
npm run prisma:studio

# Create a new migration
npm run prisma:migrate

# Generate Prisma Client
npm run prisma:generate
```

### Environment Variables

Required environment variables in `.env`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/teamly?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-change-this-in-production
```

## Project Structure

```
Teamly/
├── src/
│   ├── backend/              # Backend API
│   │   ├── config/           # Configuration
│   │   ├── controllers/      # Route controllers
│   │   ├── middleware/       # Express middleware
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic
│   │   └── server.ts         # Express app setup
│   ├── mobile/               # Flutter/Dart app (mobile + web)
│   └── shared/               # Shared types/utilities
├── prisma/
│   └── schema.prisma         # Database schema
├── archive/
│   └── frontend/             # Archived React webapp
├── .env                      # Environment variables
├── .gitignore
├── package.json
└── README.md
```

## Testing the API

### Using Shell Scripts

**Unix/Linux/Mac/Git Bash:**
```bash
./scripts/tests/test-api.sh
```

**Windows (Command Prompt/PowerShell):**
```cmd
scripts\tests\test-api.bat
```

The test scripts will:
- Register a test user
- Create a group
- Create an event
- Test various API endpoints
- Verify error handling

## Documentation

### Core Documentation

- **[docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)** - Detailed API reference
- **[docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md)** - ☁️ **Azure cloud deployment guide (NEW!)**
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - General deployment guides and options
- **[docs/QUICK_START.md](docs/QUICK_START.md)** - Quick setup instructions
- **[docs/SECURITY.md](docs/SECURITY.md)** - Security features and best practices

### Features

- **[docs/features/ENHANCED_NOTIFICATIONS.md](docs/features/ENHANCED_NOTIFICATIONS.md)** - Enhanced notification system
- **[docs/guides/FEATURES.md](docs/guides/FEATURES.md)** - Complete guide for new features (Email, Recurring Events, Comments)

### Guides

- **[docs/guides/WINDOWS_SETUP.md](docs/guides/WINDOWS_SETUP.md)** - Comprehensive Windows development guide
- **[docs/guides/FRONTEND_GUIDE.md](docs/guides/FRONTEND_GUIDE.md)** - Frontend implementation details
- **[docs/guides/FEATURE_ROADMAP.md](docs/guides/FEATURE_ROADMAP.md)** - Planned features and expansion ideas
- **[docs/guides/SOCIAL_LOGIN_GUIDE.md](docs/guides/SOCIAL_LOGIN_GUIDE.md)** - Social authentication setup
- **[docs/guides/AUTH_SECURITY_GUIDE.md](docs/guides/AUTH_SECURITY_GUIDE.md)** - Enhanced authentication & security features

### Setup Guides

- **[docs/guides/setup/GOOGLE_MAPS_SETUP.md](docs/guides/setup/GOOGLE_MAPS_SETUP.md)** - Google Maps integration
- **[docs/guides/setup/TRANSLATIONS.md](docs/guides/setup/TRANSLATIONS.md)** - Translation system guide

### Historical Documentation

- **[docs/archive/](docs/archive/)** - Historical feature implementation documentation and reports

## Contributing Ideas

**Want to contribute?** Check out **[NEXT_STEPS.md](NEXT_STEPS.md)** for:
- 🎯 Immediate priorities and tasks
- 📋 Detailed checklists for contributors
- ⏰ Time estimates for each task
- 🚀 Getting started guide for new developers

Looking to expand Teamly? Check out [docs/guides/FEATURE_ROADMAP.md](docs/guides/FEATURE_ROADMAP.md) for:
- High-priority feature suggestions
- Technical design considerations
- Implementation estimates
- Database schema proposals

Some recently implemented features:
- ✅ Email notifications
- ✅ Recurring events
- ✅ Event comments and discussions

Additional features we're considering:
- 📱 Mobile application
- 🗺️ Maps and location services
- 🏆 Gamification and achievements
- 📊 Event analytics and statistics

## License

ISC
## Flutter Mobile Migration

A parallel Flutter mobile app scaffold now exists at `src/mobile` for staged migration from the React web frontend while keeping the existing backend API as the single source of truth.

- Migration baseline: `docs/MOBILE_FLUTTER_MIGRATION.md`
- Mobile app scaffold: `src/mobile/README.md`
- Mobile CI workflow: `.github/workflows/flutter-mobile.yml`

