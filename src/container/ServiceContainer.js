import { MetaMaskWalletService } from '../services/MetaMaskWalletService';
import { NetworkService } from '../services/NetworkService';
import { BalanceService } from '../services/BalanceService';
import { ContractService } from '../services/ContractService';
import { ContractAddressService } from '../services/ContractAddressService';
import { Web3FacadeService } from '../services/Web3FacadeService';

class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  // Register a service with optional factory function
  register(serviceName, factory, isSingleton = true) {
    this.services.set(serviceName, { factory, isSingleton });
  }

  // Get a service instance
  get(serviceName) {
    const serviceConfig = this.services.get(serviceName);
    
    if (!serviceConfig) {
      throw new Error(`Service '${serviceName}' not registered`);
    }

    if (serviceConfig.isSingleton) {
      // Return existing singleton instance
      if (this.singletons.has(serviceName)) {
        return this.singletons.get(serviceName);
      }

      // Create new singleton instance
      const instance = serviceConfig.factory();
      this.singletons.set(serviceName, instance);
      return instance;
    } else {
      // Create new instance each time
      return serviceConfig.factory();
    }
  }

  // Check if service is registered
  has(serviceName) {
    return this.services.has(serviceName);
  }

  // Clear all services
  clear() {
    this.services.clear();
    this.singletons.clear();
  }

  // Clear specific service
  clearService(serviceName) {
    this.services.delete(serviceName);
    this.singletons.delete(serviceName);
  }
}

// Create and configure the service container
export const serviceContainer = new ServiceContainer();

// Register all services
serviceContainer.register('walletService', () => new MetaMaskWalletService());
serviceContainer.register('networkService', () => new NetworkService());
serviceContainer.register('contractAddressService', () => new ContractAddressService());
serviceContainer.register('web3FacadeService', () => new Web3FacadeService());

// Register factory services (these need dependencies)
serviceContainer.register('balanceService', (provider) => new BalanceService(provider), false);
serviceContainer.register('contractService', (signer) => new ContractService(signer), false);

export default serviceContainer;
