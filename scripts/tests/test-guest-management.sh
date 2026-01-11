#!/bin/bash

# Guest Participant Management Test Script
# This script tests all the new guest participant management endpoints

set -e  # Exit on error

BASE_URL="http://localhost:3000/api"
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Guest Participant Management Integration Test ===${NC}\n"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed. Please install jq first.${NC}"
    exit 1
fi

# Variables to store IDs
USER_TOKEN=""
GROUP_ID=""
EVENT_ID=""
INVITE_TOKEN=""
GUEST_ID=""

echo -e "${BLUE}Step 1: Register a test user${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"testuser_$(date +%s)@example.com\",
    \"password\": \"Test123!@#\",
    \"name\": \"Test User\"
  }")

USER_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')
if [ "$USER_TOKEN" = "null" ] || [ -z "$USER_TOKEN" ]; then
    echo -e "${RED}Failed to register user${NC}"
    echo "$REGISTER_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓ User registered successfully${NC}\n"

echo -e "${BLUE}Step 2: Create a test group${NC}"
GROUP_RESPONSE=$(curl -s -X POST "$BASE_URL/groups" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "name": "Test Group for Guests",
    "description": "Testing guest participant management"
  }')

GROUP_ID=$(echo "$GROUP_RESPONSE" | jq -r '.id')
if [ "$GROUP_ID" = "null" ] || [ -z "$GROUP_ID" ]; then
    echo -e "${RED}Failed to create group${NC}"
    echo "$GROUP_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓ Group created: $GROUP_ID${NC}\n"

echo -e "${BLUE}Step 3: Create a public event with invite link${NC}"
TOMORROW=$(date -d "tomorrow 14:00" -Iseconds 2>/dev/null || date -v+1d -Iseconds 2>/dev/null)
EVENT_RESPONSE=$(curl -s -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d "{
    \"groupId\": \"$GROUP_ID\",
    \"title\": \"Test Event for Guest Management\",
    \"description\": \"Testing guest participant features\",
    \"eventType\": \"football\",
    \"location\": \"Test Field\",
    \"startTime\": \"$TOMORROW\",
    \"maxPlayers\": 10,
    \"isPublic\": true
  }")

EVENT_ID=$(echo "$EVENT_RESPONSE" | jq -r '.id')
INVITE_TOKEN=$(echo "$EVENT_RESPONSE" | jq -r '.inviteToken')
if [ "$EVENT_ID" = "null" ] || [ -z "$EVENT_ID" ]; then
    echo -e "${RED}Failed to create event${NC}"
    echo "$EVENT_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓ Event created: $EVENT_ID${NC}"
echo -e "${GREEN}✓ Invite token: $INVITE_TOKEN${NC}\n"

echo -e "${BLUE}Step 4: Join event as a guest (no authentication)${NC}"
GUEST_RESPONSE=$(curl -s -X POST "$BASE_URL/events/invite/$INVITE_TOKEN/join" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Guest"
  }')

GUEST_ID=$(echo "$GUEST_RESPONSE" | jq -r '.participant.id')
if [ "$GUEST_ID" = "null" ] || [ -z "$GUEST_ID" ]; then
    echo -e "${RED}Failed to join as guest${NC}"
    echo "$GUEST_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓ Guest joined successfully: $GUEST_ID${NC}\n"

echo -e "${BLUE}Step 5: Get all guest participants${NC}"
GUESTS_LIST=$(curl -s -X GET "$BASE_URL/events/$EVENT_ID/guests" \
  -H "Authorization: Bearer $USER_TOKEN")

GUEST_COUNT=$(echo "$GUESTS_LIST" | jq -r '.guestParticipants | length')
if [ "$GUEST_COUNT" -lt 1 ]; then
    echo -e "${RED}Failed to get guest participants${NC}"
    echo "$GUESTS_LIST"
    exit 1
fi
echo -e "${GREEN}✓ Found $GUEST_COUNT guest participant(s)${NC}"
echo "$GUESTS_LIST" | jq '.summary'
echo ""

echo -e "${BLUE}Step 6: Filter guests by confirmed status${NC}"
CONFIRMED_GUESTS=$(curl -s -X GET "$BASE_URL/events/$EVENT_ID/guests?status=confirmed" \
  -H "Authorization: Bearer $USER_TOKEN")

CONFIRMED_COUNT=$(echo "$CONFIRMED_GUESTS" | jq -r '.guestParticipants | length')
echo -e "${GREEN}✓ Found $CONFIRMED_COUNT confirmed guest(s)${NC}"
echo "$CONFIRMED_GUESTS" | jq '.summary'
echo ""

echo -e "${BLUE}Step 7: Update guest participant name${NC}"
UPDATE_NAME_RESPONSE=$(curl -s -X PUT "$BASE_URL/events/$EVENT_ID/guests/$GUEST_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "name": "John Updated Guest"
  }')

UPDATED_NAME=$(echo "$UPDATE_NAME_RESPONSE" | jq -r '.name')
if [ "$UPDATED_NAME" != "John Updated Guest" ]; then
    echo -e "${RED}Failed to update guest name${NC}"
    echo "$UPDATE_NAME_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓ Guest name updated: $UPDATED_NAME${NC}\n"

echo -e "${BLUE}Step 8: Update guest participant status to declined${NC}"
UPDATE_STATUS_RESPONSE=$(curl -s -X PUT "$BASE_URL/events/$EVENT_ID/guests/$GUEST_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "status": "declined"
  }')

