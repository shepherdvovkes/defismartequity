/**
 * Wallet Service Interface
 * Defines the contract for wallet service implementations
 */

export class IWalletService {
  constructor() {
    if (this.constructor === IWalletService) {
      throw new Error('IWalletService is an abstract class and cannot be instantiated');
    }
  }

  // Connection methods
  async connect() {
    throw new Error('connect method must be implemented');
  }

  async disconnect() {
    throw new Error('disconnect method must be implemented');
  }

  async isConnected() {
    throw new Error('isConnected method must be implemented');
  }

  // Account methods
  async getAccount() {
    throw new Error('getAccount method must be implemented');
  }

  async getAccounts() {
    throw new Error('getAccounts method must be implemented');
  }

  async requestAccounts() {
    throw new Error('requestAccounts method must be implemented');
  }

  // Network methods
  async getNetwork() {
    throw new Error('getNetwork method must be implemented');
  }

  async switchNetwork(chainId) {
    throw new Error('switchNetwork method must be implemented');
  }

  async addNetwork(networkConfig) {
    throw new Error('addNetwork method must be implemented');
  }

  // Transaction methods
  async sendTransaction(transaction) {
    throw new Error('sendTransaction method must be implemented');
  }

  async signTransaction(transaction) {
    throw new Error('signTransaction method must be implemented');
  }

  async signMessage(message) {
    throw new Error('signMessage method must be implemented');
  }

  // Contract interaction methods
  async callContract(contractAddress, abi, method, params) {
    throw new Error('callContract method must be implemented');
  }

  async sendContractTransaction(contractAddress, abi, method, params, options) {
    throw new Error('sendContractTransaction method must be implemented');
  }

  // Balance methods
  async getBalance(address) {
    throw new Error('getBalance method must be implemented');
  }

  async getTokenBalance(tokenAddress, address) {
    throw new Error('getTokenBalance method must be implemented');
  }

  // Event methods
  async on(event, callback) {
    throw new Error('on method must be implemented');
  }

  async off(event, callback) {
    throw new Error('off method must be implemented');
  }

  // Utility methods
  async getProvider() {
    throw new Error('getProvider method must be implemented');
  }

  async getSigner() {
    throw new Error('getSigner method must be implemented');
  }

  async getContract(contractAddress, abi) {
    throw new Error('getContract method must be implemented');
  }
}
