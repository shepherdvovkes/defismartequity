/**
 * Security Middleware
 * Implements comprehensive security headers and protection measures
 * Protects against common web vulnerabilities and attacks
 */

import { NextResponse } from 'next/server';

/**
 * Security headers middleware for Next.js
 * Implements OWASP security recommendations
 */
export function withSecurityHeaders(handler) {
  return async (req, res) => {
    // Set comprehensive security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    
    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.ethers.io https://unpkg.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://sepolia.infura.io https://api.etherscan.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
    
    res.setHeader('Content-Security-Policy', csp);
    
    // HSTS header for HTTPS
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Cache control for sensitive endpoints
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    return handler(req, res);
  };
}

/**
 * Input validation and sanitization middleware
 */
export function withInputValidation(handler) {
  return async (req, res) => {
    try {
      // Validate request method
      const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
      if (!allowedMethods.includes(req.method)) {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      
      // Validate content type for POST/PUT requests
      if ((req.method === 'POST' || req.method === 'PUT') && req.headers['content-type'] !== 'application/json') {
        return res.status(400).json({ error: 'Content-Type must be application/json' });
      }
      
      // Sanitize query parameters
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            // Remove potential script injection
            req.query[key] = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            // Remove potential SQL injection patterns
            req.query[key] = value.replace(/['";\\]/g, '');
          }
        }
      }
      
      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        for (const [key, value] of Object.entries(req.body)) {
          if (typeof value === 'string') {
            // Remove potential script injection
            req.body[key] = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            // Remove potential SQL injection patterns
            req.body[key] = value.replace(/['";\\]/g, '');
          }
        }
      }
      
      return handler(req, res);
    } catch (error) {
      console.error('Input validation error:', error);
      return res.status(400).json({ error: 'Invalid input data' });
    }
  };
}

/**
 * CORS protection middleware
 */
export function withCORS(handler) {
  return async (req, res) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://defismart.vercel.app',
      'https://defismart.com'
    ];
    
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-address, x-auth-signature, x-auth-timestamp');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    return handler(req, res);
  };
}

/**
 * Request size limiting middleware
 */
export function withRequestSizeLimit(maxSize = '1mb') {
  return (handler) => {
    return async (req, res) => {
      const contentLength = parseInt(req.headers['content-length'] || '0');
      const maxSizeBytes = parseSize(maxSize);
      
      if (contentLength > maxSizeBytes) {
        return res.status(413).json({ error: 'Request entity too large' });
      }
      
      return handler(req, res);
    };
  };
}

/**
 * Parse size string to bytes
 */
function parseSize(size) {
  const units = { 'b': 1, 'kb': 1024, 'mb': 1024 * 1024, 'gb': 1024 * 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+)([kmg]?b)$/);
  
  if (!match) return 1024 * 1024; // Default to 1MB
  
  const [, number, unit] = match;
  return parseInt(number) * (units[unit] || 1);
}

/**
 * Comprehensive security middleware that combines all protections
 */
export function withFullSecurity(handler, options = {}) {
  const {
    maxRequestSize = '1mb',
    enableCORS = true,
    enableInputValidation = true
  } = options;
  
  let wrappedHandler = handler;
  
  if (enableInputValidation) {
    wrappedHandler = withInputValidation(wrappedHandler);
  }
  
  wrappedHandler = withRequestSizeLimit(maxRequestSize)(wrappedHandler);
  wrappedHandler = withSecurityHeaders(wrappedHandler);
  
  if (enableCORS) {
    wrappedHandler = withCORS(wrappedHandler);
  }
  
  return wrappedHandler;
}
