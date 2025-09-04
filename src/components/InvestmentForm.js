import Link from 'next/link';

export default function InvestmentForm({ 
  hasValidContracts, 
  onInvestment, 
  loading, 
  amount, 
  onAmountChange 
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (amount && parseFloat(amount) > 0) {
      onInvestment(amount);
    }
  };

  if (!hasValidContracts) {
    return (
      <div className="investment-section">
        <h2 className="section-title">Investment</h2>
        <div className="info-card" style={{ background: '#fff3cd', border: '2px solid #ffc107' }}>
          <h3>⚠️ Contracts not deployed</h3>
          <p>To invest, you need to deploy smart contracts to Sepolia network first.</p>
          <Link href="/deploy" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '10px' }}>
            Deploy Contracts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="investment-section">
      <h2 className="section-title">Investment</h2>
      
      <div className="info-card">
        <h3>How it works</h3>
        <p>
          Send ETH to the contract and receive DEFI tokens at rate 1 ETH = 100 DEFI.
          All investments are recorded on the blockchain and can be tracked.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="investmentAmount">Investment amount (ETH)</label>
          <input
            type="number"
            id="investmentAmount"
            className="form-control"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.1"
            step="0.001"
            min="0"
            required
          />
        </div>

        {amount && parseFloat(amount) > 0 && (
          <div className="info-card">
            <h3>Calculation</h3>
            <p>
              For {amount} ETH you will receive: <strong>{parseFloat(amount) * 100} DEFI tokens</strong>
            </p>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-success"
          disabled={loading || !amount || parseFloat(amount) <= 0}
        >
          {loading ? <span className="loading"></span> : 'Invest'}
        </button>
      </form>
    </div>
  );
}
