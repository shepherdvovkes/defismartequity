import { INetworkService } from '../interfaces/INetworkService';

export class NetworkService extends INetworkService {
  constructor() {
    super();
    this.sepoliaConfig = {
      chainId: '0xaa36a7', // 11155111 in hex
      chainName: 'Sepolia Test Network',
      rpcUrls: ['https://rpc.sepolia.org'],
      blockExplorerUrls: ['https://sepolia.etherscan.io/'],
      nativeCurrency: {
        name: 'SepoliaETH',
        symbol: 'SEP',
        decimals: 18,
      },
    };
  }

  async checkNetwork() {
    if (typeof window === 'undefined' || !window.ethereum) {
      return false;
    }

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      return chainId === this.sepoliaConfig.chainId;
    } catch (error) {
      console.error('Network check error:', error);
      return false;
    }
  }

  async addNetwork(networkConfig) {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask not available');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [networkConfig],
      });
    } catch (error) {
      console.error('Add network error:', error);
      throw new Error('Failed to add network');
    }
  }

  async switchToNetwork(chainId) {
    if (typeof window === 'undefined' || !window.ethereum) {
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
        // Network doesn't exist, add it
        await this.addNetwork(this.sepoliaConfig);
        return true;
      }
      throw error;
    }
  }

  async ensureSepoliaNetwork() {
    try {
      const isCorrectNetwork = await this.checkNetwork();
      
      if (!isCorrectNetwork) {
        await this.switchToNetwork(this.sepoliaConfig.chainId);
        // Wait a bit for the network switch
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await this.checkNetwork();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to ensure Sepolia network:', error);
      return false;
    }
  }

  getSepoliaConfig() {
    return this.sepoliaConfig;
  }
}
