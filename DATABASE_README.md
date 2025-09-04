# DEFIMON Database System

## Overview

The DEFIMON project now includes a comprehensive local SQLite database system that provides reliable data persistence, transaction tracking, and analytics for smart contract operations.

## Features

### 🗄️ **Database Storage**
- **SQLite Database**: Lightweight, serverless database stored in `data/defimon.db`
- **Automatic Setup**: Tables are created automatically on first run
- **Data Persistence**: All smart contract data survives application restarts

### 📊 **Data Tracking**
- **Smart Contract Deployments**: Complete deployment history with metadata
- **Transaction History**: All blockchain interactions tracked and stored
- **Investment Records**: Detailed investment data with token calculations
- **Contract Statistics**: Real-time statistics and balance tracking
- **User Sessions**: Wallet connection tracking and analytics
- **Application Logs**: Comprehensive logging for debugging and monitoring

### 🔌 **API Endpoints**
- **`/api/contracts`**: Manage smart contract deployments
- **`/api/transactions`**: Track transaction history
- **`/api/investments`**: Record investment data
- **`/api/stats`**: Update and retrieve contract statistics

### 🎛️ **Dashboard Interface**
- **Database Dashboard**: Visual interface to view all stored data
- **Tabbed Navigation**: Organized by data type (contracts, transactions, investments, stats)
- **Real-time Updates**: Live data from the database
- **Export Ready**: Data formatted for easy analysis

## Database Schema

### 1. **contract_deployments**
Stores information about deployed smart contracts.

```sql
CREATE TABLE contract_deployments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_name TEXT NOT NULL,           -- Name of the contract
  contract_address TEXT UNIQUE NOT NULL, -- Contract address on blockchain
  contract_type TEXT NOT NULL,           -- Type (ERC20, Investment, etc.)
  network TEXT NOT NULL,                 -- Network (sepolia, mainnet, etc.)
  deployer_address TEXT NOT NULL,        -- Address that deployed the contract
  signer1_address TEXT,                  -- First signer for multi-sig
  signer2_address TEXT,                  -- Second signer for multi-sig
  deployment_tx_hash TEXT,               -- Transaction hash of deployment
  deployment_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  contract_abi TEXT,                     -- Contract ABI (JSON)
  contract_bytecode TEXT,                -- Contract bytecode
  status TEXT DEFAULT 'active',          -- Contract status
  notes TEXT                             -- Additional notes
);
```

### 2. **transactions**
Tracks all blockchain transactions.

```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT UNIQUE NOT NULL,          -- Transaction hash
  contract_address TEXT NOT NULL,        -- Contract involved
  function_name TEXT NOT NULL,           -- Function called
  from_address TEXT NOT NULL,            -- Sender address
  to_address TEXT,                       -- Recipient address
  value_wei TEXT,                        -- Value in wei
  value_eth REAL,                        -- Value in ETH
  gas_used INTEGER,                      -- Gas used
  gas_price TEXT,                        -- Gas price
  block_number INTEGER,                  -- Block number
  status TEXT DEFAULT 'pending',         -- Transaction status
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT                     -- Error message if failed
);
```

### 3. **investments**
Records all investment transactions.

```sql
CREATE TABLE investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT UNIQUE NOT NULL,          -- Transaction hash
  investor_address TEXT NOT NULL,        -- Investor's address
  contract_address TEXT NOT NULL,        -- Investment contract
  eth_amount REAL NOT NULL,              -- ETH amount invested
  token_amount REAL NOT NULL,            -- Tokens received
  investment_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'completed'        -- Investment status
);
```

### 4. **contract_stats**
Caches contract statistics for performance.

```sql
CREATE TABLE contract_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_address TEXT UNIQUE NOT NULL, -- Contract address
  total_investments INTEGER DEFAULT 0,   -- Total number of investments
  total_tokens_distributed REAL DEFAULT 0, -- Total tokens distributed
  total_investors INTEGER DEFAULT 0,     -- Total unique investors
  contract_balance_wei TEXT DEFAULT '0', -- Contract ETH balance in wei
  contract_balance_eth REAL DEFAULT 0,   -- Contract ETH balance
  token_balance REAL DEFAULT 0,          -- Contract token balance
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5. **user_sessions**
Tracks wallet connections and user activity.

```sql
CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT NOT NULL,          -- User's wallet address
  network TEXT NOT NULL,                 -- Network connected to
  connected_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_duration_minutes INTEGER DEFAULT 0
);
```

### 6. **app_logs**
Comprehensive application logging.

```sql
CREATE TABLE app_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,                   -- Log level (info, warning, error)
  message TEXT NOT NULL,                 -- Log message
  context TEXT,                          -- Additional context (JSON)
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Usage

