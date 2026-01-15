# Frontend Security Considerations

This document outlines security considerations and recommendations for the Teamly frontend application.

## Current Security Implementation

### Authentication Token Storage

**Current Implementation:** JWT tokens are stored in browser `localStorage`

**Location:** 
- `/src/frontend/src/contexts/AuthContext.tsx` - Token storage and retrieval
- `/src/frontend/src/services/api.ts` - Token usage in API requests

**Code:**
```typescript
localStorage.setItem('token', accessToken);
localStorage.setItem('user', JSON.stringify(user));
```

### Security Considerations

#### ⚠️ localStorage Vulnerabilities

**XSS (Cross-Site Scripting) Risk:**
- localStorage is accessible to any JavaScript code running on the page
- If an attacker can inject malicious JavaScript (via XSS), they can steal tokens
- Tokens in localStorage persist until explicitly cleared

**Impact:** 
- HIGH - Stolen tokens allow full account access
- Tokens don't expire from localStorage automatically

#### Current Mitigations in Place

✅ **Implemented:**
1. **Content Security Policy (CSP)** - Via Helmet middleware on backend
2. **No `dangerouslySetInnerHTML`** - React escapes all rendered content by default
3. **Input Sanitization** - Backend validates and sanitizes user input
4. **XSS Prevention Headers** - Set via Helmet

❌ **Not Implemented:**
1. **httpOnly Cookies** - Would prevent JavaScript access to tokens
2. **Token Rotation** - Refresh token mechanism
3. **Short-lived Access Tokens** - Current tokens may have long expiration

## Recommended Improvements

### 1. Move to httpOnly Cookies (Highest Priority)

**Benefits:**
- Cookies with `httpOnly` flag cannot be accessed by JavaScript
- Protects against XSS attacks
- Browser handles cookie lifecycle automatically

**Implementation:**
```typescript
// Backend changes needed (src/backend/middleware/auth.ts)
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'strict', // CSRF protection
  maxAge: 15 * 60 * 1000 // 15 minutes
});

// Frontend changes (src/frontend/src/contexts/AuthContext.tsx)
// Remove localStorage usage
// Cookies automatically sent with requests
```

### 2. Implement Token Refresh Pattern

**Recommended Flow:**
1. Short-lived access token (15 minutes) in httpOnly cookie
2. Long-lived refresh token (7 days) in httpOnly cookie
3. Automatic token refresh when access token expires
4. Refresh token rotation on each use

### 3. Add Token Expiration Validation

**Current Issue:** Tokens stored in localStorage don't automatically expire

**Solution:**
```typescript
// Validate token expiration on app initialization
const token = localStorage.getItem('token');
if (token) {
  const decoded = jwtDecode(token);
  if (decoded.exp * 1000 < Date.now()) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Redirect to login
  }
}
```

### 4. Implement Secure Logout

**Current:** Tokens remain valid on server after logout

**Recommendation:**
- Token blacklist/revocation on backend
- Clear all tokens on logout
- Invalidate all sessions on password change

## Other Security Best Practices

### Already Implemented ✅

1. **HTTPS Enforcement** - Configured in production
2. **CORS Configuration** - Restricts API access to frontend domain
3. **Rate Limiting** - Prevents brute force attacks
4. **Input Validation** - Backend validates all inputs
5. **Password Hashing** - bcrypt with salt rounds
6. **2FA Support** - Two-factor authentication available

### Additional Recommendations

1. **Subresource Integrity (SRI)** - For CDN resources
2. **Regular Dependency Updates** - Patch known vulnerabilities
3. **Security Headers Audit** - Verify all recommended headers are set
4. **Session Timeout** - Auto-logout after inactivity

## Migration Path

For teams wanting to migrate from localStorage to httpOnly cookies:

### Phase 1: Backend Changes
1. Update authentication endpoints to set httpOnly cookies
2. Implement refresh token rotation
3. Add token validation middleware
4. Create token revocation system

### Phase 2: Frontend Changes
1. Remove localStorage token storage
2. Update API client to use credentials: 'include'
3. Implement automatic token refresh
4. Update authentication context

### Phase 3: Testing
1. Test login/logout flows
2. Verify token refresh works
3. Test CSRF protection
4. Security audit

## Additional Resources

- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Web Authentication Best Practices](https://web.dev/security-credential-management/)
- [Token Storage Best Practices](https://auth0.com/docs/secure/tokens/token-storage)

## Conclusion

While the current localStorage implementation has some XSS protections in place, migrating to httpOnly cookies would significantly improve security by removing JavaScript access to authentication tokens. This change requires coordination between frontend and backend teams but provides substantial security benefits.

**Priority Level:** 🟡 Medium-High
- Current system works but has known vulnerabilities
- XSS mitigation strategies are in place
- Migration should be prioritized for production deployments

## Related Documentation

- [docs/SECURITY.md](./SECURITY.md) - Overall security features
- [docs/guides/AUTH_SECURITY_GUIDE.md](./guides/AUTH_SECURITY_GUIDE.md) - Authentication security
