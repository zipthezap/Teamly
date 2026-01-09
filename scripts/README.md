# Scripts Directory

This directory contains various scripts for the Teamly project.

## Contents

### Test Scripts (`tests/`)

Testing scripts for various features and APIs:

- **test-api.sh** / **test-api.bat** - Main API testing script
  - Tests user registration, authentication, group and event creation
  - Available for both Unix/Linux/Mac (`.sh`) and Windows (`.bat`)

- **test-auth-features.sh** - Authentication features test
  - Tests enhanced authentication and security features
  - Includes 2FA, password reset, and account lockout tests

- **test-event-concurrency.sh** - Event concurrency test
  - Tests concurrent event operations and race conditions
  - Validates event integrity under concurrent access

- **test-invite-links.sh** - Invite links feature test
  - Tests event invite link generation and guest participation
  - Validates QR code generation and social sharing

- **test-new-features.sh** - New features comprehensive test
  - Tests recently added features
  - Includes recurring events, comments, and notifications

- **test-notifications.js** - Notification system test
  - Tests notification delivery and preferences
  - Validates real-time notification functionality

### Maintenance Scripts

- **eventMaintenance.js** - Event cleanup and maintenance tasks
- **eventReminders.js** - Event reminder notification sender

### Backend Testing

- **test-backend-improvements.js** - Tests backend improvements and optimizations

## Usage

### Running Test Scripts (Unix/Linux/Mac)

```bash
# From project root
./scripts/tests/test-api.sh

# Or make executable and run
chmod +x scripts/tests/test-api.sh
./scripts/tests/test-api.sh
```

### Running Test Scripts (Windows)

```cmd
REM From project root
scripts\tests\test-api.bat
```

### Environment Variables

Some test scripts support environment variable configuration:

```bash
# Set custom API URL
API_URL=http://localhost:3000/api ./scripts/tests/test-api.sh

# Set custom frontend URL
FRONTEND_URL=http://localhost:3001 ./scripts/tests/test-invite-links.sh
```

## Adding New Scripts

When adding new scripts:
1. Place them in the appropriate subdirectory
2. Add execute permissions for `.sh` scripts: `chmod +x script-name.sh`
3. Document the script purpose and usage in this README
4. Include error handling and clear output messages
