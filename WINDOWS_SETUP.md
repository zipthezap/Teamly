# Teamly - Windows Development Setup Guide

This guide provides detailed instructions for setting up and running Teamly on Windows.

## Prerequisites

### Required Software

1. **Node.js** (v20 or higher, LTS recommended)
   - Download from: https://nodejs.org/
   - The project uses Node.js 20 (specified in .nvmrc)
   - Verify installation: `node --version` and `npm --version`

2. **PostgreSQL** (v12 or higher)
   - Download from: https://www.postgresql.org/download/windows/
   - During installation, remember the password you set for the `postgres` user
   - Add PostgreSQL bin directory to PATH (usually done automatically)
   - Verify installation: `psql --version`

3. **Git for Windows**
   - Download from: https://git-scm.com/download/win
   - Recommended: Use Git Bash for better compatibility with shell scripts

4. **A Code Editor**
   - Recommended: Visual Studio Code (https://code.visualstudio.com/)

### Optional but Recommended

1. **Windows Terminal**
   - Available in Microsoft Store
   - Provides a better command-line experience

2. **Docker Desktop for Windows** (alternative to local PostgreSQL)
   - Download from: https://www.docker.com/products/docker-desktop/
   - Requires WSL2 for optimal performance

## Installation Steps

### Method 1: Using Local PostgreSQL

#### 1. Clone the Repository

Open Command Prompt or PowerShell:

```cmd
git clone https://github.com/zipthezap/Teamly.git
cd Teamly
```

#### 2. Install Node.js Dependencies

```cmd
npm install
```

#### 3. Set Up PostgreSQL Database

Open Command Prompt as Administrator and create a database:

```cmd
psql -U postgres
```

Then in the PostgreSQL prompt:

```sql
CREATE DATABASE teamly;
\q
```

Or use pgAdmin (GUI tool installed with PostgreSQL):
- Right-click on "Databases" → Create → Database
- Name it "teamly"

#### 4. Configure Environment Variables

Copy the example environment file:

```cmd
copy .env.example .env
```

Edit `.env` file with your preferred text editor:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/teamly?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-change-this-in-production
```

**Important:** Replace `YOUR_PASSWORD` with the password you set during PostgreSQL installation.

#### 5. Set Up the Database Schema

Generate Prisma Client:

```cmd
npm run prisma:generate
```

Run database migrations:

```cmd
npm run prisma:migrate
```

When prompted for a migration name, you can use: `init`

#### 6. Start the Development Server

```cmd
npm run dev
```

The server will start on http://localhost:3000

### Method 2: Using Docker Desktop

This is the easiest method if you have Docker Desktop installed.

#### 1. Clone the Repository

```cmd
git clone https://github.com/zipthezap/Teamly.git
cd Teamly
```

#### 2. Start with Docker Compose

```cmd
docker-compose up -d
```

This will:
- Download and start PostgreSQL in a container
- Build and start the Teamly application
- Run database migrations automatically

#### 3. Check Logs

```cmd
docker-compose logs -f app
```

#### 4. Stop the Application

```cmd
docker-compose down
```

The server will be available at http://localhost:3000

## Testing the API

### Using the Windows Test Script

We provide a Windows batch script for testing:

```cmd
test-api.bat
```

### Using the Bash Script (in Git Bash)

If you have Git for Windows installed, you can use Git Bash:

```bash
./test-api.sh
```

### Using curl (PowerShell)

PowerShell has curl aliased to Invoke-WebRequest. For testing, use `curl.exe` explicitly:

```powershell
# Health check
curl.exe -X GET http://localhost:3000/health

# Register a user
curl.exe -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"user@example.com\",\"password\":\"password123\",\"name\":\"John Doe\"}'
```

### Using Postman or Insomnia

For a better API testing experience on Windows:

1. **Postman**: Download from https://www.postman.com/downloads/
2. **Insomnia**: Download from https://insomnia.rest/download

Import the API endpoints from `API_DOCUMENTATION.md` to test them.

## Common Windows-Specific Issues

### Issue 1: PostgreSQL Connection Errors

**Symptom:** `Error: P1001: Can't reach database server`

**Solutions:**
1. Verify PostgreSQL is running:
   - Open Services (`services.msc`)
   - Look for "postgresql-x64-XX" service
   - Make sure it's running

2. Check your DATABASE_URL:
   - Ensure the password is correct
   - Try using `127.0.0.1` instead of `localhost`
   - Example: `postgresql://postgres:password@127.0.0.1:5432/teamly?schema=public`

3. Check PostgreSQL is listening:
   ```cmd
   netstat -an | findstr 5432
   ```

### Issue 2: Port Already in Use

**Symptom:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions:**
1. Find the process using the port:
   ```cmd
   netstat -ano | findstr :3000
   ```

2. Kill the process (replace PID with the actual process ID):
   ```cmd
   taskkill /PID <PID> /F
   ```

3. Or change the port in `.env`:
   ```env
   PORT=3001
   ```

### Issue 3: npm Scripts Not Working

**Symptom:** Scripts fail with syntax errors

**Solution:** Use the Windows-compatible commands:

Instead of:
```bash
NODE_ENV=production node server.js
```

Use:
```cmd
set NODE_ENV=production && node server.js
```

Or install cross-env:
```cmd
npm install --save-dev cross-env
```

### Issue 4: Line Ending Issues

**Symptom:** Scripts fail with `^M` characters or similar errors

**Solution:** Configure Git to handle line endings properly:

```cmd
git config --global core.autocrlf true
```

This converts LF to CRLF on checkout and CRLF to LF on commit.

### Issue 5: Prisma Generate Fails

**Symptom:** `Error: Cannot find module '@prisma/client'`

**Solutions:**
1. Delete node_modules and reinstall:
   ```cmd
   rmdir /s /q node_modules
   npm install
   ```

2. Manually generate Prisma Client:
   ```cmd
   npx prisma generate
   ```

### Issue 6: Path Issues with Scripts

**Symptom:** Scripts fail to find files or commands

**Solution:** Use the full path or ensure the tools are in your PATH:

1. Check your PATH:
   ```cmd
   echo %PATH%
   ```

2. Add Node.js and PostgreSQL to PATH if needed:
   - Right-click "This PC" → Properties → Advanced System Settings
   - Environment Variables → Edit PATH
   - Add: `C:\Program Files\PostgreSQL\XX\bin`
   - Add: `C:\Program Files\nodejs`

## Development Workflow on Windows

### Using Visual Studio Code

1. Install recommended extensions:
   - Prisma
   - ESLint
   - REST Client (for testing APIs)

2. Open the project:
   ```cmd
   code .
   ```

3. Use the integrated terminal (Ctrl+`)

4. Run commands directly in VS Code terminal

### Database Management

#### Using Prisma Studio (GUI)

```cmd
npm run prisma:studio
```

This opens a web interface at http://localhost:5555 to view and edit your database.

#### Using pgAdmin

PostgreSQL comes with pgAdmin, a powerful GUI tool:
1. Open pgAdmin
2. Connect to your local PostgreSQL server
3. Navigate to your `teamly` database

### Hot Reloading

The `npm run dev` command uses nodemon for automatic restarts when you change files:

```cmd
npm run dev
```

Edit any file in the `src` directory, and the server will automatically restart.

## Performance Tips for Windows

1. **Use SSD:** Install Node.js, PostgreSQL, and your project on an SSD for better performance

2. **Exclude from Antivirus:** Add your project directory and node_modules to Windows Defender exclusions:
   - Settings → Update & Security → Windows Security → Virus & threat protection
   - Manage settings → Exclusions

3. **Use WSL2 for Docker:** If using Docker Desktop, enable WSL2 backend for better performance

4. **Increase Node.js Memory:** For large projects, increase Node.js memory:
   ```cmd
   set NODE_OPTIONS=--max-old-space-size=4096
   npm run dev
   ```

## Alternative Shells and Tools

### Git Bash

Git Bash provides a Unix-like environment on Windows:

```bash
# Run the regular test script
./test-api.sh

# Use Unix-style commands
ls -la
grep -r "something" src/
```

### Windows Subsystem for Linux (WSL)

For the most Unix-like experience on Windows:

1. Install WSL2: https://docs.microsoft.com/en-us/windows/wsl/install
2. Install Ubuntu from Microsoft Store
3. Follow the Linux setup instructions in the main README.md

### PowerShell

PowerShell is more powerful than Command Prompt:

```powershell
# Use PowerShell equivalents
Get-ChildItem -Recurse  # instead of ls -R
Select-String "pattern" -Path *.js  # instead of grep
```

## Environment Variables in Windows

### Setting Temporarily (Current Session)

**Command Prompt:**
```cmd
set NODE_ENV=development
set PORT=3000
```

**PowerShell:**
```powershell
$env:NODE_ENV="development"
$env:PORT="3000"
```

### Setting Permanently (System-wide)

1. Right-click "This PC" → Properties
2. Advanced System Settings → Environment Variables
3. Add new variables under "User variables" or "System variables"

### Using .env Files (Recommended)

The application uses the `dotenv` package to load variables from `.env` files automatically. This is the recommended approach and works the same on all platforms.

## Troubleshooting Commands

### Check Node.js Installation

```cmd
node --version
npm --version
```

### Check PostgreSQL Installation

```cmd
psql --version
```

### Check if PostgreSQL is Running

```cmd
sc query postgresql-x64-XX
```

Replace XX with your PostgreSQL version number.

### View Application Logs

When running with `npm run dev`, logs appear directly in your terminal.

For Docker:
```cmd
docker-compose logs -f app
```

## Next Steps

After setting up the development environment:

1. Read `README.md` for general usage
2. Check `API_DOCUMENTATION.md` for API details
3. Review `PROJECT_SUMMARY.md` for project architecture
4. See `DEPLOYMENT.md` for production deployment

## Getting Help

If you encounter issues not covered here:

1. Check the main README.md troubleshooting section
2. Review DEPLOYMENT.md for additional context
3. Check GitHub Issues for similar problems
4. Ensure all prerequisites are correctly installed

## Quick Reference

### Common Commands

```cmd
# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run dev

# Start production server
npm start

# Open Prisma Studio
npm run prisma:studio

# Run tests (Windows batch script)
test-api.bat
```

### Default Ports

- Application: 3000
- PostgreSQL: 5432
- Prisma Studio: 5555

### Important Files

- `.env` - Environment variables (create from `.env.example`)
- `prisma/schema.prisma` - Database schema
- `src/server.js` - Application entry point
- `package.json` - Dependencies and scripts
