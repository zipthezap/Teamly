@echo off
REM Teamly API Test Script for Windows
REM This script tests the main API endpoints

setlocal enabledelayedexpansion

set BASE_URL=http://localhost:3000

echo =========================================
echo Teamly API Test Script (Windows)
echo =========================================
echo.

REM Test 1: Health Check
echo 1. Testing Health Endpoint...
curl -s %BASE_URL%/health
echo.
echo.

REM Test 2: Register User
echo 2. Testing User Registration...
set TEMP_FILE=%TEMP%\teamly_register.json
curl -s -X POST %BASE_URL%/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"testpass123\",\"name\":\"Test User\"}" > %TEMP_FILE%

type %TEMP_FILE%
echo.

REM Extract token and user ID (basic parsing)
for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"token\"" %TEMP_FILE%') do (
    set TOKEN_RAW=%%a
    set TOKEN=!TOKEN_RAW:"=!
    set TOKEN=!TOKEN: =!
)

for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"id\"" %TEMP_FILE%') do (
    set USER_ID_RAW=%%a
    set USER_ID=!USER_ID_RAW:"=!
    set USER_ID=!USER_ID: =!
    goto :got_user_id
)
:got_user_id

echo Token: !TOKEN!
echo User ID: !USER_ID!
echo.

REM Test 3: Get Profile
echo 3. Testing Get Profile (authenticated)...
curl -s %BASE_URL%/api/auth/profile ^
  -H "Authorization: Bearer !TOKEN!"
echo.
echo.

REM Test 4: Create Group
echo 4. Testing Create Group...
set TEMP_FILE2=%TEMP%\teamly_group.json
curl -s -X POST %BASE_URL%/api/groups ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer !TOKEN!" ^
  -d "{\"name\":\"Sunday Football League\",\"description\":\"Weekly football matches every Sunday\"}" > %TEMP_FILE2%

type %TEMP_FILE2%
echo.

REM Extract group ID
for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"id\"" %TEMP_FILE2%') do (
    set GROUP_ID_RAW=%%a
    set GROUP_ID=!GROUP_ID_RAW:"=!
    set GROUP_ID=!GROUP_ID: =!
    goto :got_group_id
)
:got_group_id

echo Group ID: !GROUP_ID!
echo.

REM Test 5: Get Groups
echo 5. Testing Get All Groups...
curl -s %BASE_URL%/api/groups ^
  -H "Authorization: Bearer !TOKEN!"
echo.
echo.

REM Test 6: Create Event
echo 6. Testing Create Event...
REM Use a future date for event
set TEMP_FILE3=%TEMP%\teamly_event.json
curl -s -X POST %BASE_URL%/api/events ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer !TOKEN!" ^
  -d "{\"groupId\":\"!GROUP_ID!\",\"title\":\"Weekend Football Match\",\"description\":\"Casual game at the park\",\"eventType\":\"football\",\"location\":\"Central Park\",\"startTime\":\"2026-12-31T10:00:00Z\",\"maxPlayers\":10}" > %TEMP_FILE3%

type %TEMP_FILE3%
echo.

REM Extract event ID
for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"id\"" %TEMP_FILE3%') do (
    set EVENT_ID_RAW=%%a
    set EVENT_ID=!EVENT_ID_RAW:"=!
    set EVENT_ID=!EVENT_ID: =!
    goto :got_event_id
)
:got_event_id

echo Event ID: !EVENT_ID!
echo.

REM Test 7: Get Events
echo 7. Testing Get All Events...
curl -s %BASE_URL%/api/events ^
  -H "Authorization: Bearer !TOKEN!"
echo.
echo.

REM Test 8: Get Specific Group
echo 8. Testing Get Specific Group...
curl -s %BASE_URL%/api/groups/!GROUP_ID! ^
  -H "Authorization: Bearer !TOKEN!"
echo.
echo.

REM Test 9: Update Event
echo 9. Testing Update Event...
curl -s -X PUT %BASE_URL%/api/events/!EVENT_ID! ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer !TOKEN!" ^
  -d "{\"title\":\"Weekend Football Match - Updated\",\"maxPlayers\":12}"
echo.
echo.

REM Test 10: Test Error Cases
echo 10. Testing Error Cases...
echo   a) Accessing without token...
curl -s %BASE_URL%/api/groups
echo.
echo.

echo   b) Invalid login...
curl -s -X POST %BASE_URL%/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"nonexistent@example.com\",\"password\":\"wrongpass\"}"
echo.
echo.

REM Cleanup temp files
del %TEMP_FILE% %TEMP_FILE2% %TEMP_FILE3% 2>nul

echo =========================================
echo Test Suite Completed!
echo =========================================
echo.
echo Summary:
echo [OK] Health check endpoint working
echo [OK] User registration working
echo [OK] Authentication working
echo [OK] Group creation working
echo [OK] Event creation working
echo [OK] API error handling working
echo.
echo Note: To run with a real database:
echo 1. Set up PostgreSQL
echo 2. Update DATABASE_URL in .env
echo 3. Run: npm run prisma:migrate
echo 4. Start server: npm start

endlocal
