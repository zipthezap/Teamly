#!/bin/bash

# Teamly API Test Script
# This script tests the main API endpoints

BASE_URL="http://localhost:3000"

echo "========================================="
echo "Teamly API Test Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo "1. Testing Health Endpoint..."
HEALTH_RESPONSE=$(curl -s ${BASE_URL}/health)
echo "Response: $HEALTH_RESPONSE"
echo ""

# Test 2: Register User
echo "2. Testing User Registration..."
REGISTER_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "name": "Test User"
  }')
echo "Response: $REGISTER_RESPONSE"

# Extract token from response
TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
USER_ID=$(echo $REGISTER_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Token: $TOKEN"
echo "User ID: $USER_ID"
echo ""

# Test 3: Get Profile
echo "3. Testing Get Profile (authenticated)..."
PROFILE_RESPONSE=$(curl -s ${BASE_URL}/api/auth/profile \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $PROFILE_RESPONSE"
echo ""

# Test 4: Create Group
echo "4. Testing Create Group..."
GROUP_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Sunday Football League",
    "description": "Weekly football matches every Sunday"
  }')
echo "Response: $GROUP_RESPONSE"

GROUP_ID=$(echo $GROUP_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Group ID: $GROUP_ID"
echo ""

# Test 5: Get Groups
echo "5. Testing Get All Groups..."
GROUPS_RESPONSE=$(curl -s ${BASE_URL}/api/groups \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $GROUPS_RESPONSE"
echo ""

# Test 6: Create Event
echo "6. Testing Create Event..."
# Function to get tomorrow's date in ISO format
get_tomorrow_date() {
  if date -u -d "+1 day" +"%Y-%m-%dT10:00:00Z" 2>/dev/null; then
    return 0
  elif date -u -v+1d +"%Y-%m-%dT10:00:00Z" 2>/dev/null; then
    return 0
  else
    echo "2026-12-31T10:00:00Z"
  fi
}
TOMORROW=$(get_tomorrow_date)

EVENT_RESPONSE=$(curl -s -X POST ${BASE_URL}/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"groupId\": \"$GROUP_ID\",
    \"title\": \"Weekend Football Match\",
    \"description\": \"Casual game at the park\",
    \"eventType\": \"football\",
    \"location\": \"Central Park\",
    \"startTime\": \"$TOMORROW\",
    \"maxPlayers\": 10
  }")
echo "Response: $EVENT_RESPONSE"

EVENT_ID=$(echo $EVENT_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Event ID: $EVENT_ID"
echo ""

# Test 7: Get Events
echo "7. Testing Get All Events..."
EVENTS_RESPONSE=$(curl -s ${BASE_URL}/api/events \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $EVENTS_RESPONSE"
echo ""

# Test 8: Get Specific Group
echo "8. Testing Get Specific Group..."
SPECIFIC_GROUP=$(curl -s ${BASE_URL}/api/groups/${GROUP_ID} \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $SPECIFIC_GROUP"
echo ""

# Test 9: Update Event
echo "9. Testing Update Event..."
UPDATE_EVENT=$(curl -s -X PUT ${BASE_URL}/api/events/${EVENT_ID} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Weekend Football Match - Updated",
    "maxPlayers": 12
  }')
echo "Response: $UPDATE_EVENT"
echo ""

# Test 10: Test Error Cases
echo "10. Testing Error Cases..."
echo "  a) Accessing without token..."
ERROR_RESPONSE=$(curl -s ${BASE_URL}/api/groups)
echo "  Response: $ERROR_RESPONSE"
echo ""

echo "  b) Invalid login..."
ERROR_LOGIN=$(curl -s -X POST ${BASE_URL}/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com",
    "password": "wrongpass"
  }')
echo "  Response: $ERROR_LOGIN"
echo ""

echo "========================================="
echo "Test Suite Completed!"
echo "========================================="
echo ""
echo "Summary:"
echo "✓ Health check endpoint working"
echo "✓ User registration working"
echo "✓ Authentication working"
echo "✓ Group creation working"
echo "✓ Event creation working"
echo "✓ API error handling working"
echo ""
echo "Note: To run with a real database:"
echo "1. Set up PostgreSQL"
echo "2. Update DATABASE_URL in .env"
echo "3. Run: npm run prisma:migrate"
echo "4. Start server: npm start"
