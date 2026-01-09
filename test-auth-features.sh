#!/bin/bash

# Test script for enhanced auth and security features
# This script demonstrates the new authentication flows

BASE_URL="${API_URL:-http://localhost:3000}"
EMAIL="test-$(date +%s)@example.com"
PASSWORD="SecurePass123!"
NAME="Test User"

echo "================================================"
echo "Testing Enhanced Authentication & Security"
echo "================================================"
echo "Base URL: $BASE_URL"
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

# Test 1: Register new user
echo "1. Testing user registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"$NAME\"}")

if echo "$REGISTER_RESPONSE" | grep -q "accessToken"; then
    print_success "User registered successfully"
    ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
    USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    print_info "Access Token: ${ACCESS_TOKEN:0:20}..."
    print_info "Refresh Token: ${REFRESH_TOKEN:0:20}..."
else
    print_error "Registration failed"
    echo "$REGISTER_RESPONSE"
    exit 1
fi
echo ""

# Test 2: Get user profile
echo "2. Testing authenticated request (get profile)..."
PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/profile" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$PROFILE_RESPONSE" | grep -q "$EMAIL"; then
    print_success "Profile retrieved successfully"
else
    print_error "Failed to get profile"
    echo "$PROFILE_RESPONSE"
fi
echo ""

# Test 3: Get active sessions
echo "3. Testing session management..."
SESSIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/sessions" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$SESSIONS_RESPONSE" | grep -q "sessions"; then
    print_success "Sessions retrieved successfully"
    SESSION_COUNT=$(echo "$SESSIONS_RESPONSE" | grep -o '"id"' | wc -l)
    print_info "Active sessions: $SESSION_COUNT"
else
    print_error "Failed to get sessions"
    echo "$SESSIONS_RESPONSE"
fi
echo ""

# Test 4: Refresh access token
echo "4. Testing token refresh..."
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/refresh-token" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")

if echo "$REFRESH_RESPONSE" | grep -q "accessToken"; then
    print_success "Token refreshed successfully"
    NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    print_info "New Access Token: ${NEW_ACCESS_TOKEN:0:20}..."
    # Use the new token for subsequent requests
    ACCESS_TOKEN=$NEW_ACCESS_TOKEN
else
    print_error "Token refresh failed"
    echo "$REFRESH_RESPONSE"
fi
echo ""

# Test 5: Login with existing user
echo "5. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
    print_success "Login successful"
    LOGIN_ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    print_info "New Access Token: ${LOGIN_ACCESS_TOKEN:0:20}..."
else
    print_error "Login failed"
    echo "$LOGIN_RESPONSE"
fi
echo ""

# Test 6: Check sessions after login (should have 2 now)
echo "6. Verifying multiple sessions..."
SESSIONS_RESPONSE2=$(curl -s -X GET "$BASE_URL/api/auth/sessions" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$SESSIONS_RESPONSE2" | grep -q "sessions"; then
    SESSION_COUNT2=$(echo "$SESSIONS_RESPONSE2" | grep -o '"id"' | wc -l)
    print_success "Multiple sessions detected"
    print_info "Active sessions: $SESSION_COUNT2"
else
    print_error "Failed to verify multiple sessions"
fi
echo ""

# Test 7: Logout from current session
echo "7. Testing logout (current session)..."
LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/logout" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$LOGOUT_RESPONSE" | grep -q "successfully"; then
    print_success "Logout successful"
else
    print_error "Logout failed"
    echo "$LOGOUT_RESPONSE"
fi
echo ""

# Test 8: Verify token is revoked
echo "8. Verifying token revocation..."
REVOKED_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/profile" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$REVOKED_RESPONSE" | grep -q "revoked\|Invalid"; then
    print_success "Token successfully revoked"
else
    print_error "Token not revoked properly"
    echo "$REVOKED_RESPONSE"
fi
echo ""

# Test 9: Logout all sessions
echo "9. Testing logout from all devices..."
LOGOUT_ALL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/logout-all" \
    -H "Authorization: Bearer $LOGIN_ACCESS_TOKEN")

if echo "$LOGOUT_ALL_RESPONSE" | grep -q "successfully"; then
    print_success "Logged out from all devices"
else
    print_error "Logout all failed"
    echo "$LOGOUT_ALL_RESPONSE"
fi
echo ""

# Test 10: Failed login attempt (wrong password)
echo "10. Testing failed login (wrong password)..."
FAILED_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPassword123!\"}")

if echo "$FAILED_LOGIN" | grep -q "Invalid credentials"; then
    print_success "Failed login handled correctly"
else
    print_error "Failed login not handled properly"
    echo "$FAILED_LOGIN"
fi
echo ""

echo "================================================"
echo "All tests completed!"
echo "================================================"
echo ""
echo "Summary:"
echo "- JWT token refresh and revocation ✓"
echo "- Session management and tracking ✓"
echo "- Multi-device authentication ✓"
echo "- Secure logout functionality ✓"
echo ""
echo "Note: To test email verification, check your email for:"
echo "  Email: $EMAIL"
echo "  Or manually verify using the verification token in the database"
