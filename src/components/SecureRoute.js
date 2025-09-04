import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../contexts/WalletContext';
import { AuthService } from '../services/AuthService';

/**
 * 🔒 SecureRoute Component
 * Wraps sensitive pages to ensure only authenticated users can access them
 * SECURITY: Enhanced with server-side authentication validation
 * 
 * Usage:
 * <SecureRoute>
 *   <YourProtectedComponent />
 * </SecureRoute>
 */

export default function SecureRoute({ children, redirectTo = '/', requireConnection = true, requireAuth = true }) {
  const router = useRouter();
  const { isConnected, loading: walletLoading, account, provider } = useWallet();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authService, setAuthService] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Initialize authentication service
    if (provider && !authService) {
      const service = new AuthService(provider);
      setAuthService(service);
      
      // Try to restore authentication from localStorage
      if (service.restoreAuth()) {
        setIsAuthorized(true);
      }
    }
  }, [provider, authService]);

  useEffect(() => {
    // Wait for wallet and auth service to finish loading
    if (walletLoading || !authService) {
      return;
    }

    // Check if user is authorized
    if (requireConnection && !isConnected) {
      // Redirect unauthorized users
      router.push(redirectTo);
      return;
    }

    // Check authentication if required
    if (requireAuth && isConnected && account) {
      if (!authService.isUserAuthenticated()) {
        // User needs to authenticate
        handleAuthentication();
        return;
      }
    }

    // User is authorized
    setIsAuthorized(true);
    setAuthLoading(false);
  }, [isConnected, walletLoading, requireConnection, requireAuth, account, authService, router, redirectTo]);

  const handleAuthentication = async () => {
    if (!authService || !account) {
      return;
    }

    try {
      setAuthLoading(true);
      
      // Generate authentication challenge
      const challenge = authService.generateChallenge(account);
      
      // Request signature from user
      const signature = await authService.signChallenge(challenge.message);
      
      // Authenticate user
      await authService.authenticate(account, signature, challenge.timestamp);
      
      setIsAuthorized(true);
      setAuthLoading(false);
      
    } catch (error) {
      console.error('Authentication failed:', error);
      setAuthLoading(false);
      
      // Redirect to home page if authentication fails
      router.push('/');
    }
  };

  // Show loading while checking authentication
  if (walletLoading || authLoading) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner"></div>
        <p>🔒 Verifying authentication...</p>
        <style jsx>{`
          .auth-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 300px;
            text-align: center;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #007AFF;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show unauthorized message if user is not connected
  if (requireConnection && !isConnected) {
    return (
      <div className="unauthorized-access">
        <div className="security-icon">🔒</div>
        <h1>Access Denied</h1>
        <p>You must connect your wallet to access this page.</p>
        <button 
          onClick={() => router.push(redirectTo)}
          className="btn btn-primary"
        >
          Connect Wallet
        </button>
        <style jsx>{`
          .unauthorized-access {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            text-align: center;
            padding: 40px 20px;
          }
          .security-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            color: #721c24;
            margin-bottom: 15px;
          }
          p {
            color: #6c757d;
            margin-bottom: 30px;
            font-size: 18px;
          }
          .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            background: #007AFF;
            color: white;
            text-decoration: none;
          }
          .btn:hover {
            background: #0056b3;
          }
        `}</style>
      </div>
    );
  }

  // Show authentication required message
  if (requireAuth && isConnected && !isAuthorized) {
    return (
      <div className="auth-required">
        <div className="security-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
            <circle cx="12" cy="16" r="1"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h1>Authentication Required</h1>
        <p>Please sign the authentication message to access this page.</p>
        <button 
          onClick={handleAuthentication}
          className="btn btn-primary"
          disabled={authLoading}
        >
          {authLoading ? 'Authenticating...' : 'Authenticate'}
        </button>
        <style jsx>{`
          .auth-required {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            text-align: center;
            padding: 40px 20px;
          }
          .security-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            color: #721c24;
            margin-bottom: 15px;
          }
          p {
            color: #6c757d;
            margin-bottom: 30px;
            font-size: 18px;
          }
          .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            background: #007AFF;
            color: white;
            text-decoration: none;
          }
          .btn:hover:not(:disabled) {
            background: #0056b3;
          }
          .btn:disabled {
            background: #6c757d;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    );
  }

  // User is authorized, render the protected content
  return (
    <div className="secure-route">
      {children}
      <style jsx>{`
        .secure-route {
          position: relative;
        }
      `}</style>
    </div>
  );
}

/**
 * 🔒 Higher-Order Component for protecting pages
 * Usage: export default withSecureRoute(YourPageComponent)
 */
export function withSecureRoute(Component, options = {}) {
  return function SecurePage(props) {
    return (
      <SecureRoute {...options}>
        <Component {...props} />
      </SecureRoute>
    );
  };
}
