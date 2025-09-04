import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useWallet } from '../src/contexts/WalletContext';
import WalletStatus from '../src/components/WalletStatus';
import SecureRoute from '../src/components/SecureRoute';

export default function Dashboard() {
  const { isConnected, account } = useWallet();
  const [activeTab, setActiveTab] = useState('contracts');
  const [contracts, setContracts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      switch (activeTab) {
        case 'contracts':
          const contractsResponse = await fetch('/api/contracts');
          if (contractsResponse.ok) {
            const contractsData = await contractsResponse.json();
            setContracts(contractsData);
          }
          break;
        case 'transactions':
          const transactionsResponse = await fetch('/api/transactions');
          if (transactionsResponse.ok) {
            const transactionsData = await transactionsResponse.json();
            setTransactions(transactionsData);
          }
          break;
        case 'investments':
          const investmentsResponse = await fetch('/api/investments');
          if (investmentsResponse.ok) {
            const investmentsData = await investmentsResponse.json();
            setInvestments(investmentsData);
          }
          break;
        case 'stats':
          const statsResponse = await fetch('/api/stats');
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            setStats(statsData);
          }
          break;
      }
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isConnected) {
      loadData();
    }
  }, [loadData, isConnected]);

  const formatAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatEth = (value) => {
    if (!value) return '0';
    return parseFloat(value).toFixed(6);
  };

  return (
    <SecureRoute>
      <div className="container">
        <Head>
          <title>Database Dashboard - DEFIMON</title>
          <meta name="description" content="View and manage DEFIMON smart contract database" />
        </Head>

        <div className="header">
          <h1>🔒 Secure Database Dashboard</h1>
          <p>View and manage smart contract data, transactions, and statistics</p>
          <div style={{ marginTop: '20px' }}>
            <Link href="/" className="btn btn-secondary" style={{ marginRight: '10px' }}>
              Back to Home
            </Link>
            <Link href="/deploy" className="btn btn-secondary" style={{ marginRight: '10px' }}>
              Deploy Contracts
            </Link>
            <Link href="/test" className="btn btn-secondary">
              Test Contracts
            </Link>
          </div>
        </div>

        {/* 🔒 SECURITY: Always show wallet status for authenticated users */}
        <div style={{ marginBottom: '20px' }}>
          <WalletStatus />
          <div className="security-notice">
            <strong>🔒 Authenticated as:</strong> {formatAddress(account)}
          </div>
        </div>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'contracts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contracts')}
          >
            Smart Contracts ({contracts.length})
          </button>
          <button 
            className={`tab ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            Transactions ({transactions.length})
          </button>
          <button 
            className={`tab ${activeTab === 'investments' ? 'active' : ''}`}
            onClick={() => setActiveTab('investments')}
          >
            Investments ({investments.length})
          </button>
          <button 
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Statistics ({stats.length})
          </button>
        </div>

        <div className="content">
          {loading && (
            <div className="loading">
              <p>Loading {activeTab}...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}

          {activeTab === 'contracts' && (
            <div className="tab-content">
              <h2>Smart Contract Deployments</h2>
              {contracts.length === 0 ? (
                <div className="info-card">
                  <p>No contracts deployed yet. <Link href="/deploy">Deploy your first contract</Link></p>
                </div>
              ) : (
                <div className="data-grid">
                  {contracts.map((contract) => (
                    <div key={contract.id} className="data-card">
                      <h3>{contract.contract_name}</h3>
                      <p><strong>Address:</strong> {formatAddress(contract.contract_address)}</p>
                      <p><strong>Type:</strong> {contract.contract_type}</p>
                      <p><strong>Network:</strong> {contract.network}</p>
                      <p><strong>Deployer:</strong> {formatAddress(contract.deployer_address)}</p>
                      <p><strong>Deployed:</strong> {formatDate(contract.deployment_time)}</p>
                      <p><strong>Status:</strong> <span className={`status ${contract.status}`}>{contract.status}</span></p>
                      {contract.signer1_address && (
                        <p><strong>Signer 1:</strong> {formatAddress(contract.signer1_address)}</p>
                      )}
                      {contract.signer2_address && (
                        <p><strong>Signer 2:</strong> {formatAddress(contract.signer2_address)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="tab-content">
              <h2>Transaction History</h2>
              {transactions.length === 0 ? (
                <div className="info-card">
                  <p>No transactions recorded yet.</p>
                </div>
              ) : (
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Hash</th>
                        <th>Function</th>
                        <th>From</th>
                        <th>Contract</th>
                        <th>Value (ETH)</th>
                        <th>Status</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td>{formatAddress(tx.tx_hash)}</td>
                          <td>{tx.function_name}</td>
                          <td>{formatAddress(tx.from_address)}</td>
                          <td>{formatAddress(tx.contract_address)}</td>
                          <td>{formatEth(tx.value_eth)}</td>
                          <td><span className={`status ${tx.status}`}>{tx.status}</span></td>
                          <td>{formatDate(tx.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'investments' && (
            <div className="tab-content">
              <h2>Investment Records</h2>
              {investments.length === 0 ? (
                <div className="info-card">
                  <p>No investments recorded yet.</p>
                </div>
              ) : (
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Transaction</th>
                        <th>Investor</th>
                        <th>Contract</th>
                        <th>ETH Amount</th>
                        <th>Token Amount</th>
                        <th>Status</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map((investment) => (
                        <tr key={investment.id}>
                          <td>{formatAddress(investment.tx_hash)}</td>
                          <td>{formatAddress(investment.investor_address)}</td>
                          <td>{formatAddress(investment.contract_address)}</td>
                          <td>{formatEth(investment.eth_amount)}</td>
                          <td>{formatEth(investment.token_amount)}</td>
                          <td><span className={`status ${investment.status}`}>{investment.status}</span></td>
                          <td>{formatDate(investment.investment_time)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="tab-content">
              <h2>Contract Statistics</h2>
              {stats.length === 0 ? (
                <div className="info-card">
                  <p>No statistics available yet.</p>
                </div>
              ) : (
                <div className="data-grid">
                  {stats.map((stat) => (
                    <div key={stat.id} className="data-card">
                      <h3>{stat.contract_name || 'Unknown Contract'}</h3>
                      <p><strong>Address:</strong> {formatAddress(stat.contract_address)}</p>
                      <p><strong>Network:</strong> {stat.network}</p>
                      <p><strong>Total Investments:</strong> {stat.total_investments}</p>
                      <p><strong>Total Tokens:</strong> {formatEth(stat.total_tokens_distributed)}</p>
                      <p><strong>Total Investors:</strong> {stat.total_investors}</p>
                      <p><strong>Contract Balance:</strong> {formatEth(stat.contract_balance_eth)} ETH</p>
                      <p><strong>Token Balance:</strong> {formatEth(stat.token_balance)}</p>
                      <p><strong>Last Updated:</strong> {formatDate(stat.last_updated)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <style jsx>{`
          .container {
            max-width: 1400px;
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
          .tabs {
            display: flex;
            border-bottom: 2px solid #dee2e6;
            margin-bottom: 30px;
          }
          .tab {
            padding: 15px 25px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 16px;
            color: #6c757d;
            border-bottom: 3px solid transparent;
            transition: all 0.3s ease;
          }
          .tab:hover {
            color: #007AFF;
          }
          .tab.active {
            color: #007AFF;
            border-bottom-color: #007AFF;
          }
          .content {
            min-height: 400px;
          }
          .tab-content h2 {
            color: #333;
            margin-bottom: 20px;
          }
          .loading {
            text-align: center;
            padding: 40px;
            color: #6c757d;
          }
          .security-notice {
            background: #d1ecf1;
            color: #0c5460;
            padding: 10px 15px;
            border-radius: 6px;
            margin: 10px 0;
            border: 1px solid #bee5eb;
            font-size: 14px;
          }
          .info-card {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
          }
          .data-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
          }
          .data-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .data-card h3 {
            color: #007AFF;
            margin-bottom: 15px;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 10px;
          }
          .data-card p {
            margin: 8px 0;
            font-size: 14px;
          }
          .data-table {
            overflow-x: auto;
          }
          .data-table table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .data-table th,
          .data-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
          }
          .data-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
          }
          .data-table tr:hover {
            background: #f8f9fa;
          }
          .status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
          }
          .status.active {
            background: #d4edda;
            color: #155724;
          }
          .status.pending {
            background: #fff3cd;
            color: #856404;
          }
          .status.completed {
            background: #d1ecf1;
            color: #0c5460;
          }
          .status.failed {
            background: #f8d7da;
            color: #721c24;
          }
          .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
          }
          .btn-secondary {
            background: #6c757d;
            color: white;
          }
          .btn-secondary:hover {
            background: #5a6268;
          }
          .error-message {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border: 1px solid #f5c6cb;
          }
        `}</style>
      </div>
    </SecureRoute>
  );
}
