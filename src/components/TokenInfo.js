export default function TokenInfo({ tokenInfo }) {
  const formatNumber = (num) => {
    return parseFloat(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  };

  return (
    <div className="investment-section">
      <h2 className="section-title">Token Information</h2>
      <div className="info-card">
        <h3>{tokenInfo.name} ({tokenInfo.symbol})</h3>
        <p><strong>Total supply:</strong> {formatNumber(tokenInfo.totalSupply)} tokens</p>
        <p><strong>Decimals:</strong> {tokenInfo.decimals} decimal places</p>
      </div>
    </div>
  );
}
