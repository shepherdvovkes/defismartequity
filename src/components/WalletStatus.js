import { useWallet } from '../contexts/WalletContext';

export default function WalletStatus() {
  const { 
    isConnected, 
    account, 
    ethBalance, 
    tokenBalance, 
    loading, 
    error, 
    connectWallet, 
    disconnectWallet 
  } = useWallet();

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance) => {
    return parseFloat(balance).toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6
    });
  };

  if (loading) {
    return (
      <div className="wallet-status loading">
        <div className="loading-spinner"></div>
        <span>Connecting wallet...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="wallet-status disconnected">
        <div className="status-info">
          <h3>Wallet Status</h3>
          <p>Connect your MetaMask wallet to start investing</p>
          {error && <div className="error-message">{error}</div>}
        </div>
        <button 
          className="btn btn-primary connect-btn" 
          onClick={connectWallet}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-status connected">
      <div className="status-header">
        <h3>Wallet Connected</h3>
        <button 
          className="btn btn-secondary disconnect-btn" 
          onClick={disconnectWallet}
        >
          Disconnect
        </button>
      </div>
      
      <div className="wallet-details">
        <div className="detail-item">
          <span className="label">Address:</span>
          <span className="value">{formatAddress(account)}</span>
        </div>
        
        <div className="detail-item">
          <span className="label">ETH Balance:</span>
          <span className="value">{formatBalance(ethBalance)} ETH</span>
        </div>
        
        {tokenBalance !== '0' && (
          <div className="detail-item">
            <span className="label">DEFI Tokens:</span>
            <span className="value">{formatBalance(tokenBalance)} DEFI</span>
          </div>
        )}
      </div>
      
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
