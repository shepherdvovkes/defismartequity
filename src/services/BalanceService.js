import { IBalanceService } from '../interfaces/IBalanceService';

export class BalanceService extends IBalanceService {
  constructor(provider) {
    super();
    this.provider = provider;
  }

  async getEthBalance(address) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const balance = await this.provider.getBalance(address);
      const { ethers } = await import('ethers');
      return ethers.utils.formatEther(balance);
    } catch (error) {
      throw new Error(`Error getting ETH balance: ${error.message}`);
    }
  }

  async getTokenBalance(address) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // This would need the token contract to be initialized
    // For now, return a placeholder
    return '0';
  }

  async checkMinimumBalance(address, minimumAmount = 0.01) {
    try {
      const balance = await this.getEthBalance(address);
      return parseFloat(balance) >= minimumAmount;
    } catch (error) {
      console.error('Balance check error:', error);
      return false;
    }
  }

  formatBalance(balance, decimals = 6) {
    return parseFloat(balance).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals
    });
  }
}