### **Automatic Data Collection**
The database automatically collects data when you:

1. **Deploy Contracts**: Contract information is saved when deploying
2. **Make Investments**: Investment data is recorded automatically
3. **Execute Transactions**: All blockchain interactions are tracked
4. **Connect Wallets**: User sessions are logged

### **Manual Data Access**
Access your data through:

1. **Dashboard**: `/dashboard` - Visual interface for all data
2. **API Endpoints**: Direct access to database data
3. **Database File**: `data/defimon.db` - Direct SQLite access

### **API Examples**

#### Get All Contracts
```bash
GET /api/contracts
```

#### Get Contract by Address
```bash
GET /api/contracts?address=0x1234...
```

#### Get Transactions for Address
```bash
GET /api/transactions?address=0x1234...
```

#### Get Investment History
```bash
GET /api/investments?address=0x1234...
```

#### Update Contract Statistics
```bash
POST /api/stats
{
  "contractAddress": "0x1234...",
  "totalInvestments": 10,
  "totalTokensDistributed": 1000,
  "totalInvestors": 5
}
```

## Benefits

### 🚀 **Reliability**
- **Data Persistence**: No more lost contract addresses or transaction history
- **Offline Access**: View data even when blockchain is unavailable
- **Backup Ready**: Easy to backup and restore database

### 📈 **Analytics**
- **Investment Tracking**: Complete history of all investments
- **Performance Metrics**: Gas usage, transaction success rates
- **User Behavior**: Wallet connection patterns and usage statistics

### 🔧 **Development**
- **Debugging**: Comprehensive logs for troubleshooting
- **Testing**: Reliable data for development and testing
- **Monitoring**: Real-time insights into application performance

### 💼 **Business**
- **Audit Trail**: Complete record of all operations
- **Compliance**: Detailed transaction and investment records
- **Reporting**: Easy export of data for analysis

## File Structure

```
defismart/
├── data/                          # Database storage
│   └── defimon.db                # SQLite database file
├── utils/
│   └── database.js               # Database utility class
├── pages/
│   ├── api/
│   │   ├── contracts.js          # Contract management API
│   │   ├── transactions.js       # Transaction tracking API
│   │   ├── investments.js        # Investment records API
│   │   └── stats.js              # Statistics management API
│   ├── dashboard.js              # Database dashboard
│   ├── deploy.js                 # Contract deployment (updated)
│   └── test.js                   # Contract testing (updated)
└── DATABASE_README.md            # This documentation
```

## Getting Started

### 1. **Install Dependencies**
```bash
npm install sqlite3 sqlite better-sqlite3
```

### 2. **Access Dashboard**
Navigate to `/dashboard` to view your database

### 3. **Deploy Contracts**
Use `/deploy` - data is automatically saved to database

### 4. **Test Contracts**
Use `/test` - all interactions are tracked in database

## Database Management

### **Backup Database**
```bash
cp data/defimon.db data/defimon_backup_$(date +%Y%m%d).db
```

### **Reset Database**
```bash
rm data/defimon.db
# Restart application to recreate tables
```

### **View Database Directly**
```bash
sqlite3 data/defimon.db
.tables                    # Show all tables
.schema                    # Show table schemas
SELECT * FROM contracts;   # Query data
```

## Security Considerations

- **Local Storage**: Database is stored locally on your machine
- **No External Access**: Database is not exposed to the internet
- **User Data**: Only stores public blockchain data, no private keys
- **Backup**: Regular backups recommended for production use

## Future Enhancements

- **Data Export**: CSV/JSON export functionality
- **Advanced Analytics**: Charts and graphs for data visualization
- **Multi-Network Support**: Support for multiple blockchain networks
- **Real-time Updates**: WebSocket integration for live data
- **Data Archiving**: Automatic archiving of old data
- **Performance Optimization**: Database indexing and query optimization

## Support

For database-related issues:

1. **Check Logs**: View application logs in the database
2. **Verify Data**: Use dashboard to inspect stored data
3. **Database File**: Check if `data/defimon.db` exists and is accessible
4. **Console Errors**: Look for database errors in browser console

The database system makes DEFIMON more reliable, trackable, and professional while providing valuable insights into your smart contract operations! 🎉