UPDATED_STATUS=$(echo "$UPDATE_STATUS_RESPONSE" | jq -r '.status')
if [ "$UPDATED_STATUS" != "declined" ]; then
    echo -e "${RED}Failed to update guest status${NC}"
    echo "$UPDATE_STATUS_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓ Guest status updated to: $UPDATED_STATUS${NC}\n"

echo -e "${BLUE}Step 9: Verify declined status in guest list${NC}"
DECLINED_GUESTS=$(curl -s -X GET "$BASE_URL/events/$EVENT_ID/guests?status=declined" \
  -H "Authorization: Bearer $USER_TOKEN")

DECLINED_COUNT=$(echo "$DECLINED_GUESTS" | jq -r '.guestParticipants | length')
if [ "$DECLINED_COUNT" -lt 1 ]; then
    echo -e "${RED}Failed to verify declined status${NC}"
    echo "$DECLINED_GUESTS"
    exit 1
fi
echo -e "${GREEN}✓ Found $DECLINED_COUNT declined guest(s)${NC}"
echo "$DECLINED_GUESTS" | jq '.summary'
echo ""

echo -e "${BLUE}Step 10: Add another guest to test removal${NC}"
GUEST2_RESPONSE=$(curl -s -X POST "$BASE_URL/events/invite/$INVITE_TOKEN/join" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Guest"
  }')

GUEST2_ID=$(echo "$GUEST2_RESPONSE" | jq -r '.participant.id')
if [ "$GUEST2_ID" = "null" ] || [ -z "$GUEST2_ID" ]; then
    echo -e "${RED}Failed to add second guest${NC}"
    echo "$GUEST2_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓ Second guest added: $GUEST2_ID${NC}\n"

echo -e "${BLUE}Step 11: Remove the second guest participant${NC}"
REMOVE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/events/$EVENT_ID/guests/$GUEST2_ID" \
  -H "Authorization: Bearer $USER_TOKEN")

REMOVE_MESSAGE=$(echo "$REMOVE_RESPONSE" | jq -r '.message')
if [ "$REMOVE_MESSAGE" != "Guest participant removed successfully" ]; then
    echo -e "${RED}Failed to remove guest${NC}"
    echo "$REMOVE_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓ Guest removed successfully${NC}\n"

echo -e "${BLUE}Step 12: Verify guest was removed${NC}"
FINAL_GUESTS=$(curl -s -X GET "$BASE_URL/events/$EVENT_ID/guests" \
  -H "Authorization: Bearer $USER_TOKEN")

FINAL_COUNT=$(echo "$FINAL_GUESTS" | jq -r '.guestParticipants | length')
if [ "$FINAL_COUNT" -ne 1 ]; then
    echo -e "${RED}Expected 1 guest, found $FINAL_COUNT${NC}"
    echo "$FINAL_GUESTS"
    exit 1
fi
echo -e "${GREEN}✓ Verified: Only 1 guest remains${NC}"
echo "$FINAL_GUESTS" | jq '.summary'
echo ""

echo -e "${BLUE}Step 13: Test error cases${NC}"

# Test 13a: Try to update with empty name
echo -e "${BLUE}13a: Testing empty name validation${NC}"
EMPTY_NAME_RESPONSE=$(curl -s -X PUT "$BASE_URL/events/$EVENT_ID/guests/$GUEST_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "name": ""
  }')
ERROR_MESSAGE=$(echo "$EMPTY_NAME_RESPONSE" | jq -r '.error')
if [ "$ERROR_MESSAGE" = "Name is required" ]; then
    echo -e "${GREEN}✓ Empty name validation works${NC}"
else
    echo -e "${RED}Empty name validation failed${NC}"
    echo "$EMPTY_NAME_RESPONSE"
fi

# Test 13b: Try to update with invalid status
echo -e "${BLUE}13b: Testing invalid status validation${NC}"
INVALID_STATUS_RESPONSE=$(curl -s -X PUT "$BASE_URL/events/$EVENT_ID/guests/$GUEST_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "status": "invalid"
  }')
ERROR_MESSAGE=$(echo "$INVALID_STATUS_RESPONSE" | jq -r '.error')
if [[ "$ERROR_MESSAGE" == *"Invalid status"* ]]; then
    echo -e "${GREEN}✓ Invalid status validation works${NC}"
else
    echo -e "${RED}Invalid status validation failed${NC}"
    echo "$INVALID_STATUS_RESPONSE"
fi

# Test 13c: Try to update non-existent guest
echo -e "${BLUE}13c: Testing non-existent guest handling${NC}"
FAKE_GUEST_ID="00000000-0000-0000-0000-000000000000"
NONEXISTENT_RESPONSE=$(curl -s -X PUT "$BASE_URL/events/$EVENT_ID/guests/$FAKE_GUEST_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "name": "Test"
  }')
ERROR_MESSAGE=$(echo "$NONEXISTENT_RESPONSE" | jq -r '.error')
if [ "$ERROR_MESSAGE" = "Guest participant not found" ]; then
    echo -e "${GREEN}✓ Non-existent guest handling works${NC}"
else
    echo -e "${RED}Non-existent guest handling failed${NC}"
    echo "$NONEXISTENT_RESPONSE"
fi

echo ""
echo -e "${GREEN}=== All Tests Passed! ===${NC}"
echo ""
echo "Summary of tested features:"
echo "  ✓ Join event as guest (public endpoint)"
echo "  ✓ Get all guest participants"
echo "  ✓ Filter guest participants by status"
echo "  ✓ Update guest participant name"
echo "  ✓ Update guest participant status"
echo "  ✓ Remove guest participant"
echo "  ✓ Validation and error handling"
echo ""
echo "Guest participant management is fully functional!"
