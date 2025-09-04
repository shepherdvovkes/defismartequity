import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Web3FacadeService } from '../services/Web3FacadeService';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [ethBalance, setEthBalance] = useState('0');
  const [tokenBalance, setTokenBalance] = useState('0');
  const [network, setNetwork] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contractAddresses, setContractAddresses] = useState(null);
  const [isClient, setIsClient] = useState(false);

  // Initialize Web3FacadeService
  const [web3Service, setWeb3Service] = useState(null);

  // Initialize services on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const service = new Web3FacadeService();
      service.initialize().then(() => {
        setWeb3Service(service);
      }).catch((error) => {
        console.log('Could not initialize Web3FacadeService:', error.message);
      });
    }
  }, []);

  // Set client flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load account data
  const loadAccountData = useCallback(async (address) => {
    if (!address || !web3Service) return;

    try {
      // Load ETH balance
      const ethBalance = await web3Service.getEthBalance(address);
      setEthBalance(ethBalance);

      // Load network info
      const network = await web3Service.getNetwork();
      setNetwork(network);

      // Load token balance if contracts are available
      if (web3Service.hasValidContracts()) {
        try {
          const tokenBalance = await web3Service.getTokenBalance(address);
          setTokenBalance(tokenBalance);
        } catch (error) {
          console.log('Could not load token balance:', error.message);
          setTokenBalance('0');
        }
      }
    } catch (error) {
      console.log('Could not load account data:', error.message);
    }
  }, [web3Service]);

  // Load contract addresses
  const loadContractAddresses = useCallback(async () => {
    if (!web3Service) return;

    try {
      const addresses = web3Service.getContractAddresses();
      if (addresses) {
        setContractAddresses(addresses);
      }
    } catch (error) {
      console.log('Could not load contract addresses:', error.message);
    }
  }, [web3Service]);

  // Refresh data
  const refreshData = useCallback(async () => {
    if (isConnected && account && web3Service) {
      await loadAccountData(account);
    }
  }, [isConnected, account, loadAccountData, web3Service]);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (!isClient || !web3Service) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const account = await web3Service.connectWallet();
      setAccount(account);
      setIsConnected(true);

      // Load account data
      await loadAccountData(account);

      // Load contract addresses
      await loadContractAddresses();

      // Check minimum balance
      const hasMinBalance = await web3Service.checkMinimumBalance(account, 0.01);
      if (!hasMinBalance) {
        setError('Insufficient ETH for gas. Minimum 0.01 ETH required.');
      }

    } catch (error) {
      console.error('Wallet connection error:', error);
      
      let errorMessage = error.message;
      
      if (error.code === 4001) {
        errorMessage = 'Wallet connection cancelled by user';
      } else if (error.code === -32002) {
        errorMessage = 'Connection request already pending in MetaMask';
      } else if (error.message.includes('User rejected')) {
        errorMessage = 'Wallet connection cancelled by user';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isClient, web3Service, loadAccountData, loadContractAddresses]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    if (web3Service) {
      await web3Service.disconnectWallet();
    }
    
    setIsConnected(false);
    setAccount('');
    setEthBalance('0');
    setTokenBalance('0');
    setNetwork('');
    setError('');
  }, [web3Service]);

  // Switch to Sepolia network
  const switchToSepolia = useCallback(async () => {
    if (!isClient || !web3Service) {
      return;
    }

    try {
      await web3Service.switchToSepolia();
      setError('');
    } catch (error) {
      setError(`Network switch error: ${error.message}`);
    }
  }, [isClient, web3Service]);

  // Setup MetaMask event listeners
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      // Listen for account changes
      window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setAccount(accounts[0]);
          await loadAccountData(accounts[0]);
        }
      });

      // Listen for network changes
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });

      // Load contracts on initialization
      loadContractAddresses();
    }

    return () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeAllListeners();
      }
    };
  }, [loadContractAddresses, disconnectWallet, loadAccountData]);

  // Auto-connect on page load
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum && web3Service) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then(accounts => {
          if (accounts.length > 0) {
            connectWallet();
          }
        })
        .catch(() => {
          // Ignore auto-connection errors
        });
    }
  }, [connectWallet, web3Service]);

  const value = {
    isConnected,
    account,
    ethBalance,
    tokenBalance,
    network,
    loading,
    error,
    contractAddresses,
    connectWallet,
    disconnectWallet,
    refreshData,
    loadContractAddresses,
    switchToSepolia,
    web3Service
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
