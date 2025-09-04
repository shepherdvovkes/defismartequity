#!/usr/bin/env node

/**
 * Security Headers Test Script
 * Tests the implementation of security headers and API protection
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

console.log('🔒 Testing Security Headers Implementation');
console.log('==========================================\n');

// Test security headers on main page
async function testMainPageSecurity() {
  console.log('1. Testing Main Page Security Headers...');
  
  try {
    const response = await makeRequest(`${BASE_URL}/`);
    
    console.log('   ✅ Response Status:', response.statusCode);
    
    // Check required security headers
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options', 
      'x-xss-protection',
      'referrer-policy',
      'permissions-policy',
      'cross-origin-embedder-policy',
      'cross-origin-opener-policy',
      'cross-origin-resource-policy',
      'strict-transport-security'
    ];
    
    let headersFound = 0;
    requiredHeaders.forEach(header => {
      if (response.headers[header]) {
        console.log(`   ✅ ${header}: ${response.headers[header]}`);
        headersFound++;
      } else {
        console.log(`   ❌ ${header}: Missing`);
      }
    });
    
    console.log(`   📊 Security Headers: ${headersFound}/${requiredHeaders.length} found\n`);
    
  } catch (error) {
    console.log(`   ❌ Error testing main page: ${error.message}\n`);
  }
}

// Test API endpoint security
async function testAPIEndpointSecurity() {
  console.log('2. Testing API Endpoint Security...');
  
  const endpoints = [
    '/api/investments',
    '/api/contracts', 
    '/api/transactions',
    '/api/stats'
  ];
  
  for (const endpoint of endpoints) {
    console.log(`   Testing ${endpoint}...`);
    
    try {
      const response = await makeRequest(`${BASE_URL}${endpoint}`);
      
      // Should return 401 (Unauthorized) due to missing auth headers
      if (response.statusCode === 401) {
        console.log(`   ✅ ${endpoint}: Properly protected (401 Unauthorized)`);
      } else {
        console.log(`   ⚠️  ${endpoint}: Unexpected status ${response.statusCode}`);
      }
      
      // Check cache control headers for API endpoints
      if (response.headers['cache-control']) {
        console.log(`   ✅ Cache-Control: ${response.headers['cache-control']}`);
      } else {
        console.log(`   ❌ Cache-Control: Missing`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error testing ${endpoint}: ${error.message}`);
    }
  }
  
  console.log('');
}

// Test CORS headers
async function testCORSSecurity() {
  console.log('3. Testing CORS Security...');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/investments`, {
      'Origin': 'https://malicious-site.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type'
    });
    
    // Check if CORS is properly restricted
    if (response.headers['access-control-allow-origin']) {
      const allowedOrigin = response.headers['access-control-allow-origin'];
      if (allowedOrigin === 'https://malicious-site.com') {
        console.log('   ❌ CORS: Malicious origin allowed');
      } else {
        console.log(`   ✅ CORS: Origin restricted to ${allowedOrigin}`);
      }
    } else {
      console.log('   ✅ CORS: No origin allowed (properly restricted)');
    }
    
  } catch (error) {
    console.log(`   ❌ Error testing CORS: ${error.message}`);
  }
  
  console.log('');
}

// Test rate limiting
async function testRateLimiting() {
  console.log('4. Testing Rate Limiting...');
  
  try {
    // Make multiple requests to trigger rate limiting
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(makeRequest(`${BASE_URL}/api/investments`));
    }
    
    const responses = await Promise.all(requests);
    
    // Check if any requests were rate limited
    const rateLimited = responses.some(r => r.statusCode === 429);
    
    if (rateLimited) {
      console.log('   ✅ Rate Limiting: Working (some requests blocked)');
    } else {
      console.log('   ⚠️  Rate Limiting: May not be working (no 429 responses)');
    }
    
  } catch (error) {
    console.log(`   ❌ Error testing rate limiting: ${error.message}`);
  }
  
  console.log('');
}

// Test input validation
async function testInputValidation() {
  console.log('5. Testing Input Validation...');
  
  try {
    // Test with potentially malicious input
    const maliciousInput = {
      address: "<script>alert('xss')</script>",
      query: "'; DROP TABLE users; --"
    };
    
    const response = await makeRequest(`${BASE_URL}/api/investments?address=${encodeURIComponent(maliciousInput.address)}`);
    
    if (response.statusCode === 400) {
      console.log('   ✅ Input Validation: Malicious input blocked (400 Bad Request)');
    } else if (response.statusCode === 401) {
      console.log('   ✅ Input Validation: Request blocked before validation (401 Unauthorized)');
    } else {
      console.log(`   ⚠️  Input Validation: Unexpected response ${response.statusCode}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error testing input validation: ${error.message}`);
  }
  
  console.log('');
}

// Helper function to make HTTP requests
function makeRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Security-Test-Script/1.0',
        ...headers
      }
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Main test execution
async function runSecurityTests() {
  try {
    await testMainPageSecurity();
    await testAPIEndpointSecurity();
    await testCORSSecurity();
    await testRateLimiting();
    await testInputValidation();
    
    console.log('🔒 Security Testing Complete!');
    console.log('==========================================');
    console.log('Review the results above to ensure all security measures are working properly.');
    
  } catch (error) {
    console.error('❌ Security testing failed:', error.message);
    process.exit(1);
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  runSecurityTests();
}

module.exports = {
  testMainPageSecurity,
  testAPIEndpointSecurity,
  testCORSSecurity,
  testRateLimiting,
  testInputValidation
};
