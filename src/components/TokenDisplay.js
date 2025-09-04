import { useWallet } from '../contexts/WalletContext';

export default function TokenDisplay() {
  const { tokenBalance, contractAddresses } = useWallet();

  const formatBalance = (balance) => {
    return parseFloat(balance).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  };

  const hasTokens = parseFloat(tokenBalance) > 0;
  const hasContracts = contractAddresses && contractAddresses.defimonToken;

  return (
    <div className="token-display">
      <div className="display-header">
        <h3>Token Information</h3>
      </div>
      
      <div className="token-details">
        <div className="token-balance">
          <span className="label">Your DEFI Tokens:</span>
          <span className="value">{formatBalance(tokenBalance)} DEFI</span>
        </div>
        
        {hasContracts && (
          <div className="contract-info">
            <span className="label">Token Contract:</span>
            <span className="value contract-address">
              {contractAddresses.defimonToken}
            </span>
          </div>
        )}
        
        {!hasTokens && hasContracts && (
          <div className="no-tokens">
            <p>You don't have any DEFI tokens yet. Make your first investment!</p>
          </div>
        )}
        
        {!hasContracts && (
          <div className="no-contracts">
            <p>Smart contracts not deployed. Contact administrator.</p>
          </div>
        )}
      </div>
    </div>
  );
}
