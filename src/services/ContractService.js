import { IContractService } from '../interfaces/IContractService';

export class ContractService extends IContractService {
  constructor(signer) {
    super();
    this.signer = signer;
    this.defimonToken = null;
    this.defimonInvestment = null;
    this.contractAddresses = null;
  }

  // Contract ABIs
  static get DEFIMON_TOKEN_ABI() {
    return [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address owner) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function transferFrom(address from, address to, uint256 amount) returns (bool)",
      "function transferTokens(address to, uint256 amount)",
      "function burnTokens(uint256 amount)",
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    ];
  }

  static get DEFIMON_INVESTMENT_ABI() {
    return [
      "function EXCHANGE_RATE() view returns (uint256)",
      "function defimonToken() view returns (address)",
      "function signer1() view returns (address)",
      "function signer2() view returns (address)",
      "function invest() payable",
      "function requestWithdrawal(address to, uint256 amount) returns (bytes32)",
      "function approveWithdrawal(bytes32 requestId)",
      "function updateSigner(address newSigner, uint8 signerIndex)",
      "function getInvestorInfo(address investor) view returns (uint256 totalInvested, uint256 totalTokens, bool exists)",
      "function getInvestorCount() view returns (uint256)",
      "function getInvestorByIndex(uint256 index) view returns (address)",
      "function getContractBalance() view returns (uint256)",
      "function getTokenBalance() view returns (uint256)",
      "function withdrawalRequests(bytes32) view returns (address to, uint256 amount, bool approvedBySigner1, bool approvedBySigner2, bool executed, uint256 timestamp)",
      "function pause()",
      "function unpause()",
      "event InvestmentMade(address indexed investor, uint256 ethAmount, uint256 tokenAmount)",
      "event WithdrawalRequested(bytes32 indexed requestId, address to, uint256 amount)",
      "event WithdrawalApproved(bytes32 indexed requestId, address signer)",
      "event WithdrawalExecuted(bytes32 indexed requestId, address to, uint256 amount)",
      "event SignerUpdated(address indexed oldSigner, address indexed newSigner, uint8 signerIndex)"
    ];
  }

  async initialize(contractAddresses) {
    if (!contractAddresses || !contractAddresses.defimonToken || !contractAddresses.defimonInvestment) {
      throw new Error('Invalid contract addresses');
    }

    if (!this.signer) {
      throw new Error('Signer not initialized');
    }

    this.contractAddresses = contractAddresses;

    const { ethers } = await import('ethers');

    this.defimonToken = new ethers.Contract(
      contractAddresses.defimonToken,
      ContractService.DEFIMON_TOKEN_ABI,
      this.signer
    );

    this.defimonInvestment = new ethers.Contract(
      contractAddresses.defimonInvestment,
      ContractService.DEFIMON_INVESTMENT_ABI,
      this.signer
    );
  }

  async getContractInfo() {
    if (!this.defimonInvestment) {
      throw new Error('Investment contract not initialized');
    }

    try {
      const [exchangeRate, contractBalance, tokenBalance, investorCount] = await Promise.all([
        this.defimonInvestment.EXCHANGE_RATE(),
        this.defimonInvestment.getContractBalance(),
        this.defimonInvestment.getTokenBalance(),
        this.defimonInvestment.getInvestorCount()
      ]);

      const { ethers } = await import('ethers');

      return {
        exchangeRate: exchangeRate.toString(),
        contractBalance: ethers.utils.formatEther(contractBalance),
        tokenBalance: ethers.utils.formatEther(tokenBalance),
        investorCount: investorCount.toString()
      };
    } catch (error) {
      throw new Error(`Error getting contract info: ${error.message}`);
    }
  }

  async getTokenInfo() {
    if (!this.defimonToken) {
      throw new Error('Token contract not initialized');
    }

    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        this.defimonToken.name(),
        this.defimonToken.symbol(),
        this.defimonToken.decimals(),
        this.defimonToken.totalSupply()
      ]);

      const { ethers } = await import('ethers');

      return {
        name,
        symbol,
        decimals: decimals.toString(),
        totalSupply: ethers.utils.formatEther(totalSupply)
      };
    } catch (error) {
      throw new Error(`Error getting token info: ${error.message}`);
    }
  }

  async getInvestorInfo(address) {
    if (!this.defimonInvestment) {
      throw new Error('Investment contract not initialized');
    }

    try {
      const info = await this.defimonInvestment.getInvestorInfo(address);
      const { ethers } = await import('ethers');

      return {
        totalInvested: ethers.utils.formatEther(info.totalInvested),
        totalTokens: ethers.utils.formatEther(info.totalTokens),
        exists: info.exists
      };
    } catch (error) {
      throw new Error(`Error getting investor info: ${error.message}`);
    }
  }

  async invest(amount) {
    if (!this.defimonInvestment) {
      throw new Error('Investment contract not initialized');
    }

    try {
      const { ethers } = await import('ethers');
      const weiAmount = ethers.utils.parseEther(amount.toString());
      const tx = await this.defimonInvestment.invest({ value: weiAmount });
      return tx;
    } catch (error) {
      throw new Error(`Investment error: ${error.message}`);
    }
  }

  isInitialized() {
    return this.defimonToken !== null && this.defimonInvestment !== null;
  }

  getContractAddresses() {
    return this.contractAddresses;
  }
}
