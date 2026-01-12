# Manual Testing Guide - Scalability Improvements

This guide provides manual testing steps to verify the scalability improvements for Events and TeamUp features.

## Prerequisites

- Running backend server (`npm run dev`)
- Authenticated user (obtain JWT token)
- Tool like curl, Postman, or Thunder Client

## Setup

1. Start the backend server:
```bash
npm run dev
```

2. Login and get JWT token:
```bash
# Register/Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Save the token from response
export TOKEN="your-jwt-token-here"
```

## Test Cases

### 1. Events API - Pagination

#### Test 1.1: Basic Pagination (Offset-based)

**Test first page:**
```bash
curl -X GET "http://localhost:3000/api/events?limit=5&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "data": [...array of 5 or fewer events...],
  "pagination": {
    "limit": 5,
    "offset": 0,
    "total": 5,
    "hasMore": true,
    "nextCursor": "event-id-here"
  }
}
```

**Verify:**
- ✅ Response has `data` and `pagination` fields
- ✅ `data` array has at most 5 events
- ✅ `pagination.limit` equals 5
- ✅ `pagination.offset` equals 0
- ✅ `pagination.hasMore` indicates if more results exist
- ✅ `pagination.nextCursor` is present if hasMore is true

**Test second page:**
```bash
curl -X GET "http://localhost:3000/api/events?limit=5&offset=5" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- ✅ Returns next 5 events
- ✅ Events are different from first page
- ✅ `pagination.offset` equals 5

#### Test 1.2: Cursor-based Pagination

**Test first page:**
```bash
curl -X GET "http://localhost:3000/api/events?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Save the nextCursor from response, then test next page:**
```bash
# Replace CURSOR_VALUE with the nextCursor from previous response
curl -X GET "http://localhost:3000/api/events?limit=10&cursor=CURSOR_VALUE" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- ✅ Second page returns different events
- ✅ No overlap between pages
- ✅ Efficient for large datasets

#### Test 1.3: Pagination with Filters

**Test filtered pagination:**
```bash
curl -X GET "http://localhost:3000/api/events?limit=5&eventType=football&status=upcoming" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- ✅ Returns filtered results
- ✅ Pagination metadata is present
- ✅ Results match filter criteria

#### Test 1.4: Max Limit Enforcement

**Test exceeding max limit:**
```bash
curl -X GET "http://localhost:3000/api/events?limit=200" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- ✅ Server enforces max limit of 100
- ✅ Returns at most 100 events
- ✅ `pagination.limit` shows 100, not 200

### 2. TeamUp API - Pagination

#### Test 2.1: Basic Pagination

**Test first page:**
```bash
curl -X GET "http://localhost:3000/api/teamup?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "data": [...array of TeamUp requests...],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 10,
    "hasMore": true,
    "nextCursor": "request-id-here"
  }
}
```

**Verify:**
- ✅ Response has correct structure
- ✅ Returns at most 10 requests
- ✅ Pagination metadata is accurate

#### Test 2.2: Cursor-based Pagination

**Test with cursor:**
```bash
# First page
curl -X GET "http://localhost:3000/api/teamup?limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Next page using cursor
curl -X GET "http://localhost:3000/api/teamup?limit=10&cursor=CURSOR_VALUE" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- ✅ Cursor-based navigation works
- ✅ No duplicate results across pages

#### Test 2.3: Filtered Pagination

**Test with sport type filter:**
```bash
curl -X GET "http://localhost:3000/api/teamup?limit=5&sportType=football&status=open" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- ✅ Returns filtered results
- ✅ Pagination works with filters

### 3. Cache Headers

#### Test 3.1: Events List Caching

**Test cache headers:**
```bash
curl -I "http://localhost:3000/api/events" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify headers:**
```
Cache-Control: private, max-age=60, stale-while-revalidate=30
```

**Verify:**
- ✅ `Cache-Control` header is present
- ✅ `max-age=60` (60 seconds cache)
- ✅ `private` (user-specific)
- ✅ `stale-while-revalidate=30`

#### Test 3.2: Event Details Caching

**Test event details:**
```bash
curl -I "http://localhost:3000/api/events/EVENT_ID_HERE" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- ✅ `Cache-Control: private, max-age=120, stale-while-revalidate=30`
- ✅ 2-minute cache for details

#### Test 3.3: No Cache for Mutations

**Test POST endpoint:**
```bash
curl -I -X POST "http://localhost:3000/api/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"groupId":"test","title":"Test Event","eventType":"football","startTime":"2026-12-31T10:00:00Z"}'
```

**Verify:**
- ✅ `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
- ✅ POST/PUT/DELETE endpoints have no-cache headers

