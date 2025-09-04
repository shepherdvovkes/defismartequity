export default function InvestorInfo({ investorInfo }) {
  const formatNumber = (num) => {
    return parseFloat(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  };

  return (
    <div className="investment-section">
      <h2 className="section-title">Your Investments</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{formatNumber(investorInfo.totalInvested)}</div>
          <div className="stat-label">ETH invested</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatNumber(investorInfo.totalTokens)}</div>
          <div className="stat-label">DEFI tokens received</div>
        </div>
      </div>
    </div>
  );
}
