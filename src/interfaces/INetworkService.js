// Interface for network services
export class INetworkService {
  async checkNetwork() {
    throw new Error('Method not implemented');
  }
  
  async addNetwork(networkConfig) {
    throw new Error('Method not implemented');
  }
  
  async switchToNetwork(chainId) {
    throw new Error('Method not implemented');
  }
}
