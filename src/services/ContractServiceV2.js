import { IContractService } from '../interfaces/IContractService';

export class ContractServiceV2 extends IContractService {
  constructor(signer) {
    super();
    this.signer = signer;
    this.defimonTokenV2 = null;
    this.defimonInvestmentV2 = null;
    this.contractAddresses = null;
  }

  // Contract ABIs for V2
  static get DEFIMON_TOKEN_V2_ABI() {
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
      "function setBlacklist(address account, bool status)",
      "function blacklisted(address account) view returns (bool)",
      "function pause()",
      "function unpause()",
      "function paused() view returns (bool)",
      "function getTokenInfo() view returns (string tokenName, string tokenSymbol, uint8 tokenDecimals, uint256 tokenTotalSupply, uint256 maxTransferAmount)",
      "function MAX_TRANSFER_AMOUNT() view returns (uint256)",
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event TokensTransferred(address indexed from, address indexed to, uint256 amount)",
      "event TokensBurned(address indexed from, uint256 amount)",
      "event AddressBlacklisted(address indexed account, bool status)"
    ];
  }

  static get DEFIMON_INVESTMENT_V2_ABI() {
    return [
      "function BASE_EXCHANGE_RATE() view returns (uint256)",
      "function MVP_COEFFICIENT() view returns (uint256)",
      "function RELEASE_COEFFICIENT() view returns (uint256)",
      "function STANDARD_COEFFICIENT() view returns (uint256)",
      "function MVP_DEADLINE() view returns (uint256)",
      "function RELEASE_DEADLINE() view returns (uint256)",
      "function defimonToken() view returns (address)",
      "function signer1() view returns (address)",
      "function signer2() view returns (address)",
      "function signer3() view returns (address)",
      "function getCurrentCoefficient() view returns (uint256 coefficient, uint8 period)",
      "function getInvestmentPeriods() view returns (uint256 mvpDeadline, uint256 releaseDeadline, uint256 currentTime, uint256 currentCoefficient)",
      "function invest() payable",
      "function requestWithdrawal(address to, uint256 amount) returns (bytes32)",
      "function approveWithdrawal(bytes32 requestId)",
      "function updateSigner(address newSigner, uint8 signerIndex)",
      "function getInvestorInfo(address investor) view returns (uint256 totalInvested, uint256 totalTokens, uint256 investmentCount, uint256 lastInvestmentTime, bool exists)",
      "function getInvestorCount() view returns (uint256)",
      "function getInvestorByIndex(uint256 index) view returns (address)",
      "function getContractBalance() view returns (uint256)",
      "function getTokenBalance() view returns (uint256)",
      "function getContractStats() view returns (uint256 totalInvestments, uint256 totalTokensDistributed, uint256 totalInvestors, uint256 contractBalance, uint256 tokenBalance, uint256 currentCoefficient, uint8 currentPeriod)",
      "function getSigners() view returns (address signer1Address, address signer2Address, address signer3Address)",
      "function withdrawalRequests(bytes32) view returns (address to, uint256 amount, bool approvedBySigner1, bool approvedBySigner2, bool approvedBySigner3, bool executed, uint256 timestamp)",
      "function pause()",
      "function unpause()",
      "function paused() view returns (bool)",
      "event InvestmentMade(address indexed investor, uint256 ethAmount, uint256 tokenAmount, uint256 coefficient, uint256 period)",
      "event WithdrawalRequested(bytes32 indexed requestId, address to, uint256 amount)",
      "event WithdrawalApproved(bytes32 indexed requestId, address signer)",
      "event WithdrawalExecuted(bytes32 indexed requestId, address to, uint256 amount)",
      "event SignerUpdated(address indexed oldSigner, address indexed newSigner, uint8 signerIndex)"
    ];
  }

  async initialize(contractAddresses) {
    if (!contractAddresses || !contractAddresses.defimonTokenV2 || !contractAddresses.defimonInvestmentV2) {
      throw new Error('Invalid V2 contract addresses');
    }

    if (!this.signer) {
      throw new Error('Signer not initialized');
    }

    this.contractAddresses = contractAddresses;

    const { ethers } = await import('ethers');

    this.defimonTokenV2 = new ethers.Contract(
      contractAddresses.defimonTokenV2,
      ContractServiceV2.DEFIMON_TOKEN_V2_ABI,
      this.signer
    );

    this.defimonInvestmentV2 = new ethers.Contract(
      contractAddresses.defimonInvestmentV2,
      ContractServiceV2.DEFIMON_INVESTMENT_V2_ABI,
      this.signer
    );
  }

  async getContractInfo() {
    if (!this.defimonInvestmentV2) {
      throw new Error('Investment V2 contract not initialized');
    }

    try {
      const [
        baseExchangeRate,
        contractStats,
        investmentPeriods,
        signers
      ] = await Promise.all([
        this.defimonInvestmentV2.BASE_EXCHANGE_RATE(),
        this.defimonInvestmentV2.getContractStats(),
        this.defimonInvestmentV2.getInvestmentPeriods(),
        this.defimonInvestmentV2.getSigners()
      ]);

      const { ethers } = await import('ethers');

      return {
        baseExchangeRate: baseExchangeRate.toString(),
        contractBalance: ethers.utils.formatEther(contractStats.contractBalance),
        tokenBalance: ethers.utils.formatEther(contractStats.tokenBalance),
        investorCount: contractStats.totalInvestors.toString(),
        currentCoefficient: contractStats.currentCoefficient.toString(),
        currentPeriod: contractStats.currentPeriod.toString(),
        mvpDeadline: new Date(investmentPeriods.mvpDeadline * 1000).toISOString(),
        releaseDeadline: new Date(investmentPeriods.releaseDeadline * 1000).toISOString(),
        signers: {
          signer1: signers.signer1Address,
          signer2: signers.signer2Address,
          signer3: signers.signer3Address
        }
      };
    } catch (error) {
      throw new Error(`Error getting V2 contract info: ${error.message}`);
    }
  }

  async getTokenInfo() {
    if (!this.defimonTokenV2) {
      throw new Error('Token V2 contract not initialized');
    }

    try {
      const tokenInfo = await this.defimonTokenV2.getTokenInfo();
      const isPaused = await this.defimonTokenV2.paused();

      const { ethers } = await import('ethers');

      return {
        name: tokenInfo.tokenName,
        symbol: tokenInfo.tokenSymbol,
        decimals: tokenInfo.tokenDecimals.toString(),
        totalSupply: ethers.utils.formatEther(tokenInfo.tokenTotalSupply),
        maxTransferAmount: ethers.utils.formatEther(tokenInfo.maxTransferAmount),
        isPaused: isPaused
      };
    } catch (error) {
      throw new Error(`Error getting V2 token info: ${error.message}`);
    }
  }

  async getInvestorInfo(address) {
    if (!this.defimonInvestmentV2) {
      throw new Error('Investment V2 contract not initialized');
    }

    try {
      const info = await this.defimonInvestmentV2.getInvestorInfo(address);
      const { ethers } = await import('ethers');

      return {
        totalInvested: ethers.utils.formatEther(info.totalInvested),
        totalTokens: ethers.utils.formatEther(info.totalTokens),
        investmentCount: info.investmentCount.toString(),
        lastInvestmentTime: new Date(info.lastInvestmentTime * 1000).toISOString(),
        exists: info.exists
      };
    } catch (error) {
      throw new Error(`Error getting V2 investor info: ${error.message}`);
    }
  }

  async invest(amount) {
    if (!this.defimonInvestmentV2) {
      throw new Error('Investment V2 contract not initialized');
    }

    try {
      const { ethers } = await import('ethers');
      const weiAmount = ethers.utils.parseEther(amount.toString());
      const tx = await this.defimonInvestmentV2.invest({ value: weiAmount });
      return tx;
    } catch (error) {
      throw new Error(`V2 Investment error: ${error.message}`);
    }
  }

  async getCurrentCoefficient() {
    if (!this.defimonInvestmentV2) {
      throw new Error('Investment V2 contract not initialized');
    }

    try {
      const [coefficient, period] = await this.defimonInvestmentV2.getCurrentCoefficient();
      return {
        coefficient: coefficient.toString(),
        period: period.toString()
      };
    } catch (error) {
      throw new Error(`Error getting current coefficient: ${error.message}`);
    }
  }

  async checkBlacklistStatus(address) {
    if (!this.defimonTokenV2) {
      throw new Error('Token V2 contract not initialized');
    }

    try {
      const isBlacklisted = await this.defimonTokenV2.blacklisted(address);
      return isBlacklisted;
    } catch (error) {
      throw new Error(`Error checking blacklist status: ${error.message}`);
    }
  }

  async isContractPaused() {
    if (!this.defimonInvestmentV2) {
      throw new Error('Investment V2 contract not initialized');
    }

    try {
      const isPaused = await this.defimonInvestmentV2.paused();
      return isPaused;
    } catch (error) {
      throw new Error(`Error checking pause status: ${error.message}`);
    }
  }

  isInitialized() {
    return this.defimonTokenV2 !== null && this.defimonInvestmentV2 !== null;
  }

  getContractAddresses() {
    return this.contractAddresses;
  }
}
