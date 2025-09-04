# Security Testing Guide

## Quick Start

This guide provides instructions for testing the security headers and API protection implementation.

## Prerequisites

1. Ensure your DefiMon application is running
2. Have Node.js installed
3. Be familiar with basic command line operations

## Running Security Tests

### 1. Start Your Application

```bash
# Development mode
npm run dev

# Or production mode
npm start
```

### 2. Run Security Tests

```bash
# Test against localhost:3000 (default)
node scripts/test-security-headers.js

# Test against custom URL
TEST_URL=https://your-domain.com node scripts/test-security-headers.js
```

## What the Tests Check

### 1. Security Headers Verification
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking
- **X-XSS-Protection**: Enables XSS filtering
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts sensitive permissions
- **Cross-Origin Policies**: Enforces isolation
- **HSTS**: Enforces HTTPS

### 2. API Endpoint Protection
- Authentication requirements (401 responses)
- Rate limiting (429 responses)
- Cache control headers
- Input validation

### 3. CORS Security
- Origin restrictions
- Method restrictions
- Header restrictions

### 4. Rate Limiting
- Multiple rapid requests
- Proper blocking responses

### 5. Input Validation
- XSS payload detection
- SQL injection detection
- Malicious input blocking

## Expected Test Results

### ✅ Successful Security Implementation

```
🔒 Testing Security Headers Implementation
==========================================

1. Testing Main Page Security Headers...
   ✅ Response Status: 200
   ✅ x-content-type-options: nosniff
   ✅ x-frame-options: DENY
   ✅ x-xss-protection: 1; mode=block
   ✅ referrer-policy: strict-origin-when-cross-origin
   ✅ permissions-policy: camera=(), microphone=(), geolocation=()
   ✅ cross-origin-embedder-policy: require-corp
   ✅ cross-origin-opener-policy: same-origin
   ✅ cross-origin-resource-policy: same-origin
   ✅ strict-transport-security: max-age=31536000; includeSubDomains; preload
   📊 Security Headers: 9/9 found

2. Testing API Endpoint Security...
   Testing /api/investments...
   ✅ /api/investments: Properly protected (401 Unauthorized)
   ✅ Cache-Control: no-store, no-cache, must-revalidate, private
   Testing /api/contracts...
   ✅ /api/contracts: Properly protected (401 Unauthorized)
   ✅ Cache-Control: no-store, no-cache, must-revalidate, private
   Testing /api/transactions...
   ✅ /api/transactions: Properly protected (401 Unauthorized)
   ✅ Cache-Control: no-store, no-cache, must-revalidate, private
   Testing /api/stats...
   ✅ /api/stats: Properly protected (401 Unauthorized)
   ✅ Cache-Control: no-store, no-cache, must-revalidate, private

3. Testing CORS Security...
   ✅ CORS: Origin restricted to http://localhost:3000

4. Testing Rate Limiting...
   ✅ Rate Limiting: Working (some requests blocked)

5. Testing Input Validation...
   ✅ Input Validation: Request blocked before validation (401 Unauthorized)

🔒 Security Testing Complete!
==========================================
Review the results above to ensure all security measures are working properly.
```

### ❌ Common Issues and Fixes

#### Missing Security Headers
If security headers are missing, check:
- `next.config.js` configuration
- Middleware implementation
- Server configuration

#### API Endpoints Not Protected
If endpoints return 200 instead of 401:
- Verify middleware is properly applied
- Check authentication logic
- Ensure middleware order is correct

#### CORS Issues
If CORS is too permissive:
- Review `withCORS` middleware
- Check allowed origins configuration
- Verify preflight handling

## Manual Testing

### 1. Test Security Headers

```bash
# Check headers on main page
curl -I http://localhost:3000/

# Check headers on API endpoint
curl -I http://localhost:3000/api/investments
```

### 2. Test Authentication

```bash
# Should return 401 (Unauthorized)
curl http://localhost:3000/api/investments

# Should return 401 (Missing signature)
curl -H "x-auth-address: 0x123..." http://localhost:3000/api/investments
```

### 3. Test Rate Limiting

```bash
# Make multiple rapid requests
for i in {1..10}; do
  curl -H "x-auth-address: 0x123..." http://localhost:3000/api/investments &
done
wait
```

### 4. Test Input Validation

```bash
# Test XSS payload
curl "http://localhost:3000/api/investments?address=<script>alert('xss')</script>"

# Test SQL injection
curl "http://localhost:3000/api/investments?address='; DROP TABLE users; --"
```

## Browser Developer Tools

### 1. Check Security Headers
1. Open Developer Tools (F12)
2. Go to Network tab
3. Reload the page
4. Click on any request
5. Check Response Headers section

### 2. Test CORS
1. Open Console tab
2. Try making a cross-origin request
3. Check for CORS errors

### 3. Verify CSP
1. Check Console for CSP violations
2. Look for blocked resource warnings

## Security Scanner Tools

### 1. OWASP ZAP
```bash
# Install OWASP ZAP
# Scan your application for security vulnerabilities
```

### 2. Security Headers Check
- Visit: https://securityheaders.com
- Enter your domain
- Review security header scores

### 3. Mozilla Observatory
- Visit: https://observatory.mozilla.org
- Scan your application
- Review security recommendations

## Troubleshooting

### Common Issues

#### 1. Headers Not Applied
- Check `next.config.js` syntax
- Verify server restart after changes
- Check for middleware errors

#### 2. API Protection Not Working
- Verify middleware import order
- Check authentication logic
- Ensure proper error handling

#### 3. CORS Problems
- Review allowed origins
- Check preflight handling
- Verify header configuration

### Debug Mode

Enable debug logging in your middleware:

```javascript
// Add to security middleware
console.log('Security middleware applied:', req.url);
console.log('Headers set:', res.getHeaders());
```

## Performance Impact

### Monitoring
- Check response times
- Monitor memory usage
- Track error rates

### Optimization
- Use efficient validation
- Minimize middleware overhead
- Cache security decisions where possible

## Next Steps

After successful testing:

1. **Deploy to staging** and test again
2. **Monitor logs** for security events
3. **Set up alerts** for security violations
4. **Regular testing** as part of CI/CD
5. **Security audits** by third parties

## Support

If you encounter issues:

1. Check the console logs
2. Review middleware implementation
3. Verify configuration files
4. Test individual components
5. Consult security documentation

## Security Best Practices

1. **Regular Updates**: Keep dependencies updated
2. **Monitoring**: Monitor security events
3. **Testing**: Regular security testing
4. **Documentation**: Keep security docs current
5. **Training**: Educate team on security
