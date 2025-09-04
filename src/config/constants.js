// Network configuration
export const NETWORK_CONFIG = {
  SEPOLIA: {
    chainId: '0xaa36a7', // 11155111 in hex
    chainName: 'Sepolia Test Network',
    rpcUrls: ['https://rpc.sepolia.org'],
    blockExplorerUrls: ['https://sepolia.etherscan.io/'],
    nativeCurrency: {
      name: 'SepoliaETH',
      symbol: 'SEP',
      decimals: 18,
    },
  }
};

// Contract configuration
export const CONTRACT_CONFIG = {
  EXCHANGE_RATE: 100, // 1 ETH = 100 DEFI tokens
  MIN_ETH_BALANCE: 0.01, // Minimum ETH required for gas
  TOKEN_DECIMALS: 18,
};

// Error messages
export const ERROR_MESSAGES = {
  METAMASK_NOT_INSTALLED: 'MetaMask is not installed. Please install MetaMask to continue.',
  NO_ACCOUNTS: 'No accounts available',
  INSUFFICIENT_BALANCE: 'Insufficient ETH for gas. Minimum 0.01 ETH required.',
  WRONG_NETWORK: 'Wrong network! Please switch to Sepolia Testnet in MetaMask.',
  CONTRACTS_NOT_DEPLOYED: 'Contracts not deployed. Deploy smart contracts first.',
  USER_REJECTED: 'Transaction rejected by user.',
  INSUFFICIENT_FUNDS: 'Insufficient ETH for investment. Get test ETH from Sepolia Faucet.',
  INSUFFICIENT_TOKENS: 'Insufficient tokens in contract.',
};

// Success messages
export const SUCCESS_MESSAGES = {
  WALLET_CONNECTED: 'Wallet connected successfully',
  INVESTMENT_SENT: 'Transaction sent. Waiting for confirmation...',
  INVESTMENT_SUCCESS: 'Investment successful!',
};

// Local storage keys
export const STORAGE_KEYS = {
  DEPLOYED_CONTRACTS: 'deployedContracts',
  WALLET_CONNECTION: 'walletConnection',
};

// API endpoints
export const API_ENDPOINTS = {
  CONTRACTS: '/api/contracts',
  INVESTMENTS: '/api/investments',
  STATS: '/api/stats',
  TRANSACTIONS: '/api/transactions',
};

// UI constants
export const UI_CONFIG = {
  LOADING_DELAY: 1000, // ms
  MAX_DECIMALS: 6,
  MIN_DECIMALS: 2,
  REFRESH_INTERVAL: 30000, // 30 seconds
};
