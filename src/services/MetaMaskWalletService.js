import { IWalletService } from '../interfaces/IWalletService';

export class MetaMaskWalletService extends IWalletService {
  constructor() {
    super();
    this.provider = null;
    this.signer = null;
  }

  async connect() {
    if (typeof window === 'undefined') {
      throw new Error('Wallet connection is only available on the client side');
    }

    if (!window.ethereum) {
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts available');
      }

      // Initialize ethers provider and signer
      const { ethers } = await import('ethers');
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      this.signer = this.provider.getSigner();

      return accounts[0];
    } catch (error) {
      console.error('Wallet connection error:', error);
      throw error;
    }
  }

  async disconnect() {
    this.provider = null;
    this.signer = null;
  }

  isConnected() {
    return this.signer !== null;
  }

  async getCurrentAccount() {
    if (!this.signer) {
      return null;
    }
    return await this.signer.getAddress();
  }

  async getNetwork() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    
    const network = await this.provider.getNetwork();
    return network.name || `Chain ID: ${network.chainId}`;
  }

  async switchNetwork(chainId) {
    if (!window.ethereum) {
      throw new Error('MetaMask not available');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
      return true;
    } catch (error) {
      if (error.code === 4902) {
        throw new Error('Network not found');
      }
      throw error;
    }
  }

  getProvider() {
    return this.provider;
  }

  getSigner() {
    return this.signer;
  }
}
