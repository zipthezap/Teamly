# Frontend Implementation Guide

This document describes the newly implemented frontend features for Teamly.

## Overview

All backend features have been fully integrated with a modern, responsive React frontend using Material-UI.

## Table of Contents

1. [Public Group Discovery](#public-group-discovery)
2. [Location-Based Filtering](#location-based-filtering)
3. [Join Request Management](#join-request-management)
4. [Two-Factor Authentication](#two-factor-authentication)
5. [Event Voting System](#event-voting-system)
6. [Setup and Usage](#setup-and-usage)

---

## Public Group Discovery

### Overview
Users can browse and discover public groups without needing an invitation. This feature enables organic growth of communities.

### Features
- **Public Groups Page** (`/public-groups`)
  - Browse all groups marked as public
  - View group details: name, description, member count
  - Request to join with a single click
  - No authentication required for browsing

### User Journey
1. Navigate to "Discover" in the navigation bar
2. Browse available public groups
3. Click "Request to Join" on any group
4. Wait for admin approval
5. Join request status visible in group details

### Technical Implementation
- **Component**: `src/frontend/src/pages/PublicGroups.js`
- **API Endpoint**: `GET /api/groups/public`
- **State Management**: React hooks for loading and request states

---

## Location-Based Filtering

### Overview
Groups can now specify their location, and users can filter public groups by distance from their current position.

### Features
- **Location Picker Component**
  - Browser geolocation API integration
  - Manual latitude/longitude entry
  - Location name/description field
  - "Use Current Location" button
  - Visual feedback on location set

- **Distance Radius Filter**
  - Adjustable slider (1-100 km)
  - Real-time filtering
  - Sort groups by distance
  - Display distance on each group card

### User Journey
1. Create a public group with location
2. Enable location in the group creation form
3. Use "Get Current Location" or enter manually
4. Browse public groups
5. Enable location filtering
6. Adjust distance radius to find nearby groups

### Technical Implementation
- **Components**:
  - `src/frontend/src/components/LocationPicker.js`
  - Distance calculation using Haversine formula
- **Database Fields**: `latitude`, `longitude`, `locationName`
- **Backend Support**: Location fields in group creation/update

### Distance Calculation
```javascript
// Haversine formula for distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
```

---

## Join Request Management

### Overview
Admins can review and manage join requests from users who want to join public groups.

### Features
- **Admin View** (in Group Details)
  - Pending join requests section
  - User information display
  - One-click approve/reject
  - Real-time updates
  - Member count updates automatically

- **User View**
  - Request status tracking
  - Notification of approval/rejection
  - Request history

### User Journey

#### For Users:
1. Find a public group
2. Click "Request to Join"
3. Wait for admin decision
4. Receive notification of approval/rejection

#### For Admins:
1. Navigate to group details
2. See pending join requests (highlighted section)
3. Review user information
4. Click ✓ to approve or ✗ to reject
5. Member automatically added on approval

### Technical Implementation
- **Component**: Enhanced `src/frontend/src/pages/GroupDetails.js`
- **API Endpoints**:
  - `POST /api/groups/:id/join-request` - Submit request
  - `GET /api/groups/:id/join-requests` - Get pending (admin)
  - `POST /api/groups/:id/join-requests/:requestId` - Approve/reject (admin)

---

## Two-Factor Authentication

### Overview
Complete 2FA implementation with setup wizard, QR codes, backup codes, and login flow integration.

### Features

#### Setup Wizard
- **4-Step Process**:
  1. Get Started - Introduction to 2FA
  2. Scan QR Code - Display QR for authenticator apps
  3. Verify Setup - Test 6-digit code
  4. Save Backup Codes - Download 10 backup codes

#### Components
- **QR Code Display**: Easy scanning with authenticator apps
- **Manual Entry**: Secret key for manual configuration
- **Backup Codes**: 10 single-use recovery codes
- **Download Functionality**: Save codes as text file

#### Login Flow
- Standard login with email/password
- If 2FA enabled, show token input
- 6-digit code verification
- Backup code support

#### Management
- Enable/disable 2FA
- Password required to disable
- Status indicator in navbar
- Dedicated settings page

### User Journey

#### Setup:
1. Click "2FA" in navigation
2. Follow 4-step wizard
3. Scan QR code with authenticator app
4. Verify with first code
5. Download backup codes

#### Login:
1. Enter email and password
2. If 2FA enabled, enter 6-digit code
3. Code validated from authenticator app
4. Or use backup code if needed

### Technical Implementation
- **Component**: `src/frontend/src/pages/TwoFactorSetup.js`
- **Updated**: `src/frontend/src/pages/Login.js`
- **API Endpoints**:
  - `GET /api/2fa/status`
  - `POST /api/2fa/setup`
  - `POST /api/2fa/verify`
  - `POST /api/2fa/disable`

### Security Features
- TOTP-based (Time-based One-Time Password)
- Compatible with Google Authenticator, Authy, etc.
- 10 single-use backup codes
- Password required to disable
- Secure QR code generation

---

## Event Voting System

### Overview
Democratic event creation process where admins propose events and members vote before finalization.

### Features

#### For Admins:
- **Create Event Requests**
  - All standard event fields
  - Voting status tracking
  - Finalize when ready
  - Cancel if needed

- **Management**
  - View real-time vote counts
  - See vote percentages
  - Finalize button (creates actual event)
  - Cancel button (rejects proposal)

#### For Members:
- **Voting Interface**
  - Yes/No buttons
  - Vote count display
  - Progress bar visualization
  - Update vote capability
  - See personal vote

### Voting Rules
- One vote per member
- Can change vote before finalization
- Event created if: `yesVotes > noVotes`
- Event cancelled if: `noVotes >= yesVotes`
- Finalized events appear in events list

### User Journey

#### Admin Creates Request:
1. Navigate to group details
2. Click "Event Requests"
3. Create new event request
4. Fill in event details
5. Submit for voting

#### Members Vote:
1. See event request notification
2. Review event details
3. Vote Yes or No
4. See current vote counts
5. Can change vote

#### Admin Finalizes:
1. Review vote results
2. Click "Finalize" when ready
3. System checks vote counts
4. Event created or cancelled based on votes

### Technical Implementation
- **Component**: `src/frontend/src/pages/EventRequests.js`
- **API Endpoints**:
  - `POST /api/event-requests` - Create (admin)
  - `GET /api/event-requests/group/:groupId` - List
  - `GET /api/event-requests/:id` - Get details
  - `POST /api/event-requests/:id/vote` - Vote
  - `POST /api/event-requests/:id/finalize` - Finalize (admin)
  - `POST /api/event-requests/:id/cancel` - Cancel (admin)

### Visual Elements
- Vote count chips
- Progress bars (green for majority, red for minority)
- Status badges (Voting/Finalized/Cancelled)
- User's vote indicator
- Admin-only action buttons

---

## Setup and Usage

### Prerequisites
- Node.js 20+
- Docker and Docker Compose (recommended)
- PostgreSQL 16+ (if running locally)

### Installation

#### Using Docker (Recommended):
```bash
# Clone the repository
git clone <repository-url>
cd Teamly

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost
# Backend: http://localhost:3000
```

#### Local Development:

1. **Backend Setup**:
```bash
# Install dependencies
npm install

# Setup database
npm run prisma:migrate

# Start backend
npm run dev
```

2. **Frontend Setup**:
```bash
cd src/frontend

# Install dependencies
npm install

# Start development server
npm start
```

### Environment Variables

Create `.env` file:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/teamly?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-change-this-in-production
```

Frontend `.env` (optional):
```env
REACT_APP_API_URL=http://localhost:3000/api
```

### Database Migrations

All migrations are automatically applied on startup with Docker. For local development:

```bash
# Run migrations
npm run prisma:migrate

# Generate Prisma Client
npm run prisma:generate
```

### Building for Production

```bash
# Build frontend
cd src/frontend
npm run build

# Backend runs without build step
cd ../..
npm start
```

---

## User Guide

### Creating a Public Group with Location

1. Click "Groups" → "Create Group"
2. Enter group name and description
3. Check "Make this group public"
4. In the Location section:
   - Click "Use Current Location" (browser will ask permission)
   - Or enter coordinates manually
   - Add a location name (e.g., "Central Park, NYC")
5. Click "Create Group"

### Requesting to Join a Group

1. Click "Discover" in the navigation
2. Browse available groups
3. Optionally enable location filtering:
   - Click "Enable Location"
   - Adjust distance radius
4. Find a group and click "Request to Join"
5. Wait for admin approval

### Managing Join Requests (Admin)

1. Go to "Groups" and select your group
2. Pending requests appear at the top (highlighted)
3. Review user information
4. Click ✓ to approve or ✗ to reject
5. User receives notification

### Setting Up 2FA

1. Click "2FA" in the navigation
2. Click "Start Setup"
3. Open authenticator app (Google Authenticator, Authy, etc.)
4. Scan QR code or enter secret manually
5. Enter the 6-digit code to verify
6. Download backup codes (important!)
7. Click "Done"

### Logging in with 2FA

1. Enter email and password
2. Click "Login"
3. Enter 6-digit code from authenticator app
4. Click "Verify and Login"
5. If you lost your device, use a backup code

### Creating an Event Request (Admin)

1. Go to group details
2. Click "Event Requests" button
3. Click "Create Event Request"
4. Fill in event details
5. Click "Create"
6. Members can now vote

### Voting on Event Request

1. Navigate to "Event Requests" for your group
2. Review event details
3. Click "Yes" to approve or "No" to reject
4. See vote counts update in real-time
5. You can change your vote anytime before finalization

### Finalizing Event Request (Admin)

1. Review vote counts and percentage
2. Click "Finalize" when ready
3. If yes votes > no votes: Event is created
4. If no votes >= yes votes: Request is cancelled
5. View created event in Events list

---

## Troubleshooting

### Location Not Working
- **Check browser permissions**: Allow location access
- **HTTPS required**: Geolocation requires secure connection (except localhost)
- **Manual entry**: Use latitude/longitude if automatic detection fails

### 2FA Issues
- **Clock sync**: Ensure device time is accurate
- **Backup codes**: Use if you lost authenticator access
- **Disable 2FA**: Enter password on 2FA settings page

### Join Requests Not Showing
- **Check admin status**: Only admins see pending requests
- **Refresh page**: Requests update on page load
- **Check group**: Ensure group is marked as public

### Event Requests
- **Admin only**: Only admins can create and finalize
- **Vote updates**: Refresh to see latest vote counts
- **Finalization**: Cannot finalize twice

---

## API Integration

All features use RESTful API endpoints documented in `API_DOCUMENTATION.md`.

### Key Endpoints

#### Public Groups
```javascript
// Get all public groups
GET /api/groups/public

// Request to join
POST /api/groups/:id/join-request

// Get pending requests (admin)
GET /api/groups/:id/join-requests

// Handle request (admin)
POST /api/groups/:id/join-requests/:requestId
Body: { "action": "approve" | "reject" }
```

#### Two-Factor Authentication
```javascript
// Get status
GET /api/2fa/status

// Setup (get QR code)
POST /api/2fa/setup

// Verify and enable
POST /api/2fa/verify
Body: { "token": "123456" }

// Disable
POST /api/2fa/disable
Body: { "password": "your-password" }
```

#### Event Requests
```javascript
// Create request (admin)
POST /api/event-requests
Body: { event details... }

// Get requests for group
GET /api/event-requests/group/:groupId

// Vote
POST /api/event-requests/:id/vote
Body: { "vote": "yes" | "no" }

// Finalize (admin)
POST /api/event-requests/:id/finalize

// Cancel (admin)
POST /api/event-requests/:id/cancel
```

---

## Browser Support

### Required Features
- **Geolocation API**: For location-based filtering
- **Clipboard API**: For copying 2FA secret
- **localStorage**: For authentication tokens
- **Canvas/Image**: For QR code display

### Supported Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Mobile Support
- iOS Safari 14+
- Chrome Mobile 90+
- Android WebView (modern versions)

---

## Performance Considerations

### Optimization Strategies
- **Lazy Loading**: Components loaded on demand
- **Memo & Callback**: Prevent unnecessary re-renders
- **Debouncing**: Distance filter updates throttled
- **Pagination**: Large lists paginated
- **Caching**: API responses cached where appropriate

### Bundle Size
- Main bundle: ~198 KB (gzipped)
- Material-UI: Included
- No external map libraries required

---

## Security Notes

### Frontend Security
- ✅ No sensitive data in localStorage
- ✅ JWT tokens have expiration
- ✅ HTTPS required for geolocation
- ✅ XSS protection via React
- ✅ CSRF protection via tokens
- ✅ Input validation on all forms
- ✅ API error messages sanitized

### Backend Security
All backend endpoints have proper:
- Authentication middleware
- Rate limiting
- Input validation
- SQL injection protection (Prisma ORM)
- Password hashing (bcrypt)
- JWT secret rotation capability

### 2FA Security
- TOTP standard (RFC 6238)
- 30-second time window
- 6-digit codes
- Backup codes hashed in database
- Single-use backup codes
- Password required to disable

---

## Future Enhancements

### Potential Features
1. **Email Notifications**
   - Join request status
   - Event voting reminders
   - 2FA changes

2. **Real-time Updates**
   - WebSocket integration
   - Live vote counts
   - Instant notifications

3. **Advanced Maps**
   - Interactive map view
   - Cluster markers
   - Route planning

4. **Enhanced 2FA**
   - SMS backup option
   - WebAuthn/FIDO2
   - Trusted devices

5. **Event Voting Improvements**
   - Voting deadlines
   - Minimum vote requirements
   - Vote delegation
   - Anonymous voting option

---

## Support

For issues or questions:
- **Documentation**: See `README.md` and `API_DOCUMENTATION.md`
- **Issues**: Create a GitHub issue
- **Email**: Contact repository owner

---

## License

ISC License - See LICENSE file for details
