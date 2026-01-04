# Teamly Frontend

React-based frontend application for the Teamly sports event organization platform.

## Overview

This is a modern, responsive web application built with React and Material-UI that provides a complete user interface for managing sports events, groups, and user profiles.

## Features

### Authentication
- User registration with validation
- Login with JWT token management
- Secure session handling
- Automatic token refresh

### Dashboard
- Overview of groups and events
- Quick statistics
- Recent activity feed
- Quick action buttons

### Groups Management
- Create new groups
- View all groups
- Group details with member list
- Invite members by email
- Remove members (admin only)
- View group events

### Events Management
- Create new events with detailed information
- Browse all events
- Event details page
- Join/leave events
- Update participation status (confirmed/declined)
- Track participant list
- Maximum player limits

### User Interface
- Clean, modern design with Material-UI
- Responsive layout for all screen sizes
- Intuitive navigation
- Loading states and error handling
- Success/error notifications

## Tech Stack

- **React 19**: Latest React features
- **React Router v7**: Client-side routing
- **Material-UI (MUI) v7**: Component library
- **Axios**: HTTP client for API calls
- **React Context API**: State management
- **Emotion**: CSS-in-JS styling

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── Navbar.js       # Navigation bar
│   └── PrivateRoute.js # Protected route wrapper
├── contexts/           # React contexts
│   └── AuthContext.js  # Authentication state
├── pages/              # Page components
│   ├── Login.js        # Login page
│   ├── Register.js     # Registration page
│   ├── Dashboard.js    # Main dashboard
│   ├── GroupsList.js   # Groups list view
│   ├── GroupDetails.js # Single group view
│   ├── CreateGroup.js  # Create group form
│   ├── EventsList.js   # Events list view
│   ├── EventDetails.js # Single event view
│   └── CreateEvent.js  # Create event form
├── services/           # API services
│   └── api.js          # API client and endpoints
├── App.js              # Main app component
└── index.js            # Entry point
```

## Development

### Prerequisites
- Node.js v20+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file in the frontend directory:

```bash
REACT_APP_API_URL=http://localhost:3000/api
```

### Running Development Server

```bash
npm start
```

Opens at http://localhost:3000 (or next available port)

### Building for Production

```bash
npm run build
```

Creates optimized production build in `build/` directory.

### Testing

```bash
npm test
```

## API Integration

The frontend communicates with the backend API through the `api.js` service layer:

- **Authentication**: JWT token stored in localStorage
- **Automatic Headers**: Authorization header added to all requests
- **Error Handling**: 401 errors redirect to login
- **Base URL**: Configurable via environment variable

## Key Features Implementation

### Authentication Flow
1. User logs in/registers
2. JWT token received and stored
3. Token included in all API requests
4. Automatic logout on token expiration

### Protected Routes
- All main pages are protected
- Redirects to login if not authenticated
- Loading state while checking auth

### State Management
- AuthContext for global user state
- Local state for page-specific data
- React hooks for data fetching

## Available Scripts

- `npm start`: Start development server
- `npm run build`: Create production build
- `npm test`: Run tests
- `npm run eject`: Eject from Create React App (irreversible)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Production Deployment

The production build is served by nginx with:
- Gzip compression
- Static asset caching
- React Router support (fallback to index.html)

See `nginx.conf` for nginx configuration.

## Future Enhancements

Potential improvements for the frontend:

- Real-time updates with WebSockets
- Push notifications
- Offline support with Service Workers
- Advanced filtering and search
- Map integration for event locations
- Image uploads for events and groups
- Dark mode theme
- Internationalization (i18n)

## Contributing

When contributing to the frontend:

1. Follow React best practices
2. Use Material-UI components when possible
3. Keep components small and focused
4. Write descriptive component names
5. Add prop types or TypeScript types
6. Test on multiple screen sizes

## License

ISC
