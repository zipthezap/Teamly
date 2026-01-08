# Security Best Practices and Features

This document outlines the security features implemented in Teamly and best practices for maintaining security.

## Security Features

### 1. Password Security

#### Strong Password Requirements
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*()_+-=[]{};"\\|,.<>/?)

#### Password Reset Flow
- Users can request a password reset via email
- Reset tokens are cryptographically secure (SHA-256 hashed)
- Tokens expire after 1 hour
- Password reset endpoint: `POST /api/auth/forgot-password`
- Reset with token endpoint: `POST /api/auth/reset-password`

Example usage:
```bash
# Request password reset
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# Reset password with token
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN","newPassword":"NewSecure123!"}'
```

### 2. Account Protection

#### Failed Login Attempts
- Tracks failed login attempts per user
- After 5 failed attempts, account is locked for 15 minutes
- Failed attempts counter resets on successful login
- Prevents brute force attacks

#### Rate Limiting
- Authentication endpoints: 5 requests per 15 minutes per IP
- General API endpoints: 300 requests per 15 minutes per IP
- Protects against DoS attacks

### 3. Input Validation and Sanitization

#### XSS Prevention
All user-generated content is sanitized to prevent Cross-Site Scripting (XSS) attacks:
- Comments
- Group chat messages
- Group names and descriptions
- Event details

The `sanitizeUserInput()` function escapes HTML special characters:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#x27;`
- `/` → `&#x2F;`

#### Validation Functions
- `validateEmail()` - Email format validation
- `validatePassword()` - Basic password length check (legacy)
- `validateStrongPassword()` - Enforces strong password requirements
- `validateUUID()` - UUID format validation
- `sanitizeString()` - Trims whitespace
- `sanitizeUserInput()` - Sanitizes and escapes HTML

### 4. Security Headers (Helmet)

The application uses Helmet middleware to set security HTTP headers:

- **Content-Security-Policy (CSP)**: Controls resource loading
- **HTTP Strict Transport Security (HSTS)**: Forces HTTPS connections
  - Max age: 1 year
  - Includes subdomains
  - Preload enabled
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-Frame-Options**: Prevents clickjacking
- **X-XSS-Protection**: Enables browser XSS protection

### 5. Request Size Limits

- JSON body limit: 10MB
- URL-encoded body limit: 10MB
- Prevents memory exhaustion attacks

### 6. JWT Token Security

- Tokens expire after 7 days
- Tokens are signed with a secret key from environment variables
- Secret must be changed in production (never use default)
- Tokens are validated on each protected route

### 7. Two-Factor Authentication (2FA)

- Optional TOTP-based 2FA using Speakeasy
- QR code generation for easy setup
- Backup codes for account recovery
- Required on login when enabled

## Database Security

### SQL Injection Prevention
- Uses Prisma ORM which prevents SQL injection by default
- All database queries are parameterized
- Input validation before database operations

### Secure Fields
- Passwords are hashed with bcrypt (cost factor: 10)
- 2FA secrets are encrypted
- Sensitive fields excluded from API responses

## Environment Variables

### Required Security Variables

```env
# CRITICAL: Change this in production!
JWT_SECRET=your-secret-key-change-this-in-production

# Email service credentials (keep secret)
SENDGRID_API_KEY=your-sendgrid-key
AWS_SES_PASSWORD=your-ses-password
SMTP_PASSWORD=your-smtp-password

# Google API Key (for Maps)
GOOGLE_API_KEY=your-google-api-key-here
```

### Security Warnings

⚠️ **NEVER commit actual API keys or secrets to version control!**

The `.env.example` file contains placeholder values only. Your actual `.env` file should:
- Be listed in `.gitignore`
- Contain unique, secure values
- Be different for each environment (dev, staging, production)

## Best Practices for Developers

### 1. Input Validation
Always validate and sanitize user input:
```typescript
import { sanitizeUserInput, validateEmail } from '../utils/validation';

// Sanitize text content
const cleanContent = sanitizeUserInput(userContent);

// Validate email
validateEmail(email, 'Email');
```

### 2. Password Handling
Never log or expose passwords:
```typescript
// ✅ Good - password excluded from response
select: { id: true, email: true, name: true }

// ❌ Bad - password included
select: { id: true, email: true, password: true }
```

### 3. Error Messages
Don't leak sensitive information in error messages:
```typescript
// ✅ Good - generic message
res.status(401).json({ error: 'Invalid credentials' });

// ❌ Bad - reveals if email exists
res.status(401).json({ error: 'Email not found' });
```

### 4. Logging
Use the logger utility, not console.log:
```typescript
import { logger } from '../utils/logger';

// ✅ Good
logger.info('User logged in', 'AuthController', { userId: user.id });

// ❌ Bad - may expose sensitive data
console.log('User:', user);
```

### 5. Authentication
Always use the auth middleware for protected routes:
```typescript
router.get('/protected', authMiddleware, controller.action);
```

## Security Audit Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to a strong random value
- [ ] Configure email service with production credentials
- [ ] Replace placeholder API keys with production keys
- [ ] Enable HTTPS/TLS for all connections
- [ ] Set NODE_ENV=production
- [ ] Review and update CORS settings
- [ ] Enable database backups
- [ ] Set up monitoring and alerting
- [ ] Review rate limiting thresholds
- [ ] Test 2FA flow thoroughly
- [ ] Verify password reset emails work
- [ ] Check all user inputs are sanitized
- [ ] Confirm sensitive data is not logged

## Reporting Security Issues

If you discover a security vulnerability, please:
1. **Do not** open a public issue
2. Email the maintainers directly
3. Provide details and steps to reproduce
4. Allow time for a patch before public disclosure

## Security Updates

- Review dependencies regularly for vulnerabilities: `npm audit`
- Keep dependencies up to date: `npm update`
- Monitor security advisories for used packages
- Test security features after major updates

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet Documentation](https://helmetjs.github.io/)

## Compliance

This application implements security measures in accordance with:
- OWASP Application Security Verification Standard (ASVS)
- CWE/SANS Top 25 Most Dangerous Software Errors
- General Data Protection Regulation (GDPR) principles
