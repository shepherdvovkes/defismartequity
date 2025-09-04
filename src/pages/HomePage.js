import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useWallet } from '../contexts/WalletContext';
import WalletStatus from '../components/WalletStatus';
import TokenDisplay from '../components/TokenDisplay';
import NetworkStatus from '../components/NetworkStatus';
import MetaMaskInstructions from '../components/MetaMaskInstructions';
import InvestmentForm from '../components/InvestmentForm';
import ContractStats from '../components/ContractStats';
import InvestorInfo from '../components/InvestorInfo';
import TokenInfo from '../components/TokenInfo';

export default function HomePage() {
  const { 
    isConnected, 
    account, 
    contractAddresses, 
    loading, 
    error, 
    refreshData,
    web3Service
  } = useWallet();
  
  const [investorInfo, setInvestorInfo] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [investmentLoading, setInvestmentLoading] = useState(false);
  const [investmentError, setInvestmentError] = useState('');
  const [investmentSuccess, setInvestmentSuccess] = useState('');

  // Load contract data
  const loadContractData = useCallback(async () => {
    if (!isConnected || !web3Service || !web3Service.hasValidContracts()) return;

    try {
      const [investor, contract, token] = await Promise.all([
        web3Service.getInvestorInfo(account),
        web3Service.getContractInfo(),
        web3Service.getTokenInfo()
      ]);

      setInvestorInfo(investor);
      setContractInfo(contract);
      setTokenInfo(token);
    } catch (error) {
      console.log('Could not load contract data:', error.message);
      setInvestorInfo(null);
      setContractInfo(null);
      setTokenInfo(null);
    }
  }, [isConnected, web3Service, account]);

  // Load data when state changes
  useEffect(() => {
    loadContractData();
  }, [loadContractData]);

  // Handle investment
  const handleInvestment = async (amount) => {
    if (!web3Service || !web3Service.hasValidContracts()) {
      setInvestmentError('Contracts not deployed. Deploy smart contracts first.');
      return;
    }

    try {
      setInvestmentLoading(true);
      setInvestmentError('');
      setInvestmentSuccess('');

      // Check network before investing
      const network = await web3Service.getNetwork();
      if (!network.includes('Sepolia')) {
        throw new Error('Wrong network! Please switch to Sepolia Testnet in MetaMask.');
      }

      const tx = await web3Service.invest(amount);
      setInvestmentSuccess(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);

      // Wait for transaction confirmation
      await tx.wait();
      setInvestmentSuccess(`Investment successful! Received ${parseFloat(amount) * 100} DEFI tokens.`);

      // Refresh data
      await loadContractData();
      await refreshData();
      setInvestmentAmount('');
    } catch (error) {
      console.error('Investment error:', error);
      
      let errorMessage = error.message;
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for investment. Get test ETH from Sepolia Faucet.';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user.';
      } else if (error.message.includes('Insufficient tokens')) {
        errorMessage = 'Insufficient tokens in contract.';
      }
      
      setInvestmentError(`Investment error: ${errorMessage}`);
    } finally {
      setInvestmentLoading(false);
    }
  };

  return (
    <div>
      <Head>
        <title>DEFIMON - Investment Platform</title>
        <meta name="description" content="Invest in DEFIMON project and receive tokens" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container">
        <div className="header">
          <h1>DEFIMON Investment Platform</h1>
          <p>Invest in the future of DeFi with rate 1 ETH = 100 DEFI tokens</p>
        </div>

        {investmentError && <div className="error">{investmentError}</div>}
        {investmentSuccess && <div className="success">{investmentSuccess}</div>}

        {/* Wallet Status Component */}
        <WalletStatus />

        {isConnected && (
          <>
            <NetworkStatus />
            <TokenDisplay />
            <MetaMaskInstructions 
              tokenInfo={{
                name: 'Defimon Token',
                symbol: 'DEFI',
                address: contractAddresses?.defimonToken || '0x0000000000000000000000000000000000000000',
                decimals: 18
              }}
              isDemoMode={!web3Service?.hasValidContracts()}
            />
          </>
        )}

        {/* Contract Statistics */}
        {contractInfo && (
          <ContractStats contractInfo={contractInfo} />
        )}

        {/* Investment Section */}
        {isConnected && (
          <InvestmentForm 
            hasValidContracts={web3Service?.hasValidContracts()}
            onInvestment={handleInvestment}
            loading={investmentLoading}
            amount={investmentAmount}
            onAmountChange={setInvestmentAmount}
          />
        )}

        {/* Investor Information */}
        {isConnected && investorInfo && investorInfo.exists && (
          <InvestorInfo investorInfo={investorInfo} />
        )}

        {/* Token Information */}
        {tokenInfo && (
          <TokenInfo tokenInfo={tokenInfo} />
        )}

        {/* Instructions */}
        <div className="investment-section">
          <h2 className="section-title">Instructions</h2>
          
          <div className="info-card">
            <h3>Deploy Smart Contracts</h3>
            <p>Need to deploy the smart contracts to Sepolia? Use our web-based deployment interface.</p>
            <Link href="/deploy" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '10px' }}>
              Deploy Contracts
            </Link>
            <Link href="/test" className="btn btn-secondary" style={{ display: 'inline-block', marginTop: '10px', marginLeft: '10px' }}>
              Test Contracts
            </Link>
            <Link href="/dashboard" className="btn btn-secondary" style={{ display: 'inline-block', marginTop: '10px', marginLeft: '10px' }}>
              Database Dashboard
            </Link>
          </div>
          
          <div className="info-card">
            <h3>How to start investing</h3>
            <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>Install MetaMask extension in your browser</li>
              <li>Create a wallet or import existing one</li>
              <li>Switch to Sepolia Testnet network</li>
              <li>Get test ETH from Sepolia Faucet</li>
              <li>Connect wallet to the platform</li>
              <li>Enter investment amount and click "Invest"</li>
            </ol>
          </div>
          
          <div className="info-card">
            <h3>Useful links</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
              <li><a href="https://sepoliafaucet.com/" target="_blank" rel="noopener noreferrer">Sepolia Faucet - get test ETH</a></li>
              <li><a href="https://sepolia.etherscan.io/" target="_blank" rel="noopener noreferrer">Sepolia Etherscan - view transactions</a></li>
              <li><a href="https://metamask.io/" target="_blank" rel="noopener noreferrer">MetaMask - install wallet</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
