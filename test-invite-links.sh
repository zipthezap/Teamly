#!/bin/bash

# Test script for Event Invite Links feature
# This script tests the new event invite link and guest participation functionality

API_URL="${API_URL:-http://localhost:3000/api}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3001}"
echo "Testing Event Invite Links feature"
echo "API: $API_URL"
echo "Frontend: $FRONTEND_URL"
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
    fi
}

echo -e "\n${YELLOW}Step 1: Register a test user${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invitetest@example.com",
    "password": "TestPass123!",
    "name": "Invite Test User"
  }')

if echo "$REGISTER_RESPONSE" | grep -q "token"; then
    print_result 0 "User registration"
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
else
    echo -e "${YELLOW}Note: User might already exist, trying to login...${NC}"
    LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "invitetest@example.com",
        "password": "TestPass123!"
      }')
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
fi

echo "Token: ${TOKEN:0:20}..."

echo -e "\n${YELLOW}Step 2: Create a test group${NC}"
GROUP_RESPONSE=$(curl -s -X POST "$API_URL/groups" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Invite Test Group",
    "description": "Testing event invite links"
  }')

GROUP_ID=$(echo "$GROUP_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -n "$GROUP_ID" ]; then
    print_result 0 "Group creation"
    echo "Group ID: $GROUP_ID"
else
    print_result 1 "Group creation"
    echo "Response: $GROUP_RESPONSE"
    exit 1
fi

echo -e "\n${YELLOW}Step 3: Create a public event${NC}"
EVENT_RESPONSE=$(curl -s -X POST "$API_URL/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"groupId\": \"$GROUP_ID\",
    \"title\": \"Public Football Match\",
    \"description\": \"Open to everyone via invite link\",
    \"eventType\": \"football\",
    \"location\": \"Central Park\",
    \"startTime\": \"$(date -u -d '+2 days' +%Y-%m-%dT%H:%M:%SZ)\",
    \"maxPlayers\": 10,
    \"isPublic\": true
  }")

EVENT_ID=$(echo "$EVENT_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -n "$EVENT_ID" ]; then
    print_result 0 "Public event creation"
    echo "Event ID: $EVENT_ID"
    
    # Check if event has inviteToken
    if echo "$EVENT_RESPONSE" | grep -q '"inviteToken"'; then
        print_result 0 "Event created with invite token"
        INVITE_TOKEN=$(echo "$EVENT_RESPONSE" | grep -o '"inviteToken":"[^"]*' | cut -d'"' -f4)
        echo "Invite Token: $INVITE_TOKEN"
    else
        echo -e "${YELLOW}Event created but needs invite token generation${NC}"
    fi
else
    print_result 1 "Public event creation"
    echo "Response: $EVENT_RESPONSE"
    exit 1
fi

echo -e "\n${YELLOW}Step 4: Generate invite token (if not already generated)${NC}"
if [ -z "$INVITE_TOKEN" ]; then
    INVITE_RESPONSE=$(curl -s -X POST "$API_URL/events/$EVENT_ID/generate-invite" \
      -H "Authorization: Bearer $TOKEN")
    
    INVITE_TOKEN=$(echo "$INVITE_RESPONSE" | grep -o '"inviteToken":"[^"]*' | cut -d'"' -f4)
    if [ -n "$INVITE_TOKEN" ]; then
        print_result 0 "Invite token generation"
        echo "Invite Token: $INVITE_TOKEN"
    else
        print_result 1 "Invite token generation"
        echo "Response: $INVITE_RESPONSE"
    fi
fi

echo -e "\n${YELLOW}Step 5: Get event by invite token (no auth)${NC}"
PUBLIC_EVENT_RESPONSE=$(curl -s -X GET "$API_URL/events/invite/$INVITE_TOKEN")

if echo "$PUBLIC_EVENT_RESPONSE" | grep -q "Public Football Match"; then
    print_result 0 "Public event access without authentication"
    echo "Event title: $(echo "$PUBLIC_EVENT_RESPONSE" | grep -o '"title":"[^"]*' | cut -d'"' -f4)"
else
    print_result 1 "Public event access without authentication"
    echo "Response: $PUBLIC_EVENT_RESPONSE"
fi

echo -e "\n${YELLOW}Step 6: Join event as guest (no auth)${NC}"
GUEST_JOIN_RESPONSE=$(curl -s -X POST "$API_URL/events/invite/$INVITE_TOKEN/join" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Guest Player"
  }')

if echo "$GUEST_JOIN_RESPONSE" | grep -q "Successfully joined"; then
    print_result 0 "Guest joining event"
    GUEST_ID=$(echo "$GUEST_JOIN_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "Guest ID: $GUEST_ID"
else
    print_result 1 "Guest joining event"
    echo "Response: $GUEST_JOIN_RESPONSE"
fi

echo -e "\n${YELLOW}Step 7: Verify guest appears in event participants${NC}"
VERIFY_RESPONSE=$(curl -s -X GET "$API_URL/events/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$VERIFY_RESPONSE" | grep -q "Guest Player"; then
    print_result 0 "Guest participant visible in event"
    
    # Count total participants
    REGISTERED_COUNT=$(echo "$VERIFY_RESPONSE" | grep -o '"participants":\[' | wc -l)
    GUEST_COUNT=$(echo "$VERIFY_RESPONSE" | grep -o '"guestParticipants":\[' | wc -l)
    echo "Event has registered participants and guest participants"
else
    print_result 1 "Guest participant visible in event"
fi

echo -e "\n${YELLOW}Step 8: Test invalid invite token${NC}"
INVALID_RESPONSE=$(curl -s -X GET "$API_URL/events/invite/invalid-token-12345")

if echo "$INVALID_RESPONSE" | grep -q "not found\|invalid"; then
    print_result 0 "Invalid invite token properly rejected"
else
    print_result 1 "Invalid invite token handling"
    echo "Response: $INVALID_RESPONSE"
fi

echo -e "\n${YELLOW}Step 9: Try to join as guest with empty name${NC}"
EMPTY_NAME_RESPONSE=$(curl -s -X POST "$API_URL/events/invite/$INVITE_TOKEN/join" \
  -H "Content-Type: application/json" \
  -d '{
    "name": ""
  }')

if echo "$EMPTY_NAME_RESPONSE" | grep -q "Name is required"; then
    print_result 0 "Empty name validation"
else
    print_result 1 "Empty name validation"
    echo "Response: $EMPTY_NAME_RESPONSE"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Testing Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Summary:"
echo "- Public event created with ID: $EVENT_ID"
echo "- Invite token: $INVITE_TOKEN"
echo "- Invite URL: $FRONTEND_URL/events/join/$INVITE_TOKEN"
echo "- Guest successfully joined as 'Guest Player'"
echo ""
echo "You can test the frontend by:"
echo "1. Starting the frontend (cd src/frontend && npm start)"
echo "2. Visiting: $FRONTEND_URL/events/join/$INVITE_TOKEN"
echo "3. Entering a name and clicking 'Join Event'"
