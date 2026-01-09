# Teamly Quick Start Guide

## 🚀 Fastest Way to Run Teamly

### Using Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Access the application:**
- Frontend UI: http://localhost
- Backend API: http://localhost:3000
- Database: localhost:5432

---

## 📋 What You Get

### Frontend (Port 80)
- Modern React UI with Material-UI
- Login and registration
- Dashboard with statistics
- Groups management
- Events management
- Responsive design

### Backend (Port 3000)
- RESTful API
- JWT authentication
- PostgreSQL database
- Rate limiting
- Complete CRUD operations

---

## 🎯 Quick Actions

### Create Your First Group
1. Register a new account at http://localhost
2. Go to Groups → Create Group
3. Enter group name and description
4. Invite friends by email

### Create Your First Event
1. Navigate to Events → Create Event
2. Select a group
3. Fill in event details (type, date, location)
4. Set max players (optional)
5. Invite participants

---

## 🛠️ Local Development

### Backend Development
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

### Frontend Development
```bash
cd src/frontend
npm install
npm start
```

---

## 📚 Documentation

- `README.md` - Main documentation
- `src/frontend/README.md` - Frontend architecture
- `IMPLEMENTATION_SUMMARY.md` - Detailed implementation notes
- `API_DOCUMENTATION.md` - API reference
- `FEATURE_ROADMAP.md` - Future features

---

## 🐛 Troubleshooting

**Port already in use:**
```bash
docker-compose down
lsof -ti:80 | xargs kill -9
lsof -ti:3000 | xargs kill -9
docker-compose up -d
```

**Database connection issues:**
```bash
docker-compose down -v
docker-compose up -d
```

**Frontend not loading:**
```bash
docker-compose restart frontend
```

---

## 🎨 Features

✅ User authentication (register/login)
✅ JWT token management
✅ Create and manage groups
✅ Invite members to groups
✅ Create sports events
✅ Join/leave events
✅ Update participation status
✅ Role-based access control
✅ Responsive design
✅ Material-UI components

---

## 🏗️ Architecture

```
┌──────────────┐
│  PostgreSQL  │ (Database)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Backend    │ (Express API)
│   Port 3000  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Frontend   │ (React + nginx)
│   Port 80    │
└──────────────┘
```

---

## 📱 Pages Included

1. **Login** - User authentication
2. **Register** - New user signup
3. **Dashboard** - Overview and statistics
4. **Groups List** - All user groups
5. **Create Group** - New group form
6. **Group Details** - Members and events
7. **Events List** - All available events
8. **Create Event** - New event form
9. **Event Details** - Full event info and participation

---

## 🔐 Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teamly?schema=public
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
```

### Frontend (src/frontend/.env)
```
REACT_APP_API_URL=http://localhost:3000/api
```

---

## 📦 Tech Stack

**Frontend:**
- React 19
- Material-UI 7
- React Router 7
- Axios
- Context API

**Backend:**
- Node.js 20
- Express.js 5
- Prisma 7
- PostgreSQL 16
- JWT

**DevOps:**
- Docker
- Docker Compose
- nginx

---

## 🎉 You're Ready to Go!

Start with `docker-compose up -d` and visit http://localhost

Happy organizing! 🏀⚽🎾
