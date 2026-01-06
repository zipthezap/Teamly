# Teamly

A sports event organization app that allows individuals to set and organize small sports matches. Similar to how Tricount works for expense tracking, Teamly helps you invite friends, create groups, and organize sports events.

## Features

- **User Management**: Register and authenticate users with JWT tokens
- **Group Management**: Create groups, invite friends, and manage group members
- **Event Management**: Create sports events with types (football, basketball, tennis, etc.)
- **Event Participation**: Join/leave events, track participants, set max players
- **Role-Based Access**: Admin and member roles for group management
- **Modern UI**: React-based frontend with Material-UI components
- **Containerized**: Separate Docker containers for backend and frontend

### 🆕 New Features

- **📧 Email Notifications**: Receive notifications for event invitations, updates, cancellations, and group invites
- **🔄 Recurring Events**: Create events that repeat on daily, weekly, or monthly schedules
- **💬 Event Comments**: Discuss events with threaded comments and @mentions
- **⚙️ Customizable Preferences**: Control which email notifications you receive

For detailed documentation on these features, see [NEW_FEATURES_IMPLEMENTATION.md](NEW_FEATURES_IMPLEMENTATION.md).

## Architecture

The application is split into two main components:

- **Backend** (`src/backend/`): Node.js/Express REST API
- **Frontend** (`src/frontend/`): React application with Material-UI

## Tech Stack

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma v7
- **Authentication**: JWT with bcryptjs
- **API**: RESTful API

### Frontend
- **Framework**: React 19
- **UI Library**: Material-UI (MUI)
- **Routing**: React Router v7
- **HTTP Client**: Axios
- **State Management**: React Context API

## Prerequisites

- Node.js (v20 or higher)
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL (v16 or higher, if running locally)
- npm or yarn

> **💡 Windows Users:** For detailed Windows-specific setup instructions, see [WINDOWS_SETUP.md](WINDOWS_SETUP.md)

## Quick Start with Docker (Recommended)

The easiest way to run Teamly is using Docker Compose:

```bash
# Clone the repository
git clone <repository-url>
cd Teamly

# Start all services (database, backend, frontend)
docker-compose up -d

# View logs
docker-compose logs -f
```

The application will be available at:
- **Frontend**: http://localhost (port 80)
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

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd src/frontend
```

2. Install frontend dependencies:
```bash
npm install
```

3. Configure the API URL (optional):
```bash
# Create .env file
echo "REACT_APP_API_URL=http://localhost:3000/api" > .env
```

4. Start the frontend development server:
```bash
npm start
```

The frontend will start on `http://localhost:3001` (or another available port).

5. Build for production:
```bash
npm run build
```

## Docker Architecture

The application uses three separate containers:

### 1. PostgreSQL Container (`postgres`)
- Image: `postgres:16-alpine`
- Port: 5432
- Persistent storage via Docker volume

### 2. Backend Container (`backend`)
- Built from `Dockerfile.backend`
- Port: 3000
- Runs Express.js API server
- Includes Prisma for database access

### 3. Frontend Container (`frontend`)
- Built from `Dockerfile.frontend`
- Port: 80
- Uses nginx to serve React build
- Production-optimized with gzip compression

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
- **Input Validation**: Validation utilities in `src/backend/utils/validation.ts` for consistent data validation
- **Environment Validation**: Automatic validation of required environment variables on startup
- **Security Best Practices**: 
  - Environment-based JWT secrets (never hardcoded)
  - Input sanitization and validation
  - Rate limiting on API endpoints

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
│   ├── app/                  # Frontend application
│   │   ├── pages/            # Application pages/routes
│   │   │   └── index.js      # Home page
│   │   └── ui/               # Reusable UI components
│   │       └── Button.js     # Button component
│   └── backend/              # Backend API
│       ├── config/
│       │   └── database.js       # Prisma client configuration
│       ├── controllers/
│       │   ├── authController.js # Authentication logic
│       │   ├── groupController.js # Group management
│       │   └── eventController.js # Event management
│       ├── middleware/
│       │   ├── auth.js           # JWT authentication middleware
│       │   └── rateLimiter.js    # Rate limiting
│       ├── routes/
│       │   ├── authRoutes.js     # Auth endpoints
│       │   ├── groupRoutes.js    # Group endpoints
│       │   └── eventRoutes.js    # Event endpoints
│       ├── utils/
│       │   └── jwt.js            # JWT utilities
│       └── server.js             # Express app setup
├── prisma/
│   └── schema.prisma         # Database schema
├── .env                      # Environment variables
├── .gitignore
├── package.json
└── README.md
```

## Testing the API

### Using Shell Scripts

**Unix/Linux/Mac/Git Bash:**
```bash
./test-api.sh
```

**Windows (Command Prompt/PowerShell):**
```cmd
test-api.bat
```

The test scripts will:
- Register a test user
- Create a group
- Create an event
- Test various API endpoints
- Verify error handling

## Additional Documentation

### Active Documentation

- **[NEW_FEATURES_IMPLEMENTATION.md](NEW_FEATURES_IMPLEMENTATION.md)** - Complete guide for new features (Email, Recurring Events, Comments)
- **[WINDOWS_SETUP.md](WINDOWS_SETUP.md)** - Comprehensive Windows development guide
- **[FEATURE_ROADMAP.md](FEATURE_ROADMAP.md)** - Planned features and expansion ideas
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Detailed API reference
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guides
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Project overview and architecture

### Archived Documentation

Historical implementation notes and summaries have been moved to `docs/archive/` to keep the root directory clean and focused on active documentation.

## Contributing Ideas

Looking to expand Teamly? Check out [FEATURE_ROADMAP.md](FEATURE_ROADMAP.md) for:
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