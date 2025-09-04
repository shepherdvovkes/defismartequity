# Security Headers and API Protection Implementation

## Overview
This document outlines the comprehensive security measures implemented across the DefiMon project, including security headers, API endpoint protection, and middleware security layers.

## Security Headers Implementation

### 1. Next.js Configuration (`next.config.js`)
The application-level security headers are configured in `next.config.js` and apply to all routes:

#### Global Security Headers
- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **X-Frame-Options**: `DENY` - Prevents clickjacking attacks
- **X-XSS-Protection**: `1; mode=block` - Enables XSS filtering
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Controls referrer information
- **Permissions-Policy**: `camera=(), microphone=(), geolocation=()` - Restricts sensitive permissions
- **Cross-Origin-Embedder-Policy**: `require-corp` - Enforces cross-origin isolation
- **Cross-Origin-Opener-Policy**: `same-origin` - Prevents cross-origin window manipulation
- **Cross-Origin-Resource-Policy**: `same-origin` - Restricts resource loading
- **Strict-Transport-Security**: `max-age=31536000; includeSubDomains; preload` - Enforces HTTPS

#### API-Specific Headers
- **Cache-Control**: `no-store, no-cache, must-revalidate, private` - Prevents caching of sensitive data
- **Pragma**: `no-cache` - HTTP/1.0 cache control
- **Expires**: `0` - Immediate expiration

### 2. Security Middleware (`src/middleware/security.js`)
Comprehensive security middleware that provides additional protection layers:

#### Security Headers Middleware
- Implements OWASP security recommendations
- Sets Content Security Policy (CSP) with specific allowances for:
  - Scripts: `'self'`, `'unsafe-eval'`, `'unsafe-inline'`, `https://cdn.ethers.io`, `https://unpkg.com`
  - Styles: `'self'`, `'unsafe-inline'`
  - Images: `'self'`, `data:`, `https:`
  - Fonts: `'self'`, `data:`
  - Connections: `'self'`, `https://sepolia.infura.io`, `https://api.etherscan.io`
  - Frame ancestors: `'none'`
  - Base URI: `'self'`
  - Form actions: `'self'`

#### Input Validation and Sanitization
- Validates HTTP methods (GET, POST, PUT, DELETE)
- Enforces Content-Type for POST/PUT requests
- Sanitizes query parameters and request body
- Removes potential script injection patterns
- Removes potential SQL injection patterns

#### CORS Protection
- Restricts origins to trusted domains:
  - `http://localhost:3000` (development)
  - `https://defismart.vercel.app` (staging)
  - `https://defismart.com` (production)
- Allows specific HTTP methods and headers
- Handles preflight requests properly

#### Request Size Limiting
- Configurable request size limits
- Default: 1MB for most endpoints
- Special limits for specific endpoints:
  - Contracts API: 5MB (for ABI/bytecode)
  - Contract Artifacts: 10MB (for large contract files)

## API Endpoint Protection

### 1. Authentication Layer
All API endpoints now require Ethereum-based authentication:
- **x-auth-address**: User's Ethereum address
- **x-auth-signature**: Cryptographic signature of challenge message
- **x-auth-timestamp**: Request timestamp for replay protection

### 2. Rate Limiting
Configurable rate limiting per endpoint:
- **Investments API**: 30 requests per 15 minutes
- **Contracts API**: 50 requests per 15 minutes
- **Transactions API**: 40 requests per 15 minutes
- **Stats API**: 60 requests per 15 minutes
- **Test Data API**: 10 requests per 15 minutes
- **Contract Artifacts API**: 100 requests per 15 minutes

### 3. Security Middleware Stack
Each API endpoint uses a layered security approach:
```
withFullSecurity() → withRateLimit() → withAuth() → API Handler
```

## Security Features by Endpoint

### Investments API (`/api/investments`)
- **Security Level**: High
- **Request Size Limit**: 2MB
- **Rate Limit**: 30 requests/15min
- **Authentication**: Required
- **Input Validation**: Full
- **CORS**: Enabled

