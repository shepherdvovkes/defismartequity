import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function TestPage() {
  const [account, setAccount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [ethersLoaded, setEthersLoaded] = useState(false);
  const [contracts, setContracts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [investmentAmount, setInvestmentAmount] = useState('0.01');
  const [contractStats, setContractStats] = useState({});

  // Function to get period name from period number
  const getPeriodName = (period) => {
    switch(period) {
      case 1: return 'MVP (x10)';
      case 2: return 'Release (x5)';
      case 3: return 'Standard (x1)';
      default: return 'Unknown';
    }
  };

  useEffect(() => {
    // Load saved contracts from localStorage
    const savedContracts = localStorage.getItem('deployedContracts');
    if (savedContracts) {
      setContracts(JSON.parse(savedContracts));
    }

    // Load ethers.js
    if (typeof window !== 'undefined' && !window.ethers) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js';
      script.onload = () => {
        setEthersLoaded(true);
        fetchContractArtifacts();
      };
      script.onerror = () => {
        setError('Failed to load ethers library. Please refresh the page.');
      };
      document.head.appendChild(script);
    } else if (window.ethers) {
      setEthersLoaded(true);
      fetchContractArtifacts();
    }
  }, []);

  const fetchContractArtifacts = async () => {
    try {
      const [tokenResponse, investmentResponse] = await Promise.all([
        fetch('/api/contract-artifacts?contract=DefimonToken'),
        fetch('/api/contract-artifacts?contract=DefimonInvestment')
      ]);

      const tokenArtifact = await tokenResponse.json();
      const investmentArtifact = await investmentResponse.json();

      setContracts(prev => ({
        ...prev,
        tokenArtifact,
        investmentArtifact
      }));
    } catch (err) {
      setError('Failed to fetch contract artifacts');
    }
  };

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];
        setAccount(account);
        setIsConnected(true);
        setError('');
      } else {
        setError('MetaMask is not installed');
      }
    } catch (err) {
      setError('Failed to connect wallet');
    }
  };

  const getContractStats = async () => {
    if (!contracts.investmentAddress || !contracts.investmentArtifact) return;

    try {
      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      const investmentContract = new window.ethers.Contract(
        contracts.investmentAddress,
        contracts.investmentArtifact.abi,
        signer
      );

      const stats = await investmentContract.getContractStats();
      setContractStats({
        totalInvestments: stats.totalInvestments.toString(),
        totalTokensDistributed: stats.totalTokensDistributed.toString(),
        totalInvestors: stats.totalInvestors.toString(),
        contractBalance: stats.contractBalance.toString(),
        tokenBalance: stats.tokenBalance.toString(),
        currentCoefficient: stats.currentCoefficient.toString(),
        currentPeriod: stats.currentPeriod.toString()
      });

      // Get signers information
      try {
        const [signer1, signer2, signer3] = await investmentContract.getSigners();
        setContractStats(prev => ({
          ...prev,
          signer1: signer1,
          signer2: signer2,
          signer3: signer3
        }));
      } catch (signerErr) {
        console.log('Could not get signers info:', signerErr.message);
      }
    } catch (err) {
      setError('Failed to get contract stats: ' + err.message);
    }
  };

  const invest = async () => {
    if (!contracts.investmentAddress || !contracts.investmentArtifact) {
      setError('Contracts not loaded');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      const investmentContract = new window.ethers.Contract(
        contracts.investmentAddress,
        contracts.investmentArtifact.abi,
        signer
      );

      const amountInWei = window.ethers.utils.parseEther(investmentAmount);
      
      const tx = await investmentContract.invest({ value: amountInWei });
      await tx.wait();

      setSuccess(`Investment successful! Transaction: ${tx.hash}`);
      setInvestmentAmount('0.01');
      
      // Save investment to database
      try {
        await fetch('/api/investments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            txHash: tx.hash,
            investorAddress: account,
            contractAddress: contracts.investmentAddress,
            ethAmount: parseFloat(investmentAmount),
            tokenAmount: parseFloat(investmentAmount) * 100, // Base rate, coefficient will be applied by contract
            status: 'completed'
          })
        });

        // Save transaction to database
        await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            txHash: tx.hash,
            contractAddress: contracts.investmentAddress,
            functionName: 'invest',
            fromAddress: account,
            valueWei: window.ethers.utils.parseEther(investmentAmount).toString(),
            valueEth: parseFloat(investmentAmount),
            status: 'completed'
          })
        });

        console.log('Investment data saved to database');
      } catch (dbError) {
        console.error('Failed to save to database:', dbError);
        // Don't fail the investment if database save fails
      }
      
      // Refresh stats
      setTimeout(getContractStats, 2000);
    } catch (err) {
      setError('Investment failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const testWithdrawal = async () => {
    if (!contracts.investmentAddress || !contracts.investmentArtifact) {
      setError('Contracts not loaded');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      const investmentContract = new window.ethers.Contract(
        contracts.investmentAddress,
        contracts.investmentArtifact.abi,
        signer
      );

      // Test withdrawal request (only owner can do this)
      const amount = window.ethers.utils.parseEther('0.001'); // Small amount for testing
      const tx = await investmentContract.requestWithdrawal(account, amount);
      await tx.wait();

      setSuccess(`Withdrawal request created! Transaction: ${tx.hash}`);
      
      // Refresh stats
      setTimeout(getContractStats, 2000);
    } catch (err) {
      setError('Withdrawal request failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const approveWithdrawal = async () => {
    if (!contracts.investmentAddress || !contracts.investmentArtifact) {
      setError('Contracts not loaded');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      const investmentContract = new window.ethers.Contract(
        contracts.investmentAddress,
        contracts.investmentArtifact.abi,
        signer
      );

      // For testing, we'll need a valid request ID
      // In a real scenario, you'd get this from the withdrawal request
      setError('To test approval, you need a valid withdrawal request ID. Create a withdrawal request first.');
      setLoading(false);
      return;
    } catch (err) {
      setError('Approval failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getInvestorInfo = async () => {
    if (!contracts.investmentAddress || !contracts.investmentArtifact) {
      setError('Contracts not loaded');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      console.log('Contract Address:', contracts.investmentAddress);
      console.log('Contract ABI:', contracts.investmentArtifact.abi);
      
      const investmentContract = new window.ethers.Contract(
        contracts.investmentAddress,
        contracts.investmentArtifact.abi,
        signer
      );

      // First, let's check if the contract exists and has the right function
      const code = await provider.getCode(contracts.investmentAddress);
      if (code === '0x') {
        setError('No contract found at this address. Please check the contract address.');
        return;
      }

      // Check if the function exists in the ABI
      const hasFunction = contracts.investmentArtifact.abi.some(item => 
        item.name === 'getInvestorInfo' && item.type === 'function'
      );
      
      if (!hasFunction) {
        setError('Contract ABI does not contain getInvestorInfo function. Please check if this is the correct contract.');
        return;
      }

      const investorInfo = await investmentContract.getInvestorInfo(account);
      
      setSuccess(`Investor Info: Total Invested: ${window.ethers.utils.formatEther(investorInfo.totalInvested)} ETH, Total Tokens: ${investorInfo.totalTokens.toString()}`);
      
    } catch (err) {
      console.error('Full error:', err);
      if (err.code === 'CALL_EXCEPTION') {
        setError('Contract call failed. This usually means: 1) Wrong contract address, 2) Contract not deployed, 3) Function does not exist. Please verify the contract address.');
      } else {
        setError('Failed to get investor info: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkContractAddresses = async () => {
    if (!contracts.tokenAddress || !contracts.investmentAddress) {
      setError('Please enter contract addresses first');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      
      console.log('Checking contract addresses...');
      console.log('Token Address:', contracts.tokenAddress);
      console.log('Investment Address:', contracts.investmentAddress);
      
      // Check if contracts exist at the addresses
      const tokenCode = await provider.getCode(contracts.tokenAddress);
      const investmentCode = await provider.getCode(contracts.investmentAddress);
      
      let result = 'Contract Address Check Results:\n\n';
      
      if (tokenCode === '0x') {
        result += '❌ Token Contract: NO CONTRACT FOUND\n';
      } else {
        result += '✅ Token Contract: CONTRACT EXISTS\n';
      }
      
      if (investmentCode === '0x') {
        result += '❌ Investment Contract: NO CONTRACT FOUND\n';
      } else {
        result += '✅ Investment Contract: CONTRACT EXISTS\n';
      }
      
      if (tokenCode !== '0x' && investmentCode !== '0x') {
        result += '\nBoth contracts exist! You can now validate them.';
        setSuccess(result);
      } else {
        setError(result);
      }
      
    } catch (err) {
      console.error('Address check error:', err);
      setError('Failed to check contract addresses: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateContracts = async () => {
    if (!contracts.tokenAddress || !contracts.investmentAddress || !contracts.investmentArtifact) {
      setError('Please set contract addresses first');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      console.log('Validating contracts...');
      console.log('Token Address:', contracts.tokenAddress);
      console.log('Investment Address:', contracts.investmentAddress);
      
      // Check if contracts exist at the addresses
      const tokenCode = await provider.getCode(contracts.tokenAddress);
      const investmentCode = await provider.getCode(contracts.investmentAddress);
      
      if (tokenCode === '0x') {
        setError('No contract found at token address. Please check the token contract address.');
        return;
      }
      
      if (investmentCode === '0x') {
        setError('No contract found at investment address. Please check the investment contract address.');
        return;
      }
      
      console.log('Contracts exist at addresses');
      
      // Test investment contract
      const investmentContract = new window.ethers.Contract(
        contracts.investmentAddress,
        contracts.investmentArtifact.abi,
        signer
      );

      // Check if the contract has the expected functions
      const hasGetContractStats = contracts.investmentArtifact.abi.some(item => 
        item.name === 'getContractStats' && item.type === 'function'
      );
      
      if (!hasGetContractStats) {
        setError('Investment contract ABI does not contain getContractStats function. This might not be the right contract.');
        return;
      }

      // Try to call a simple view function
      const stats = await investmentContract.getContractStats();
      console.log('Contract stats:', stats);
      
      setSuccess('✅ Contracts validated successfully! You can now test the functionality.');
      
      // Save to localStorage for future use
      const contractData = {
        tokenAddress: contracts.tokenAddress,
        investmentAddress: contracts.investmentAddress,
        tokenArtifact: contracts.tokenArtifact,
        investmentArtifact: contracts.investmentArtifact
      };
      localStorage.setItem('deployedContracts', JSON.stringify(contractData));
      
    } catch (err) {
      console.error('Validation error:', err);
      if (err.code === 'CALL_EXCEPTION') {
        setError('Contract validation failed: Function call reverted. This usually means: 1) Wrong contract address, 2) Contract not properly deployed, 3) Function signature mismatch. Please verify the contract addresses.');
      } else {
        setError('Contract validation failed: ' + err.message + '. Please check the addresses and ensure contracts are deployed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <Head>
        <title>Test Contracts - DEFIMON</title>
        <meta name="description" content="Test DEFIMON investment and withdrawal functionality" />
      </Head>

      <div className="header">
        <h1>Test Smart Contracts</h1>
        <p>Test investment and withdrawal functionality on deployed contracts</p>
        <div style={{ marginTop: '20px' }}>
          <Link href="/deploy" className="btn btn-secondary" style={{ marginRight: '10px' }}>
            Deploy Contracts
          </Link>
          <Link href="/" className="btn btn-secondary">
            Back to Home
          </Link>
        </div>
      </div>

      {!isConnected ? (
        <div className="wallet-section">
          <h2 className="section-title">Connect Wallet</h2>
          <button className="btn btn-primary" onClick={connectWallet}>
            Connect MetaMask
          </button>
          <p style={{ marginTop: '15px', color: '#6c757d' }}>
            Connect your MetaMask wallet to test contracts
          </p>
        </div>
      ) : (
        <div className="connected-section">
          <div className="info-card">
            <h3>Connected Wallet</h3>
            <p><strong>Address:</strong> {account}</p>
            <p><strong>Network:</strong> Sepolia Testnet</p>
          </div>

          {contracts.investmentAddress ? (
            <div className="contracts-section">
              <h2 className="section-title">Deployed Contracts</h2>
              <div className="info-card">
                <p><strong>Token Contract:</strong> {contracts.tokenAddress || 'Not deployed'}</p>
                <p><strong>Investment Contract:</strong> {contracts.investmentAddress}</p>
              </div>

              <div className="stats-section">
                <h3>Contract Statistics</h3>
                <button className="btn btn-secondary" onClick={getContractStats}>
                  Refresh Stats
                </button>
                {Object.keys(contractStats).length > 0 && (
                  <div className="stats-grid">
                    <div className="stat-item">
                      <strong>Total Investments:</strong> {contractStats.totalInvestments}
                    </div>
                    <div className="stat-item">
                      <strong>Tokens Distributed:</strong> {contractStats.totalTokensDistributed}
                    </div>
                    <div className="stat-item">
                      <strong>Total Investors:</strong> {contractStats.totalInvestors}
                    </div>
                    <div className="stat-item">
                      <strong>Contract Balance:</strong> {window.ethers ? window.ethers.utils.formatEther(contractStats.contractBalance) + ' ETH' : 'Loading...'}
                    </div>
                    <div className="stat-item">
                      <strong>Token Balance:</strong> {contractStats.tokenBalance}
                    </div>
                    <div className="stat-item">
                      <strong>Current Coefficient:</strong> x{contractStats.currentCoefficient || '1'}
                    </div>
                    <div className="stat-item">
                      <strong>Investment Period:</strong> {getPeriodName(contractStats.currentPeriod)}
                    </div>
                    {contractStats.signer1 && (
                      <>
                        <div className="stat-item">
                          <strong>Signer 1:</strong> {contractStats.signer1}
                        </div>
                        <div className="stat-item">
                          <strong>Signer 2:</strong> {contractStats.signer2}
                        </div>
                        <div className="stat-item">
                          <strong>Signer 3:</strong> {contractStats.signer3}
                        </div>
                        <div className="stat-item" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '10px', background: '#e8f5e8', borderRadius: '8px', border: '2px solid #4caf50' }}>
                          <strong>Multi-Signature System: 2 out of 3 approval required</strong>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="info-card">
                <h3>Investment Coefficients</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
                  <div style={{ padding: '15px', background: '#e3f2fd', borderRadius: '8px', border: '2px solid #2196f3' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>MVP Period (x10)</h4>
                    <p style={{ margin: '0', fontSize: '14px' }}>Until November 1, 2025</p>
                    <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>1 ETH = 1,000 DEFI tokens</p>
                  </div>
                  <div style={{ padding: '15px', background: '#fff3e0', borderRadius: '8px', border: '2px solid #ff9800' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#f57c00' }}>Release Period (x5)</h4>
                    <p style={{ margin: '0', fontSize: '14px' }}>November 1 - February 1, 2026</p>
                    <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>1 ETH = 500 DEFI tokens</p>
                  </div>
                  <div style={{ padding: '15px', background: '#f3e5f5', borderRadius: '8px', border: '2px solid #9c27b0' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#7b1fa2' }}>Standard Period (x1)</h4>
                    <p style={{ margin: '0', fontSize: '14px' }}>After February 1, 2026</p>
                    <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>1 ETH = 100 DEFI tokens</p>
                  </div>
                </div>
              </div>

              <div className="testing-section">
                <h3>Test Investment</h3>
                <div className="input-group">
                  <label>Investment Amount (ETH):</label>
                  <input
                    type="number"
                    value={investmentAmount}
                    onChange={(e) => setInvestmentAmount(e.target.value)}
                    min="0.001"
                    step="0.001"
                    placeholder="0.01"
                  />
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={invest}
                  disabled={loading || !ethersLoaded}
                >
                  {loading ? 'Investing...' : 'Invest ETH'}
                </button>
                <p className="info-text">
                  Current coefficient: x{contractStats.currentCoefficient || '1'} | 
                  You will receive {100 * (contractStats.currentCoefficient || 1)} DEFI tokens per 1 ETH invested
                </p>

                <h3>Test Withdrawal Request</h3>
                <button 
                  className="btn btn-secondary" 
                  onClick={testWithdrawal}
                  disabled={loading || !ethersLoaded}
                >
                  {loading ? 'Creating Request...' : 'Create Withdrawal Request'}
                </button>
                <p className="info-text">
                  Test withdrawal request functionality (only contract owner can create requests)
                </p>

                <h3>Test Withdrawal Approval</h3>
                <button 
                  className="btn btn-secondary" 
                  onClick={approveWithdrawal}
                  disabled={loading || !ethersLoaded}
                >
                  {loading ? 'Approving...' : 'Approve Withdrawal'}
                </button>
                <p className="info-text">
                  Test withdrawal approval (requires signer authorization)
                </p>

                <h3>Get Investor Information</h3>
                <button 
                  className="btn btn-secondary" 
                  onClick={getInvestorInfo}
                  disabled={loading || !ethersLoaded}
                >
                  {loading ? 'Loading...' : 'Get My Info'}
                </button>
                <p className="info-text">
                  Get your investment information and token balance
                </p>
              </div>
            </div>
          ) : (
            <div className="contracts-section">
              <h2 className="section-title">Contract Addresses</h2>
              <div className="info-card">
                <h3>Manual Contract Setup</h3>
                <p>If contracts are not automatically detected, please enter the deployed contract addresses manually:</p>
                <p><strong>💡 Tip:</strong> You can find these addresses on the deployment page after successful deployment, or check your MetaMask transaction history.</p>
                
                <div className="input-group">
                  <label>Token Contract Address:</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={contracts.tokenAddress || ''}
                    onChange={(e) => setContracts(prev => ({ ...prev, tokenAddress: e.target.value }))}
                  />
                </div>
                
                <div className="input-group">
                  <label>Investment Contract Address:</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={contracts.investmentAddress || ''}
                    onChange={(e) => setContracts(prev => ({ ...prev, investmentAddress: e.target.value }))}
                  />
                </div>
                
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    if (contracts.tokenAddress && contracts.investmentAddress) {
                      setSuccess('Contract addresses set! You can now test the contracts.');
                    } else {
                      setError('Please enter both contract addresses.');
                    }
                  }}
                >
                  Set Contract Addresses
                </button>
                
                <button 
                  className="btn btn-secondary" 
                  onClick={validateContracts}
                  style={{ marginLeft: '10px' }}
                >
                  Validate Contracts
                </button>
                
                <button 
                  className="btn btn-secondary" 
                  onClick={checkContractAddresses}
                  style={{ marginLeft: '10px' }}
                >
                  Check Addresses
                </button>
              </div>
            </div>
          )}

          {!contracts.investmentAddress && (
            <div className="info-card">
              <h3>No Contracts Deployed</h3>
              <p>Please deploy contracts first using the deployment page.</p>
              <Link href="/deploy" className="btn btn-primary">Go to Deployment</Link>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          <strong>Success:</strong> {success}
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .header h1 {
          color: #1a1a1a;
          margin-bottom: 10px;
        }
        .section-title {
          color: #333;
          border-bottom: 2px solid #007AFF;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .info-card {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          margin: 5px;
          text-decoration: none;
          display: inline-block;
        }
        .btn-primary {
          background: #007AFF;
          color: white;
        }
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .input-group {
          margin-bottom: 15px;
        }
        .input-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        .input-group input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        .stat-item {
          background: white;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #e9ecef;
        }
        .info-text {
          color: #6c757d;
          font-size: 14px;
          margin-top: 10px;
        }
        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 6px;
          margin: 20px 0;
          border: 1px solid #f5c6cb;
        }
        .success-message {
          background: #d4edda;
          color: #155724;
          padding: 15px;
          border-radius: 6px;
          margin: 20px 0;
          border: 1px solid #c3e6cb;
        }
      `}</style>
    </div>
  );
}
