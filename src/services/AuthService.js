/**
 * Authentication Service
 * Provides secure authentication for frontend components
 * Prevents authentication bypass vulnerabilities
 */

import { ethers } from 'ethers';

export class AuthService {
  constructor(provider) {
    this.provider = provider;
    this.isAuthenticated = false;
    this.userAddress = null;
    this.authToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Generate authentication challenge
   * @param {string} address - User's Ethereum address
   * @returns {Object} - Challenge message and timestamp
   */
  generateChallenge(address) {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(36).substring(2, 15);
    
    const message = `DEFIMON Authentication Challenge\n\nAddress: ${address}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;
    
    return {
      message,
      timestamp,
      nonce
    };
  }

  /**
   * Sign authentication challenge
   * @param {string} message - Challenge message to sign
   * @returns {Promise<string>} - Signature
   */
  async signChallenge(message) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const signer = this.provider.getSigner();
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error) {
      throw new Error(`Failed to sign challenge: ${error.message}`);
    }
  }

  /**
   * Authenticate user with signature
   * @param {string} address - User's Ethereum address
   * @param {string} signature - Signed challenge
   * @param {number} timestamp - Challenge timestamp
   * @returns {Promise<boolean>} - Authentication success
   */
  async authenticate(address, signature, timestamp) {
    try {
      // Verify signature locally first
      const challenge = this.generateChallenge(address);
      const recoveredAddress = ethers.utils.verifyMessage(challenge.message, signature);
      
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Invalid signature');
      }

      // Verify timestamp is recent
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - timestamp > 300) { // 5 minutes
        throw new Error('Challenge expired');
      }

      // Store authentication data
      this.isAuthenticated = true;
      this.userAddress = address;
      this.authToken = signature;
      this.tokenExpiry = timestamp + 300; // 5 minutes

      // Store in localStorage for persistence
      localStorage.setItem('defimon_auth', JSON.stringify({
        address,
        signature,
        timestamp,
        expiry: this.tokenExpiry
      }));

      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      this.isAuthenticated = false;
      this.userAddress = null;
      this.authToken = null;
      this.tokenExpiry = null;
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} - Authentication status
   */
  isUserAuthenticated() {
    if (!this.isAuthenticated || !this.authToken || !this.tokenExpiry) {
      return false;
    }

    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime > this.tokenExpiry) {
      this.logout();
      return false;
    }

    return true;
  }

  /**
   * Get authentication headers for API requests
   * @returns {Object} - Headers object
   */
  getAuthHeaders() {
    if (!this.isUserAuthenticated()) {
      throw new Error('User not authenticated');
    }

    return {
      'x-auth-address': this.userAddress,
      'x-auth-signature': this.authToken,
      'x-auth-timestamp': this.tokenExpiry - 300 // Original timestamp
    };
  }

  /**
   * Refresh authentication token
   * @returns {Promise<boolean>} - Refresh success
   */
  async refreshAuth() {
    if (!this.userAddress || !this.provider) {
      return false;
    }

    try {
      const challenge = this.generateChallenge(this.userAddress);
      const signature = await this.signChallenge(challenge.message);
      
      return await this.authenticate(this.userAddress, signature, challenge.timestamp);
    } catch (error) {
      console.error('Failed to refresh authentication:', error);
      return false;
    }
  }

  /**
   * Logout user
   */
  logout() {
    this.isAuthenticated = false;
    this.userAddress = null;
    this.authToken = null;
    this.tokenExpiry = null;
    
    // Clear localStorage
    localStorage.removeItem('defimon_auth');
  }

  /**
   * Restore authentication from localStorage
   * @returns {boolean} - Restoration success
   */
  restoreAuth() {
    try {
      const authData = localStorage.getItem('defimon_auth');
      if (!authData) {
        return false;
      }

      const { address, signature, timestamp, expiry } = JSON.parse(authData);
      const currentTime = Math.floor(Date.now() / 1000);

      // Check if token is still valid
      if (currentTime > expiry) {
        localStorage.removeItem('defimon_auth');
        return false;
      }

      // Restore authentication state
      this.isAuthenticated = true;
      this.userAddress = address;
      this.authToken = signature;
      this.tokenExpiry = expiry;

      return true;
    } catch (error) {
      console.error('Failed to restore authentication:', error);
      localStorage.removeItem('defimon_auth');
      return false;
    }
  }

  /**
   * Get current user address
   * @returns {string|null} - User address
   */
  getCurrentUser() {
    return this.userAddress;
  }

  /**
   * Check if authentication is about to expire
   * @param {number} warningThreshold - Seconds before expiry to warn
   * @returns {boolean} - True if expiring soon
   */
  isExpiringSoon(warningThreshold = 60) {
    if (!this.tokenExpiry) {
      return false;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return (this.tokenExpiry - currentTime) <= warningThreshold;
  }
}
