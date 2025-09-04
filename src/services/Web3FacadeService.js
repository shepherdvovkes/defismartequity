import { MetaMaskWalletService } from './MetaMaskWalletService';
import { NetworkService } from './NetworkService';
import { BalanceService } from './BalanceService';
import { ContractService } from './ContractService';
import { ContractAddressService } from './ContractAddressService';

export class Web3FacadeService {
  constructor() {
    this.walletService = new MetaMaskWalletService();
    this.networkService = new NetworkService();
    this.balanceService = null;
    this.contractService = null;
    this.contractAddressService = new ContractAddressService();
    
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Load contract addresses first
      await this.contractAddressService.loadContractAddresses();
      
      this.isInitialized = true;
      console.log('Web3FacadeService initialized');
    } catch (error) {
      console.error('Failed to initialize Web3FacadeService:', error);
      throw error;
    }
  }

  async connectWallet() {
    try {
      // Connect wallet first
      const account = await this.walletService.connect();
      
      // Ensure correct network
      const networkOk = await this.networkService.ensureSepoliaNetwork();
      if (!networkOk) {
        throw new Error('Failed to switch to Sepolia network');
      }
      
      // Initialize balance service with provider
      const provider = this.walletService.getProvider();
      this.balanceService = new BalanceService(provider);
      
      // Initialize contract service with signer
      const signer = this.walletService.getSigner();
      this.contractService = new ContractService(signer);
      
      // Initialize contracts if addresses are available
      const contractAddresses = this.contractAddressService.getContractAddresses();
      if (contractAddresses) {
        await this.contractService.initialize(contractAddresses);
      }
      
      return account;
    } catch (error) {
      console.error('Wallet connection error:', error);
      throw error;
    }
  }

  async disconnectWallet() {
    try {
      await this.walletService.disconnect();
      this.balanceService = null;
      this.contractService = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('Wallet disconnection error:', error);
      throw error;
    }
  }

  // Wallet methods
  isWalletConnected() {
    return this.walletService.isConnected();
  }

  async getCurrentAccount() {
    return await this.walletService.getCurrentAccount();
  }

  async getNetwork() {
    return await this.walletService.getNetwork();
  }

  // Balance methods
  async getEthBalance(address) {
    if (!this.balanceService) {
      throw new Error('Balance service not initialized. Connect wallet first.');
    }
    return await this.balanceService.getEthBalance(address);
  }

  async getTokenBalance(address) {
    if (!this.balanceService) {
      throw new Error('Balance service not initialized. Connect wallet first.');
    }
    return await this.balanceService.getTokenBalance(address);
  }

  async checkMinimumBalance(address, minimumAmount = 0.01) {
    if (!this.balanceService) {
      throw new Error('Balance service not initialized. Connect wallet first.');
    }
    return await this.balanceService.checkMinimumBalance(address, minimumAmount);
  }

  // Contract methods
  async getContractInfo() {
    if (!this.contractService) {
      throw new Error('Contract service not initialized. Connect wallet first.');
    }
    return await this.contractService.getContractInfo();
  }

  async getTokenInfo() {
    if (!this.contractService) {
      throw new Error('Contract service not initialized. Connect wallet first.');
    }
    return await this.contractService.getTokenInfo();
  }

  async getInvestorInfo(address) {
    if (!this.contractService) {
      throw new Error('Contract service not initialized. Connect wallet first.');
    }
    return await this.contractService.getInvestorInfo(address);
  }

  async invest(amount) {
    if (!this.contractService) {
      throw new Error('Contract service not initialized. Connect wallet first.');
    }
    return await this.contractService.invest(amount);
  }

  // Contract address methods
  getContractAddresses() {
    return this.contractAddressService.getContractAddresses();
  }

  hasValidContracts() {
    return this.contractAddressService.hasValidContracts();
  }

  // Network methods
  async switchToSepolia() {
    return await this.networkService.switchToNetwork(this.networkService.getSepoliaConfig().chainId);
  }

  // Utility methods
  isServiceInitialized() {
    return this.isInitialized;
  }

  getWalletService() {
    return this.walletService;
  }

  getNetworkService() {
    return this.networkService;
  }

  getBalanceService() {
    return this.balanceService;
  }

  getContractService() {
    return this.contractService;
  }

  getContractAddressService() {
    return this.contractAddressService;
  }
}
