#!/bin/bash

# Concurrent Event Join Test
# Tests that maxPlayers limit is correctly enforced even under concurrent load

BASE_URL="${API_URL:-http://localhost:3000}"
MAX_PLAYERS=5
CONCURRENT_ATTEMPTS=10

echo "================================================"
echo "Testing Event Concurrency Protection"
echo "================================================"
echo "Base URL: $BASE_URL"
echo "Max Players: $MAX_PLAYERS"
echo "Concurrent Attempts: $CONCURRENT_ATTEMPTS"
echo ""

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

# Cleanup function
cleanup() {
    print_info "Cleaning up temporary files..."
    rm -f /tmp/join_*.txt /tmp/test_tokens.txt
}

trap cleanup EXIT

# Step 1: Create test users
echo "Step 1: Creating test users..."
TOKEN_FILE="/tmp/test_tokens.txt"
> "$TOKEN_FILE"

for i in $(seq 1 $CONCURRENT_ATTEMPTS); do
    EMAIL="concurrency-test-$i-$(date +%s)@example.com"
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\",\"name\":\"Test User $i\"}")
    
    if echo "$RESPONSE" | grep -q "accessToken"; then
        TOKEN=$(echo "$RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
        USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
        echo "$TOKEN|$USER_ID" >> "$TOKEN_FILE"
        print_success "Created user $i"
    else
        print_error "Failed to create user $i"
        exit 1
    fi
done
echo ""

# Step 2: Create a test group
echo "Step 2: Creating test group..."
FIRST_TOKEN=$(head -1 "$TOKEN_FILE" | cut -d'|' -f1)
GROUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/groups" \
    -H "Authorization: Bearer $FIRST_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Concurrency Test Group\",\"description\":\"Testing concurrent joins\"}")

if echo "$GROUP_RESPONSE" | grep -q "id"; then
    GROUP_ID=$(echo "$GROUP_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    print_success "Created group: $GROUP_ID"
else
    print_error "Failed to create group"
    echo "$GROUP_RESPONSE"
    exit 1
fi
echo ""

# Step 3: Add all users to the group
echo "Step 3: Adding users to group..."
COUNTER=1
while IFS='|' read -r TOKEN USER_ID; do
    if [ $COUNTER -eq 1 ]; then
        # First user is already the creator
        COUNTER=$((COUNTER + 1))
        continue
    fi
    
    # Invite user to group
    INVITE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/groups/$GROUP_ID/invite" \
        -H "Authorization: Bearer $FIRST_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"userId\":\"$USER_ID\"}")
    
    if echo "$INVITE_RESPONSE" | grep -q "id\|success\|member"; then
        print_success "Added user $COUNTER to group"
    else
        print_info "User $COUNTER may already be in group or invitation sent"
    fi
    COUNTER=$((COUNTER + 1))
done < "$TOKEN_FILE"
echo ""

# Step 4: Create an event with limited capacity
echo "Step 4: Creating event with maxPlayers=$MAX_PLAYERS..."
START_TIME=$(date -u -d "+1 day" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+1d +"%Y-%m-%dT%H:%M:%SZ")
EVENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/events" \
    -H "Authorization: Bearer $FIRST_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"groupId\":\"$GROUP_ID\",
        \"title\":\"Concurrency Test Event\",
        \"description\":\"Testing concurrent joins\",
        \"eventType\":\"football\",
        \"location\":\"Test Stadium\",
        \"startTime\":\"$START_TIME\",
        \"maxPlayers\":$MAX_PLAYERS
    }")

if echo "$EVENT_RESPONSE" | grep -q "id"; then
    EVENT_ID=$(echo "$EVENT_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    print_success "Created event: $EVENT_ID"
else
    print_error "Failed to create event"
    echo "$EVENT_RESPONSE"
    exit 1
fi
echo ""

# Step 5: Attempt concurrent joins
echo "Step 5: Attempting $CONCURRENT_ATTEMPTS concurrent joins..."
print_info "This should only allow $MAX_PLAYERS successful joins"
echo ""

COUNTER=1
while IFS='|' read -r TOKEN USER_ID; do
    # Launch join requests in parallel
    (
        RESULT=$(curl -s -X POST "$BASE_URL/api/events/$EVENT_ID/join" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json")
        echo "$RESULT" > "/tmp/join_$COUNTER.txt"
    ) &
    COUNTER=$((COUNTER + 1))
done < "$TOKEN_FILE"

# Wait for all requests to complete
wait

# Step 6: Analyze results
echo "Step 6: Analyzing results..."
SUCCESS_COUNT=0
FULL_COUNT=0
ERROR_COUNT=0

for i in $(seq 1 $CONCURRENT_ATTEMPTS); do
    if [ -f "/tmp/join_$i.txt" ]; then
        RESULT=$(cat "/tmp/join_$i.txt")
        if echo "$RESULT" | grep -q '"id"'; then
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            print_success "User $i joined successfully"
        elif echo "$RESULT" | grep -q "full"; then
            FULL_COUNT=$((FULL_COUNT + 1))
            print_info "User $i blocked (event full)"
        else
            ERROR_COUNT=$((ERROR_COUNT + 1))
            print_error "User $i got error: $(echo "$RESULT" | grep -o '"error":"[^"]*"')"
        fi
    fi
done
echo ""

# Step 7: Verify final participant count
echo "Step 7: Verifying final participant count..."
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/events/$EVENT_ID" \
    -H "Authorization: Bearer $FIRST_TOKEN")

PARTICIPANT_COUNT=$(echo "$VERIFY_RESPONSE" | grep -o '"participants":\[' | wc -l)
if [ "$PARTICIPANT_COUNT" -gt 0 ]; then
    # Count participants in the response
    ACTUAL_COUNT=$(echo "$VERIFY_RESPONSE" | grep -o '"userId"' | wc -l)
    print_info "Actual participants in database: $ACTUAL_COUNT"
fi
echo ""

# Final results
echo "================================================"
echo "Test Results"
echo "================================================"
echo "Successful joins: $SUCCESS_COUNT"
echo "Blocked (full): $FULL_COUNT"
echo "Errors: $ERROR_COUNT"
echo "Expected max: $MAX_PLAYERS"
echo ""

if [ "$SUCCESS_COUNT" -eq "$MAX_PLAYERS" ]; then
    print_success "✓ PASS: Exactly $MAX_PLAYERS users joined"
elif [ "$SUCCESS_COUNT" -lt "$MAX_PLAYERS" ]; then
    print_error "✗ FAIL: Only $SUCCESS_COUNT users joined (expected $MAX_PLAYERS)"
    exit 1
elif [ "$SUCCESS_COUNT" -gt "$MAX_PLAYERS" ]; then
    print_error "✗ FAIL: $SUCCESS_COUNT users joined (exceeded limit of $MAX_PLAYERS)"
    print_error "Race condition detected!"
    exit 1
fi

if [ "$FULL_COUNT" -gt 0 ]; then
    print_success "✓ PASS: $FULL_COUNT users correctly rejected"
fi

if [ "$ERROR_COUNT" -gt 0 ]; then
    print_error "⚠ WARNING: $ERROR_COUNT users got unexpected errors"
fi

echo ""
echo "Concurrency protection is working correctly!"