### Contracts API (`/api/contracts`)
- **Security Level**: High
- **Request Size Limit**: 5MB (for ABI/bytecode)
- **Rate Limit**: 50 requests/15min
- **Authentication**: Required
- **Input Validation**: Full
- **CORS**: Enabled

### Transactions API (`/api/transactions`)
- **Security Level**: High
- **Request Size Limit**: 2MB
- **Rate Limit**: 40 requests/15min
- **Authentication**: Required
- **Input Validation**: Full
- **CORS**: Enabled

### Stats API (`/api/stats`)
- **Security Level**: Medium
- **Request Size Limit**: 1MB
- **Rate Limit**: 60 requests/15min
- **Authentication**: Required
- **Input Validation**: Full
- **CORS**: Enabled

### Test Data API (`/api/test-data`)
- **Security Level**: High
- **Request Size Limit**: 1MB
- **Rate Limit**: 10 requests/15min (restricted)
- **Authentication**: Required
- **Input Validation**: Full
- **CORS**: Enabled

### Contract Artifacts API (`/api/contract-artifacts`)
- **Security Level**: Medium
- **Request Size Limit**: 10MB (for large files)
- **Rate Limit**: 100 requests/15min
- **Authentication**: Required
- **Input Validation**: Full
- **CORS**: Enabled

## Security Benefits

### 1. Attack Prevention
- **XSS Protection**: Content Security Policy and XSS headers
- **CSRF Protection**: Same-origin policies and CORS restrictions
- **Clickjacking Protection**: Frame options and embedder policies
- **MIME Sniffing**: Content type enforcement
- **SQL Injection**: Input sanitization and validation
- **Script Injection**: Pattern removal and CSP enforcement

### 2. Data Protection
- **Authentication Required**: All sensitive operations require valid signatures
- **Rate Limiting**: Prevents abuse and DoS attacks
- **Input Validation**: Ensures data integrity and security
- **Request Size Limits**: Prevents large payload attacks
- **Cache Control**: Prevents sensitive data exposure

### 3. Network Security
- **HTTPS Enforcement**: HSTS headers for production
- **Origin Restrictions**: CORS policies limit cross-origin access
- **Cross-Origin Isolation**: Prevents side-channel attacks
- **Referrer Control**: Limits information leakage

## Implementation Notes

### 1. Middleware Order
The security middleware is applied in the correct order to ensure proper protection:
1. Security headers and CORS
2. Rate limiting
3. Authentication
4. Input validation
5. API handler

### 2. Error Handling
All security middleware includes proper error handling:
- Authentication failures return 401
- Rate limit exceeded returns 429
- Invalid input returns 400
- Security violations are logged

### 3. Performance Considerations
- Security headers are set at the Next.js level for optimal performance
- Rate limiting uses in-memory storage for speed
- Input validation is lightweight and efficient
- CORS preflight requests are handled efficiently

## Monitoring and Logging

### 1. Security Events
All security-related events are logged:
- Authentication attempts (success/failure)
- Rate limit violations
- Input validation failures
- CORS violations
- Request size violations

### 2. Audit Trail
- All API requests are logged with user context
- Security violations are tracked and reported
- Rate limiting events are monitored
- Authentication failures are flagged

## Future Enhancements

### 1. Additional Security Measures
- IP-based rate limiting
- Advanced threat detection
- Security event correlation
- Automated security response

### 2. Monitoring Improvements
- Real-time security dashboard
- Alert system for security events
- Performance impact monitoring
- Security metrics collection

## Compliance and Standards

This implementation follows:
- **OWASP Top 10** security guidelines
- **OWASP ASVS** (Application Security Verification Standard)
- **NIST Cybersecurity Framework** recommendations
- **Web Security Best Practices** from major browsers
- **Ethereum Security Best Practices** for blockchain applications

## Conclusion

The implemented security measures provide comprehensive protection for the DefiMon application while maintaining performance and usability. The layered approach ensures that multiple security controls work together to prevent various types of attacks and vulnerabilities.
