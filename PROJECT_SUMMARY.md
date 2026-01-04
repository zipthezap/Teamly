# Teamly - Project Summary

## Overview

Teamly is a Node.js backend application with a frontend app structure for organizing sports events, inspired by how Tricount works for expense tracking. Users can create groups, invite friends, and organize sports matches.

The project is organized with:
- **Backend**: Complete RESTful API in `src/backend/`
- **Frontend App**: Application structure in `src/app/` with pages and UI components

## What Was Built

### 1. Backend Architecture
- **Framework**: Express.js (Node.js)
- **Database**: PostgreSQL with Prisma ORM v7
- **Authentication**: JWT with bcryptjs for password hashing
- **Security**: Rate limiting, proper error handling, input validation
- **Location**: All backend code is in `src/backend/`

### 2. Database Schema (5 Models)

```
User
├── id, email, password, name
├── timestamps (createdAt, updatedAt)
└── Relations: groups created, group memberships, events created, event participations

Group
├── id, name, description
├── timestamps (createdAt, updatedAt)
└── Relations: creator, members, events

GroupMember
├── id, role (admin/member)
├── joinedAt
└── Relations: user, group

Event
├── id, title, description, eventType, location
├── startTime, endTime, maxPlayers
├── timestamps (createdAt, updatedAt)
└── Relations: creator, group, participants

EventParticipant
├── id, status (pending/confirmed/declined)
├── joinedAt
└── Relations: event, user
```

### 3. API Endpoints (19 Total)

#### Authentication (3 endpoints)
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login user
- GET /api/auth/profile - Get user profile

#### Groups (6 endpoints)
- POST /api/groups - Create group
- GET /api/groups - List user's groups
- GET /api/groups/:id - Get group details
- PUT /api/groups/:id - Update group
- POST /api/groups/:id/invite - Invite member
- DELETE /api/groups/:id/members/:memberId - Remove member

#### Events (8 endpoints)
- POST /api/events - Create event
- GET /api/events - List events (with optional group filter)
- GET /api/events/:id - Get event details
- PUT /api/events/:id - Update event
- DELETE /api/events/:id - Delete event
- POST /api/events/:id/join - Join event
- DELETE /api/events/:id/leave - Leave event
- PUT /api/events/:id/status - Update participation status

#### Health Check (1 endpoint)
- GET /health - Server health check

### 4. Security Features

✓ JWT-based authentication
✓ Password hashing with bcryptjs
✓ Rate limiting (3 levels):
  - Auth endpoints: 5 requests per 15 minutes
  - Authenticated routes: 200 requests per 15 minutes
  - General API: 100 requests per 15 minutes
✓ Input validation
✓ Error handling middleware
✓ Proper database relation constraints

### 5. Project Structure

```
Teamly/
├── src/
│   ├── app/                        # Frontend application
│   │   ├── pages/                  # Application pages/routes
│   │   │   └── index.js            # Home page
│   │   ├── ui/                     # Reusable UI components
│   │   │   └── Button.js           # Button component
│   │   └── README.md               # App structure guide
│   └── backend/                    # Backend API
│       ├── config/
│       │   └── database.js         # Prisma client setup
│       ├── controllers/
│       │   ├── authController.js   # Authentication logic
│       │   ├── groupController.js  # Group management
│       │   └── eventController.js  # Event management
│       ├── middleware/
│       │   ├── auth.js             # JWT authentication
│       │   └── rateLimiter.js      # Rate limiting
│       ├── routes/
│       │   ├── authRoutes.js       # Auth endpoints
│       │   ├── groupRoutes.js      # Group endpoints
│       │   └── eventRoutes.js      # Event endpoints
│       ├── utils/
│       │   └── jwt.js              # JWT utilities
│       └── server.js               # Express app setup
├── prisma/
│   └── schema.prisma               # Database schema
├── prisma.config.ts                # Prisma v7 config
├── .env.example                    # Environment template
├── .gitignore                      # Git ignore rules
├── package.json                    # Dependencies
├── Dockerfile                      # Docker image
├── docker-compose.yml              # Docker orchestration
├── test-api.sh                     # API test script
├── README.md                       # Main documentation
├── API_DOCUMENTATION.md            # Detailed API docs
└── DEPLOYMENT.md                   # Deployment guide
```

### 6. Frontend App Structure

