// Interface for contract services
export class IContractService {
  async initialize(contractAddresses) {
    throw new Error('Method not implemented');
  }
  
  async getContractInfo() {
    throw new Error('Method not implemented');
  }
  
  async getTokenInfo() {
    throw new Error('Method not implemented');
  }
  
  async getInvestorInfo(address) {
    throw new Error('Method not implemented');
  }
  
  async invest(amount) {
    throw new Error('Method not implemented');
  }
}
