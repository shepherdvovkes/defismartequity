import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useWallet } from '../utils/walletContext';
import WalletStatus from '../components/WalletStatus';
import Link from 'next/link';

export default function Deploy() {
  const { isConnected, account, network, switchToSepolia } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contractAddresses, setContractAddresses] = useState({});
  const [contractArtifacts, setContractArtifacts] = useState({});
  const [ethersLoaded, setEthersLoaded] = useState(false);

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        setError('Please install MetaMask');
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      // setAccount(account); // This line is removed as per new_code
      // setIsConnected(true); // This line is removed as per new_code
      setSuccess('Wallet connected successfully!');
      
      // Check network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0xaa36a7') { // Sepolia chain ID
        setError('Please switch to Sepolia testnet in MetaMask');
      }
    } catch (error) {
      setError('Failed to connect wallet: ' + error.message);
    }
  };

  const fetchContractArtifacts = async () => {
    try {
      const [tokenArtifact, investmentArtifact] = await Promise.all([
        fetch('/api/contract-artifacts?contract=DefimonToken').then(res => res.json()),
        fetch('/api/contract-artifacts?contract=DefimonInvestment').then(res => res.json())
      ]);
      
      setContractArtifacts({
        token: tokenArtifact,
        investment: investmentArtifact
      });
    } catch (error) {
      setError('Failed to fetch contract artifacts: ' + error.message);
    }
  };

  const deployContracts = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!contractArtifacts.token || !contractArtifacts.investment) {
        setError('Contract artifacts not loaded. Please refresh the page.');
        return;
      }

      if (!window.ethers) {
        setError('Ethers library not loaded. Please refresh the page.');
        return;
      }

      // Check if connected to Sepolia
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0xaa36a7') { // Sepolia chain ID
        setError('Please switch to Sepolia testnet in MetaMask');
        return;
      }

      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Deploy DefimonToken
      setSuccess('Deploying DefimonToken...');
      const DefimonToken = new window.ethers.ContractFactory(
        contractArtifacts.token.abi,
        contractArtifacts.token.bytecode,
        signer
      );
      
      const defimonToken = await DefimonToken.deploy();
      await defimonToken.deployed();

      setSuccess('DefimonToken deployed! Now deploying DefimonInvestment...');

      // Deploy DefimonInvestment
      const DefimonInvestment = new window.ethers.ContractFactory(
        contractArtifacts.investment.abi,
        contractArtifacts.investment.bytecode,
        signer
      );
      
      // Create signer addresses (three different addresses)
      const signer1Address = account;
      const signer2Address = '0x2Fd2520446f49a382D03E80A95970c30F9C65Ed6'; // Your specified second signer address
      const signer3Address = '0xF66bc3f5bb2a6Db7668990Fb2A2078A5B6690A3C'; // Your specified third signer address
      
      const defimonInvestment = await DefimonInvestment.deploy(
        defimonToken.address,
        signer1Address, // signer1
        signer2Address, // signer2
        signer3Address  // signer3
      );
      await defimonInvestment.deployed();

      // Transfer tokens to investment contract
      setSuccess('Transferring tokens to investment contract...');
      const totalSupply = await defimonToken.totalSupply();
      const tokensForSale = totalSupply.div(2); // 50%
      await defimonToken.transferTokens(defimonInvestment.address, tokensForSale);

      const addresses = {
        defimonToken: defimonToken.address,
        defimonInvestment: defimonInvestment.address,
        deployer: account,
        signer1: signer1Address,
        signer2: signer2Address,
        signer3: signer3Address,
        network: 'sepolia',
        deploymentTime: new Date().toISOString()
      };

      setContractAddresses(addresses);
      setSuccess('All contracts deployed successfully!');

      // Save to localStorage
      localStorage.setItem('deployedContracts', JSON.stringify(addresses));

      // Save to database
      try {
        // Проверяем, что артефакты загружены
        if (!contractArtifacts.DefimonToken || !contractArtifacts.DefimonInvestment) {
          console.log('Contract artifacts not loaded yet, skipping database save');
          return;
        }

        // Save DefimonToken deployment
        await fetch('/api/contracts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contractName: 'DefimonToken',
            contractAddress: addresses.defimonToken,
            contractType: 'ERC20',
            network: 'sepolia',
            deployerAddress: account,
            deploymentTxHash: addresses.defimonToken, // You might want to store actual tx hash
            contractAbi: JSON.stringify(contractArtifacts.DefimonToken.abi),
            contractBytecode: contractArtifacts.DefimonToken.bytecode,
            notes: 'ERC20 token contract for DEFIMON project'
          })
        });

        // Save DefimonInvestment deployment
        await fetch('/api/contracts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contractName: 'DefimonInvestment',
            contractAddress: addresses.defimonInvestment,
            contractType: 'Investment',
            network: 'sepolia',
            deployerAddress: account,
            signer1Address: addresses.signer1,
            signer2Address: addresses.signer2,
            signer3Address: addresses.signer3,
            deploymentTxHash: addresses.defimonInvestment, // You might want to store actual tx hash
            contractAbi: JSON.stringify(contractArtifacts.DefimonInvestment.abi),
            contractBytecode: contractArtifacts.DefimonInvestment.bytecode,
            notes: 'Investment contract for DEFIMON project with multi-signature withdrawal'
          })
        });

        console.log('Contract deployments saved to database');
      } catch (dbError) {
        console.error('Failed to save to database:', dbError);
        // Don't fail the deployment if database save fails
      }

    } catch (error) {
      setError('Deployment failed: ' + error.message);
      console.error('Deployment error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load previously deployed contracts
    const saved = localStorage.getItem('deployedContracts');
    if (saved) {
      setContractAddresses(JSON.parse(saved));
    }
    
    // Load ethers library dynamically
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

  // Handle ethers loading
  const handleEthersLoad = () => {
    setEthersLoaded(true);
    fetchContractArtifacts();
  };

  return (
    <div className="container">
      <Head>
        <title>Deploy Contracts - DEFIMON</title>
        <meta name="description" content="Deploy DEFIMON smart contracts to Sepolia" />
      </Head>



              <div className="header">
          <h1>Deploy Smart Contracts</h1>
          <p>Deploy DEFIMON contracts to Sepolia testnet using MetaMask</p>
          <div style={{ marginTop: '20px' }}>
            <Link href="/test" className="btn btn-secondary" style={{ marginRight: '10px' }}>
              Test Contracts
            </Link>
            <Link href="/" className="btn btn-secondary">
              Back to Home
            </Link>
          </div>
        </div>

      {!ethersLoaded && (
        <div className="info-card">
          <p>Loading ethers library...</p>
        </div>
      )}

      {!isConnected ? (
        <div className="wallet-section">
          <h2 className="section-title">Connect Wallet</h2>
          <button className="btn btn-primary" onClick={connectWallet} disabled={!ethersLoaded}>
            Connect MetaMask
          </button>
          <p style={{ marginTop: '15px', color: '#6c757d' }}>
            Connect your MetaMask wallet to deploy contracts
          </p>
        </div>
      ) : (
        <div className="deployment-section">
          <h2 className="section-title">Deployment</h2>
          <div className="info-card">
            <h3>Connected Account</h3>
            <p><strong>Address:</strong> {account}</p>
            <p><strong>Network:</strong> Sepolia Testnet</p>
          </div>

          {Object.keys(contractArtifacts).length === 0 ? (
            <div className="info-card">
              <p>Loading contract artifacts...</p>
            </div>
          ) : (
            <button 
              className="btn btn-success" 
              onClick={deployContracts}
              disabled={loading}
            >
              {loading ? 'Deploying...' : 'Deploy Contracts'}
            </button>
          )}

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          {Object.keys(contractAddresses).length > 0 && (
            <div className="info-card">
              <h3>Deployed Contracts</h3>
              <p><strong>DefimonToken:</strong> {contractAddresses.defimonToken}</p>
              <p><strong>DefimonInvestment:</strong> {contractAddresses.defimonInvestment}</p>
              <p><strong>Deployer:</strong> {contractAddresses.deployer}</p>
              <p><strong>Signer 1:</strong> {contractAddresses.signer1}</p>
              <p><strong>Signer 2:</strong> {contractAddresses.signer2}</p>
              <p><strong>Network:</strong> {contractAddresses.network}</p>
              <p><strong>Deployed:</strong> {new Date(contractAddresses.deploymentTime).toLocaleString()}</p>
            </div>
          )}
        </div>
      )}

      <div className="info-section">
        <h2 className="section-title">Instructions</h2>
        <div className="info-card">
          <h3>Before Deploying</h3>
          <ol>
            <li>Make sure MetaMask is connected to Sepolia testnet</li>
            <li>Ensure you have some Sepolia ETH for gas fees</li>
            <li>Click &quot;Deploy Contracts&quot; to start deployment</li>
            <li>Confirm transactions in MetaMask</li>
          </ol>
        </div>
        
        <div className="info-card">
          <h3>What Gets Deployed</h3>
          <ul>
            <li><strong>DefimonToken:</strong> ERC20 token with 10 billion supply</li>
            <li><strong>DefimonInvestment:</strong> Investment contract for token sales</li>
            <li><strong>Exchange Rate:</strong> 1 ETH = 100 DEFI tokens</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