The `src/app/` directory provides a foundation for frontend development:
- **pages/**: Contains application pages and routes
  - Ready for integration with frameworks like React, Next.js, or Vue
- **ui/**: Houses reusable UI components
  - Includes sample Button component to demonstrate structure
- Easily expandable to include layouts, hooks, services, and state management

### 7. Documentation

- **README.md**: Complete setup and usage guide
- **API_DOCUMENTATION.md**: Detailed API reference with examples
- **DEPLOYMENT.md**: Deployment guides for various platforms
- **test-api.sh**: Executable test script for API validation

### 8. Deployment Options

✓ Local development setup
✓ Docker Compose (recommended for quick start)
✓ Production deployment with PM2
✓ Cloud platforms (Heroku, Railway, Render)
✓ Kubernetes-ready (Dockerfile included)

## Key Features Implemented

### User Management
- User registration with email validation
- Secure login with JWT tokens
- Profile management
- Password hashing

### Group Management
- Create groups for organizing events
- Invite members by email
- Role-based access (admin/member)
- Remove members (admin only)
- List and view group details

### Event Management
- Create events with type, location, time
- Support for various sport types
- Maximum player limits
- Join/leave events
- Participation status tracking
- Event creator can update/delete
- Filter events by group

### Security
- JWT authentication
- Rate limiting on all routes
- Password hashing
- Input validation
- Error handling
- SQL injection prevention (via Prisma)

## Technical Highlights

1. **Prisma v7**: Uses the latest Prisma ORM with new configuration approach
2. **Express.js 5**: Latest stable Express version
3. **RESTful API**: Follows REST principles
4. **MVC Pattern**: Clean separation of concerns
5. **Environment Configuration**: Secure config management
6. **Docker Support**: Easy containerization
7. **Rate Limiting**: Protection against abuse
8. **CORS Enabled**: Ready for frontend integration

## Dependencies

### Production
- express: ^5.2.1 - Web framework
- @prisma/client: ^7.2.0 - Database ORM
- @prisma/adapter-pg: ^7.2.0 - PostgreSQL adapter
- pg: ^8.11.3 - PostgreSQL driver
- bcryptjs: ^3.0.3 - Password hashing
- jsonwebtoken: ^9.0.3 - JWT tokens
- cors: ^2.8.5 - CORS support
- dotenv: ^17.2.3 - Environment variables
- express-rate-limit: ^7.1.5 - Rate limiting

### Development
- nodemon: ^3.1.11 - Auto-restart server
- @types/node: ^25.0.3 - TypeScript types
- prisma: ^7.2.0 - Prisma CLI

## How to Use

### Quick Start with Docker
```bash
git clone <repo-url>
cd Teamly
docker-compose up
```

### Local Development
```bash
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

### Testing
```bash
# Start the server
npm start

# In another terminal, run tests
./test-api.sh
```

## API Examples

### Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123","name":"John"}'
```

### Create a Group
```bash
curl -X POST http://localhost:3000/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Sunday Football","description":"Weekly matches"}'
```

### Create an Event
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "groupId":"group-uuid",
    "title":"Weekend Match",
    "eventType":"football",
    "location":"Central Park",
    "startTime":"2024-12-31T10:00:00Z",
    "maxPlayers":10
  }'
```

## What Makes This Different

Unlike simple CRUD apps, Teamly includes:
- Complex relationships (users, groups, events, participations)
- Role-based access control
- Participation status tracking
- Rate limiting for security
- Comprehensive error handling
- Production-ready deployment options
- Full documentation

## Future Enhancements (Not Implemented)

Potential additions:
- Frontend application (React/Vue)
- Real-time notifications (WebSocket)
- Email invitations
- Event recurring patterns
- Image uploads for events
- Comments on events
- Player skill ratings
- Location maps integration
- Calendar integration

## Success Metrics

✓ All API endpoints working
✓ Security best practices implemented
✓ Zero CodeQL security alerts
✓ Complete documentation
✓ Docker deployment ready
✓ Rate limiting implemented
✓ Proper error handling
✓ Database relations correct

## Conclusion

Teamly is a production-ready backend application that demonstrates:
- Modern Node.js development practices
- Secure API design
- Proper database modeling
- Complete documentation
- Multiple deployment options

The application is ready to use and can be extended with a frontend or mobile app.
