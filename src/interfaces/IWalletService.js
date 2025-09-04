// Interface for wallet connection services
export class IWalletService {
  async connect() {
    throw new Error('Method not implemented');
  }
  
  async disconnect() {
    throw new Error('Method not implemented');
  }
  
  isConnected() {
    throw new Error('Method not implemented');
  }
  
  async getCurrentAccount() {
    throw new Error('Method not implemented');
  }
  
  async getNetwork() {
    throw new Error('Method not implemented');
  }
  
  async switchNetwork(chainId) {
    throw new Error('Method not implemented');
  }
}

// Interface for balance services
export interface IBalanceService {
  getEthBalance(address: string): Promise<string>;
  getTokenBalance(address: string): Promise<string>;
}

// Interface for contract services
export interface IContractService {
  initialize(contractAddresses: any): Promise<void>;
  getContractInfo(): Promise<any>;
  getTokenInfo(): Promise<any>;
  getInvestorInfo(address: string): Promise<any>;
  invest(amount: string): Promise<any>;
}

// Interface for network services
export interface INetworkService {
  checkNetwork(): Promise<boolean>;
  addNetwork(networkConfig: any): Promise<void>;
  switchToNetwork(chainId: string): Promise<boolean>;
}
