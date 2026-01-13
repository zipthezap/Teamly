# Security Summary - Guest Participant Management

## New Security Features

### Authentication & Authorization
All new endpoints are protected with the same security measures as existing endpoints:

1. **JWT Authentication**: All endpoints require valid JWT tokens via `authMiddleware`
2. **Rate Limiting**: Protected by `authenticatedLimiter` (500 requests per 15 minutes)
3. **Role-Based Access Control**:
   - **View Access**: Any group member can view guest participants
   - **Modify Access**: Only event creators can update/remove guest participants

### Input Validation

#### Name Validation
```typescript
if (!name || name.trim().length === 0) {
  return res.status(400).json({ error: 'Name is required' });
}
```
- Prevents empty names
- Trims whitespace to prevent space-only names

#### Status Validation
```typescript
const validStatuses = Object.values(GuestParticipantStatus);
if (!status || !validStatuses.includes(status as GuestParticipantStatus)) {
  return res.status(400).json({ 
    error: 'Invalid status. Must be one of: confirmed, declined' 
  });
}
```
- Validates against enum values
- Prevents arbitrary status values

### SQL Injection Prevention
All database queries use Prisma's parameterized queries:
```typescript
await prisma.guestParticipant.update({
  where: { id: guestId },
  data: { name: name.trim() }
});
```
- No raw SQL
- Automatic escaping by Prisma
- Type-safe queries

### Authorization Checks

The `verifyGuestManagementAuth` helper provides consistent security:
```typescript
const verifyGuestManagementAuth = async (
  eventId: string,
  guestId: string,
  userId: string
): Promise<{ event: any; guest: any } | { error: string; status: number }> => {
  // 1. Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  // 2. Verify user is event creator
  if (event.creatorId !== userId) {
    return { error: 'Only the event creator can manage guest participants', status: 403 };
  }

  // 3. Verify guest belongs to event
  const guest = await prisma.guestParticipant.findFirst({
    where: {
      id: guestId,
      eventId: eventId
    }
  });

  return { event, guest };
};
```

### XSS Prevention
- Name input is trimmed but not sanitized for HTML (stored as plain text)
- Frontend should escape output when displaying guest names
- No HTML content is accepted or rendered

## Pre-Existing Issues

### CSRF Protection (Not Introduced by This PR)
CodeQL scanner identified missing CSRF protection for cookie-based session middleware. This is a **pre-existing issue** that affects the entire application:

**Location**: `src/backend/server.ts:107-116`
**Issue**: Cookie middleware serving request handlers without CSRF protection
**Scope**: Application-wide (not specific to guest participant management)
**Impact**: This affects all cookie-based authentication flows

**Note**: The new guest participant endpoints do NOT use cookies - they use JWT tokens passed in headers, which are not vulnerable to CSRF attacks in the same way.

### Recommendation for Future Work
The application should implement CSRF protection for cookie-based operations:
1. Add CSRF token middleware (e.g., `csurf` package)
2. Include CSRF tokens in forms and AJAX requests
3. Validate tokens on state-changing operations

However, this is outside the scope of this PR which focuses on adding guest participant management using the existing security patterns.

## Security Testing

### Manual Test Cases

1. **Unauthorized Access Attempt**
   ```bash
   # Try to update guest without authentication
   curl -X PUT "$BASE_URL/events/$EVENT_ID/guests/$GUEST_ID" \
     -H "Content-Type: application/json" \
     -d '{"name": "Hacker"}'
   # Expected: 401 Unauthorized
   ```

2. **Non-Creator Access Attempt**
   ```bash
   # Try to update guest as non-creator
   curl -X PUT "$BASE_URL/events/$EVENT_ID/guests/$GUEST_ID" \
     -H "Authorization: Bearer $OTHER_USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name": "Hacker"}'
   # Expected: 403 Forbidden
   ```

3. **Cross-Event Access Attempt**
   ```bash
   # Try to modify guest from different event
   curl -X PUT "$BASE_URL/events/$OTHER_EVENT_ID/guests/$GUEST_ID" \
     -H "Authorization: Bearer $CREATOR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name": "Hacker"}'
   # Expected: 404 Not Found
   ```

4. **Invalid Input Tests**
   - Empty name: Returns 400
   - Invalid status: Returns 400
   - Non-existent IDs: Returns 404

## Threat Model

### Threats Mitigated

✅ **Unauthorized Access**: JWT authentication required
✅ **Privilege Escalation**: Event creator check enforced  
✅ **SQL Injection**: Prisma parameterized queries
✅ **Cross-Event Manipulation**: Event-guest relationship verified
✅ **Rate Limiting**: Authenticated rate limiter applied
✅ **Input Validation**: Name and status validated

### Threats Not Addressed (Outside Scope)

⚠️ **CSRF on Cookies**: Pre-existing application-wide issue
⚠️ **XSS in Names**: Frontend must escape output
⚠️ **Enumeration**: Guest IDs can be enumerated (standard behavior)

## Compliance

### OWASP Top 10 (2021)

| Risk | Status | Notes |
|------|--------|-------|
| A01:2021 - Broken Access Control | ✅ Protected | Authorization checks on all endpoints |
| A02:2021 - Cryptographic Failures | N/A | No sensitive data in guest names |
| A03:2021 - Injection | ✅ Protected | Parameterized queries via Prisma |
| A04:2021 - Insecure Design | ✅ Safe | Follows principle of least privilege |
| A05:2021 - Security Misconfiguration | ✅ Safe | Uses existing secure configuration |
| A06:2021 - Vulnerable Components | ✅ Safe | No new dependencies added |
| A07:2021 - Identification/Authentication | ✅ Protected | JWT authentication required |
| A08:2021 - Software/Data Integrity | ✅ Safe | Input validation implemented |
| A09:2021 - Security Logging | ✅ Safe | Errors logged via logger utility |
| A10:2021 - Server-Side Request Forgery | N/A | No external requests made |

## Conclusion

The guest participant management implementation follows all existing security patterns in the application and introduces no new vulnerabilities. All endpoints are properly authenticated, authorized, and validated. The CSRF issue identified by CodeQL is a pre-existing application-wide concern that should be addressed separately.

### Security Checklist

- [x] Authentication required (JWT)
- [x] Authorization verified (event creator/group member)
- [x] Input validation implemented
- [x] SQL injection prevented (Prisma)
- [x] Error handling secure (no data leakage)
- [x] Rate limiting applied
- [x] Logging implemented
- [x] No new dependencies
- [x] Follows existing patterns
- [x] Documentation complete
