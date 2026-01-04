# Teamly

A sports event organization app that allows individuals to set and organize small sports matches. Similar to how Tricount works for expense tracking, Teamly helps you invite friends, create groups, and organize sports events.

## Features

- **User Management**: Register and authenticate users with JWT tokens
- **Group Management**: Create groups, invite friends, and manage group members
- **Event Management**: Create sports events with types (football, basketball, tennis, etc.)
- **Event Participation**: Join/leave events, track participants, set max players
- **Role-Based Access**: Admin and member roles for group management

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT with bcryptjs
- **API**: RESTful API

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Teamly
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your database credentials and JWT secret.

4. Set up the database:
```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate
```

5. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000` (or the PORT specified in .env).

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
│   ├── config/
│   │   └── database.js       # Prisma client configuration
│   ├── controllers/
│   │   ├── authController.js # Authentication logic
│   │   ├── groupController.js # Group management
│   │   └── eventController.js # Event management
│   ├── middleware/
│   │   └── auth.js           # JWT authentication middleware
│   ├── routes/
│   │   ├── authRoutes.js     # Auth endpoints
│   │   ├── groupRoutes.js    # Group endpoints
│   │   └── eventRoutes.js    # Event endpoints
│   ├── utils/
│   │   └── jwt.js            # JWT utilities
│   └── server.js             # Express app setup
├── prisma/
│   └── schema.prisma         # Database schema
├── .env                      # Environment variables
├── .gitignore
├── package.json
└── README.md
```

## License

ISC