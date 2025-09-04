export default function ContractStats({ contractInfo }) {
  const formatNumber = (num) => {
    return parseFloat(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  };

  return (
    <div className="investment-section">
      <h2 className="section-title">Contract Statistics</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{contractInfo.exchangeRate}</div>
          <div className="stat-label">Tokens per 1 ETH</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatNumber(contractInfo.contractBalance)}</div>
          <div className="stat-label">ETH in contract</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatNumber(contractInfo.tokenBalance)}</div>
          <div className="stat-label">DEFI tokens available</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{contractInfo.investorCount}</div>
          <div className="stat-label">Investors</div>
        </div>
      </div>
    </div>
  );
}