### 4. Performance Testing

#### Test 4.1: Response Time

**Measure response time:**
```bash
time curl -X GET "http://localhost:3000/api/events?limit=50" \
  -H "Authorization: Bearer $TOKEN" \
  -o /dev/null -s
```

**Verify:**
- ✅ Response time < 200ms for 50 events
- ✅ Response time < 500ms for 100 events

#### Test 4.2: Large Dataset

If you have a database with many events:

```bash
# Test with large offset
curl -X GET "http://localhost:3000/api/events?limit=50&offset=1000" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- ✅ Still responds quickly (< 500ms)
- ✅ Returns correct page of results

#### Test 4.3: Concurrent Requests

**Test multiple concurrent requests:**
```bash
# Run 10 concurrent requests
for i in {1..10}; do
  curl -X GET "http://localhost:3000/api/events?limit=20" \
    -H "Authorization: Bearer $TOKEN" &
done
wait
```

**Verify:**
- ✅ All requests complete successfully
- ✅ Server remains responsive
- ✅ No errors or timeouts

### 5. Backward Compatibility

#### Test 5.1: Events without Pagination Parameters

**Test default behavior:**
```bash
curl -X GET "http://localhost:3000/api/events" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- ✅ Returns results (default limit of 50)
- ✅ Response has new format with `data` and `pagination`
- ⚠️ **Breaking Change**: Frontend must now access `response.data.data`

### 6. Edge Cases

#### Test 6.1: Empty Results

**Test with no matching results:**
```bash
curl -X GET "http://localhost:3000/api/events?eventType=nonexistent&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "data": [],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 0,
    "hasMore": false,
    "nextCursor": null
  }
}
```

**Verify:**
- ✅ Returns empty array
- ✅ `hasMore` is false
- ✅ `nextCursor` is null

#### Test 6.2: Invalid Cursor

**Test with invalid cursor:**
```bash
curl -X GET "http://localhost:3000/api/events?cursor=invalid-cursor-id" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- ✅ Handles gracefully (returns empty or error)
- ✅ Doesn't crash the server

#### Test 6.3: Negative Limits/Offsets

**Test with negative values:**
```bash
curl -X GET "http://localhost:3000/api/events?limit=-5&offset=-10" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- ✅ Server handles gracefully
- ✅ Uses default/minimum values

## Test Results Template

Copy and fill out:

```
Date: ___________
Tester: ___________
Environment: Development / Staging / Production

✅ = Pass, ❌ = Fail, ⚠️ = Issue

Events API:
- [ ] Basic pagination (offset)
- [ ] Cursor-based pagination
- [ ] Pagination with filters
- [ ] Max limit enforcement

TeamUp API:
- [ ] Basic pagination
- [ ] Cursor-based pagination
- [ ] Filtered pagination

Cache Headers:
- [ ] Events list caching
- [ ] Event details caching
- [ ] No cache for mutations

Performance:
- [ ] Response time < 200ms
- [ ] Large dataset handling
- [ ] Concurrent requests

Edge Cases:
- [ ] Empty results
- [ ] Invalid cursor
- [ ] Negative values

Notes:
___________________________________________
___________________________________________
```

## Troubleshooting

### Issue: Frontend shows empty data

**Cause**: Frontend not updated to use new response format

**Fix**: Update frontend to access `response.data.data` instead of `response.data`

### Issue: Pagination not working

**Cause**: Old Prisma client

**Fix**: Run `npx prisma generate` to regenerate client

### Issue: Slow queries

**Cause**: Indexes not applied

**Fix**: Run database migration: `npm run prisma:migrate`

### Issue: Cache not working

**Cause**: Browser ignoring cache headers

**Fix**: Check DevTools Network tab, verify headers are present

## Performance Benchmarks

Record your test results:

| Test | Before | After | Improvement |
|------|--------|-------|-------------|
| Events list (50) | ___ ms | ___ ms | ___ % |
| Events list (100) | ___ ms | ___ ms | ___ % |
| TeamUp list (50) | ___ ms | ___ ms | ___ % |
| Filtered queries | ___ ms | ___ ms | ___ % |

## Conclusion

After completing all tests, verify:
- ✅ All pagination features work correctly
- ✅ Cache headers are present and correct
- ✅ Performance improvements are measurable
- ✅ No regressions in existing functionality
- ✅ Edge cases are handled gracefully

Document any issues found and their severity.
