export class ContractAddressService {
  constructor() {
    this.contractAddresses = null;
  }

  async loadFromLocalStorage() {
    try {
      if (typeof window === 'undefined') {
        return null;
      }

      const deployedContracts = localStorage.getItem('deployedContracts');
      if (deployedContracts) {
        const contracts = JSON.parse(deployedContracts);
        if (this.validateContractAddresses(contracts)) {
          this.contractAddresses = contracts;
          return contracts;
        }
      }
      return null;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return null;
    }
  }

  async loadFromAPI() {
    try {
      const response = await fetch('/api/contracts');
      if (!response.ok) {
        return null;
      }

      const contracts = await response.json();
      
      if (contracts.length > 0) {
        const tokenContract = contracts.find(c => c.contract_name === 'DefimonToken');
        const investmentContract = contracts.find(c => c.contract_name === 'DefimonInvestment');
        
        if (tokenContract && investmentContract) {
          const contractAddresses = {
            defimonToken: tokenContract.contract_address,
            defimonInvestment: investmentContract.contract_address,
            deployer: tokenContract.deployer_address,
            signer1: tokenContract.signer1_address,
            signer2: tokenContract.signer2_address,
            network: tokenContract.network,
            deploymentTime: tokenContract.deployment_time
          };
          
          if (this.validateContractAddresses(contractAddresses)) {
            this.contractAddresses = contractAddresses;
            this.saveToLocalStorage(contractAddresses);
            return contractAddresses;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error loading from API:', error);
      return null;
    }
  }

  async loadContractAddresses() {
    // Try localStorage first, then API
    let contracts = await this.loadFromLocalStorage();
    
    if (!contracts) {
      contracts = await this.loadFromAPI();
    }
    
    return contracts;
  }

  saveToLocalStorage(contractAddresses) {
    if (typeof window !== 'undefined' && contractAddresses) {
      localStorage.setItem('deployedContracts', JSON.stringify(contractAddresses));
    }
  }

  validateContractAddresses(contracts) {
    if (!contracts) return false;
    
    const requiredFields = ['defimonToken', 'defimonInvestment'];
    const hasRequiredFields = requiredFields.every(field => 
      contracts[field] && 
      contracts[field] !== '0x0000000000000000000000000000000000000000'
    );
    
    return hasRequiredFields;
  }

  getContractAddresses() {
    return this.contractAddresses;
  }

  setContractAddresses(contracts) {
    if (this.validateContractAddresses(contracts)) {
      this.contractAddresses = contracts;
      this.saveToLocalStorage(contracts);
    }
  }

  hasValidContracts() {
    return this.contractAddresses !== null && this.validateContractAddresses(this.contractAddresses);
  }

  clearContractAddresses() {
    this.contractAddresses = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('deployedContracts');
    }
  }
}
