#!/bin/bash

# Test script for new Teamly features
# This script demonstrates the usage of email notifications, recurring events, and comments

echo "====================================="
echo "Teamly New Features Test Script"
echo "====================================="
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3000/api}"
TOKEN=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if server is running
echo "Checking if server is running..."
if ! curl -s "${API_URL%/api}/health" > /dev/null; then
    print_error "Server is not running. Please start the server first."
    exit 1
fi
print_success "Server is running"
echo ""

# Test 1: Register a user
echo "Test 1: Register a new user"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "password123",
    "name": "Test User"
  }')

if echo "$REGISTER_RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    print_success "User registered successfully"
else
    print_info "User might already exist, trying to login..."
    LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "testuser@example.com",
        "password": "password123"
      }')
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        print_success "Logged in successfully"
    else
        print_error "Failed to login"
        exit 1
    fi
fi
echo ""

# Test 2: Get email preferences
echo "Test 2: Get email preferences"
EMAIL_PREFS=$(curl -s -X GET "$API_URL/email/preferences" \
  -H "Authorization: Bearer $TOKEN")

if echo "$EMAIL_PREFS" | grep -q "eventInvites"; then
    print_success "Retrieved email preferences"
    echo "$EMAIL_PREFS" | head -5
else
    print_error "Failed to get email preferences"
fi
echo ""

# Test 3: Update email preferences
echo "Test 3: Update email preferences"
UPDATE_PREFS=$(curl -s -X PUT "$API_URL/email/preferences" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventInvites": true,
    "eventReminders": true,
    "eventUpdates": false,
    "commentMentions": true
  }')

if echo "$UPDATE_PREFS" | grep -q "eventInvites"; then
    print_success "Updated email preferences"
else
    print_error "Failed to update email preferences"
fi
echo ""

# Test 4: Create a group
echo "Test 4: Create a group"
GROUP_RESPONSE=$(curl -s -X POST "$API_URL/groups" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Sports Group",
    "description": "A test group for sports events",
    "isPublic": true
  }')

if echo "$GROUP_RESPONSE" | grep -q "id"; then
    GROUP_ID=$(echo "$GROUP_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    print_success "Group created successfully (ID: ${GROUP_ID:0:8}...)"
else
    print_error "Failed to create group"
    exit 1
fi
echo ""

# Test 5: Create a recurring event
echo "Test 5: Create a recurring event"
EVENT_RESPONSE=$(curl -s -X POST "$API_URL/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"groupId\": \"$GROUP_ID\",
    \"title\": \"Weekly Football Match\",
    \"description\": \"Every Sunday morning\",
    \"eventType\": \"football\",
    \"location\": \"Central Park\",
    \"startTime\": \"2024-06-01T10:00:00Z\",
    \"endTime\": \"2024-06-01T12:00:00Z\",
    \"maxPlayers\": 10,
    \"isRecurring\": true,
    \"recurrenceRule\": \"FREQ=WEEKLY;BYDAY=SU;INTERVAL=1\",
    \"recurrenceEnd\": \"2024-12-31T23:59:59Z\"
  }")

if echo "$EVENT_RESPONSE" | grep -q "isRecurring"; then
    EVENT_ID=$(echo "$EVENT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    print_success "Recurring event created successfully (ID: ${EVENT_ID:0:8}...)"
else
    print_error "Failed to create recurring event"
    echo "$EVENT_RESPONSE" | head -10
fi
echo ""

# Test 6: Get recurring event instances
echo "Test 6: Get recurring event instances"
if [ -n "$EVENT_ID" ]; then
    INSTANCES=$(curl -s -X GET "$API_URL/events/$EVENT_ID/instances?limit=5" \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$INSTANCES" | grep -q "isInstance"; then
        INSTANCE_COUNT=$(echo "$INSTANCES" | grep -o "isInstance" | wc -l)
        print_success "Retrieved $INSTANCE_COUNT recurring event instances"
    else
        print_error "Failed to get recurring event instances"
    fi
else
    print_info "Skipping (no event ID available)"
fi
echo ""

# Test 7: Create a regular event for commenting
echo "Test 7: Create a regular event"
REGULAR_EVENT=$(curl -s -X POST "$API_URL/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"groupId\": \"$GROUP_ID\",
    \"title\": \"Basketball Game\",
    \"description\": \"Casual pickup game\",
    \"eventType\": \"basketball\",
    \"location\": \"Local Court\",
    \"startTime\": \"2024-06-15T14:00:00Z\",
    \"endTime\": \"2024-06-15T16:00:00Z\",
    \"maxPlayers\": 8
  }")

if echo "$REGULAR_EVENT" | grep -q "id"; then
    COMMENT_EVENT_ID=$(echo "$REGULAR_EVENT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    print_success "Regular event created successfully (ID: ${COMMENT_EVENT_ID:0:8}...)"
else
    print_error "Failed to create regular event"
fi
echo ""

# Test 8: Create a comment
echo "Test 8: Create a comment on event"
if [ -n "$COMMENT_EVENT_ID" ]; then
    COMMENT_RESPONSE=$(curl -s -X POST "$API_URL/comments" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"eventId\": \"$COMMENT_EVENT_ID\",
        \"content\": \"Looking forward to this game! Who else is coming?\"
      }")
    
    if echo "$COMMENT_RESPONSE" | grep -q "content"; then
        COMMENT_ID=$(echo "$COMMENT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        print_success "Comment created successfully (ID: ${COMMENT_ID:0:8}...)"
    else
        print_error "Failed to create comment"
    fi
else
    print_info "Skipping (no event ID available)"
fi
echo ""

# Test 9: Create a reply to the comment
echo "Test 9: Create a reply to comment"
if [ -n "$COMMENT_ID" ]; then
    REPLY_RESPONSE=$(curl -s -X POST "$API_URL/comments" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"eventId\": \"$COMMENT_EVENT_ID\",
        \"content\": \"I'll be there!\",
        \"parentId\": \"$COMMENT_ID\"
      }")
    
    if echo "$REPLY_RESPONSE" | grep -q "parentId"; then
        print_success "Reply created successfully"
    else
        print_error "Failed to create reply"
    fi
else
    print_info "Skipping (no comment ID available)"
fi
echo ""

# Test 10: Get all comments for the event
echo "Test 10: Get all comments for event"
if [ -n "$COMMENT_EVENT_ID" ]; then
    COMMENTS=$(curl -s -X GET "$API_URL/comments/event/$COMMENT_EVENT_ID" \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$COMMENTS" | grep -q "content"; then
        COMMENT_COUNT=$(echo "$COMMENTS" | grep -o '"content":"[^"]*"' | wc -l)
        print_success "Retrieved comments for event (Count: $COMMENT_COUNT)"
    else
        print_error "Failed to get comments"
    fi
else
    print_info "Skipping (no event ID available)"
fi
echo ""

# Summary
echo "====================================="
echo "Test Summary"
echo "====================================="
echo ""
print_info "All new features have been tested!"
echo ""
echo "Features tested:"
echo "  ✓ Email notification preferences"
echo "  ✓ Recurring event creation"
echo "  ✓ Recurring event instances"
echo "  ✓ Event comments"
echo "  ✓ Threaded replies"
echo ""
print_info "Note: Email sending requires proper SMTP configuration in .env"
print_info "Note: Database migrations must be run before using these features"
echo ""
echo "For more information, see NEW_FEATURES_IMPLEMENTATION.md"
