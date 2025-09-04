import { useWallet } from '../contexts/WalletContext';

export default function NetworkStatus() {
  const { network, switchToSepolia } = useWallet();

  const isSepolia = network && network.includes('Sepolia');

  return (
    <div className="network-status">
      <div className="status-header">
        <h3>Network Status</h3>
      </div>
      
      <div className="network-info">
        <div className="network-indicator">
          <span className={`status-dot ${isSepolia ? 'connected' : 'disconnected'}`}></span>
          <span className="network-name">
            {network || 'Unknown Network'}
          </span>
        </div>
        
        {!isSepolia && (
          <div className="network-warning">
            <p>⚠️ Please switch to Sepolia Testnet to use this platform</p>
            <button 
              className="btn btn-warning" 
              onClick={switchToSepolia}
            >
              Switch to Sepolia
            </button>
          </div>
        )}
        
        {isSepolia && (
          <div className="network-success">
            <p>✅ Connected to Sepolia Testnet</p>
          </div>
        )}
      </div>
    </div>
  );
}
