/**
 * 🔒 Authentication Middleware
 * Provides server-side authentication validation for API endpoints
 * Prevents authentication bypass vulnerabilities
 */

import { ethers } from 'ethers';

/**
 * Verify Ethereum signature for authentication
 * @param {string} message - Original message that was signed
 * @param {string} signature - Ethereum signature
 * @param {string} address - Ethereum address that should have signed
 * @returns {boolean} - True if signature is valid
 */
export function verifySignature(message, signature, address) {
  try {
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Generate authentication challenge message
 * @param {string} address - User's Ethereum address
 * @param {number} timestamp - Current timestamp
 * @returns {string} - Challenge message to sign
 */
export function generateChallengeMessage(address, timestamp) {
  return `DEFIMON Authentication Challenge\n\nAddress: ${address}\nTimestamp: ${timestamp}\nNonce: ${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Authentication middleware for API routes
 * @param {Function} handler - API route handler
 * @returns {Function} - Wrapped handler with authentication
 */
export function withAuth(handler) {
  return async (req, res) => {
    try {
      // Check if request has required authentication headers
      const { 'x-auth-address': address, 'x-auth-signature': signature, 'x-auth-timestamp': timestamp } = req.headers;
      
      if (!address || !signature || !timestamp) {
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Missing authentication headers'
        });
      }
      
      // Verify timestamp is recent (within 5 minutes)
      const currentTime = Math.floor(Date.now() / 1000);
      const requestTime = parseInt(timestamp);
      
      if (currentTime - requestTime > 300) { // 5 minutes
        return res.status(401).json({ 
          error: 'Authentication expired',
          message: 'Request timestamp is too old'
        });
      }
      
      // Generate challenge message
      const challengeMessage = generateChallengeMessage(address, timestamp);
      
      // Verify signature
      if (!verifySignature(challengeMessage, signature, address)) {
        return res.status(401).json({ 
          error: 'Invalid signature',
          message: 'Authentication signature verification failed'
        });
      }
      
      // Add authenticated user info to request
      req.user = { address, timestamp };
      
      // Proceed with the original handler
      return handler(req, res);
      
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return res.status(500).json({ 
        error: 'Authentication error',
        message: 'Internal server error during authentication'
      });
    }
  };
}

/**
 * Optional authentication middleware
 * @param {Function} handler - API route handler
 * @returns {Function} - Wrapped handler with optional authentication
 */
export function withOptionalAuth(handler) {
  return async (req, res) => {
    try {
      const { 'x-auth-address': address, 'x-auth-signature': signature, 'x-auth-timestamp': timestamp } = req.headers;
      
      if (address && signature && timestamp) {
        // Verify authentication if provided
        const currentTime = Math.floor(Date.now() / 1000);
        const requestTime = parseInt(timestamp);
        
        if (currentTime - requestTime <= 300) {
          const challengeMessage = generateChallengeMessage(address, timestamp);
          
          if (verifySignature(challengeMessage, signature, address)) {
            req.user = { address, timestamp };
          }
        }
      }
      
      // Proceed with the original handler (with or without authentication)
      return handler(req, res);
      
    } catch (error) {
      console.error('Optional authentication middleware error:', error);
      // Continue without authentication on error
      return handler(req, res);
    }
  };
}

/**
 * Rate limiting middleware
 * @param {Object} options - Rate limiting options
 * @returns {Function} - Rate limiting middleware
 */
export function withRateLimit(options = {}) {
  const { maxRequests = 100, windowMs = 15 * 60 * 1000 } = options; // 15 minutes default
  
  const requestCounts = new Map();
  
  return (handler) => {
    return async (req, res) => {
      const clientId = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      
      // Clean old entries
      if (requestCounts.has(clientId)) {
        const { count, resetTime } = requestCounts.get(clientId);
        if (now > resetTime) {
          requestCounts.delete(clientId);
        }
      }
      
      // Check rate limit
      if (requestCounts.has(clientId)) {
        const { count, resetTime } = requestCounts.get(clientId);
        if (count >= maxRequests) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Too many requests. Try again after ${new Date(resetTime).toISOString()}`
          });
        }
        requestCounts.set(clientId, { count: count + 1, resetTime });
      } else {
        requestCounts.set(clientId, { count: 1, resetTime: now + windowMs });
      }
      
      return handler(req, res);
    };
  };
}
