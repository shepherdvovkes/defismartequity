import { useWallet } from '../contexts/WalletContext';

export default function MetaMaskInstructions({ tokenInfo, isDemoMode }) {
  const { isConnected } = useWallet();

  if (!isConnected) {
    return (
      <div className="metamask-instructions">
        <div className="instructions-header">
          <h3>Getting Started with MetaMask</h3>
        </div>
        
        <div className="instructions-content">
          <div className="step">
            <h4>Step 1: Install MetaMask</h4>
            <p>Download and install the MetaMask browser extension from <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer">metamask.io</a></p>
          </div>
          
          <div className="step">
            <h4>Step 2: Create or Import Wallet</h4>
            <p>Create a new wallet or import an existing one using your seed phrase</p>
          </div>
          
          <div className="step">
            <h4>Step 3: Switch to Sepolia Testnet</h4>
            <p>In MetaMask, switch to the Sepolia Testnet network</p>
          </div>
          
          <div className="step">
            <h4>Step 4: Get Test ETH</h4>
            <p>Visit <a href="https://sepoliafaucet.com/" target="_blank" rel="noopener noreferrer">Sepolia Faucet</a> to get free test ETH</p>
          </div>
          
          <div className="step">
            <h4>Step 5: Connect Wallet</h4>
            <p>Click "Connect Wallet" above to connect your MetaMask wallet</p>
          </div>
        </div>
      </div>
    );
  }

  if (isDemoMode) {
    return (
      <div className="metamask-instructions demo-mode">
        <div className="instructions-header">
          <h3>Demo Mode</h3>
        </div>
        
        <div className="instructions-content">
          <p>Smart contracts are not deployed yet. This is a demonstration of the wallet connection functionality.</p>
          <p>To test full functionality, deploy the smart contracts to Sepolia testnet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="metamask-instructions connected">
      <div className="instructions-header">
        <h3>Wallet Connected Successfully!</h3>
      </div>
      
      <div className="instructions-content">
        <p>Your MetaMask wallet is now connected to the DEFIMON platform.</p>
        <p>You can now:</p>
        <ul>
          <li>View your ETH and DEFI token balances</li>
          <li>Make investments in the DEFIMON project</li>
          <li>Track your investment portfolio</li>
        </ul>
        
        {tokenInfo && (
          <div className="token-details">
            <h4>Token Details:</h4>
            <p><strong>Name:</strong> {tokenInfo.name}</p>
            <p><strong>Symbol:</strong> {tokenInfo.symbol}</p>
            <p><strong>Contract Address:</strong> {tokenInfo.address}</p>
          </div>
        )}
      </div>
    </div>
  );
}
