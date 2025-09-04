/**
 * Database Utility for DefiMon Application
 * Provides SQLite database operations for the API endpoints
 */

import sqlite3 from 'sqlite3';
import path from 'path';

export default class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.join(process.cwd(), 'data', 'defimon.db');
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const createTablesSQL = `
      -- Investments table
      CREATE TABLE IF NOT EXISTS investments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_hash TEXT UNIQUE NOT NULL,
        investor_address TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        eth_amount TEXT NOT NULL,
        token_amount TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        investment_time DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Contract deployments table
      CREATE TABLE IF NOT EXISTS contract_deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_name TEXT NOT NULL,
        contract_address TEXT UNIQUE NOT NULL,
        contract_type TEXT NOT NULL,
        network TEXT NOT NULL,
        deployer_address TEXT NOT NULL,
        signer1_address TEXT,
        signer2_address TEXT,
        deployment_tx_hash TEXT NOT NULL,
        contract_abi TEXT,
        contract_bytecode TEXT,
        notes TEXT,
        status TEXT DEFAULT 'active',
        deployment_time DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Transactions table
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_hash TEXT UNIQUE NOT NULL,
        contract_address TEXT NOT NULL,
        function_name TEXT NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT,
        value_wei TEXT DEFAULT '0',
        value_eth TEXT DEFAULT '0',
        gas_used TEXT,
        gas_price TEXT,
        block_number INTEGER,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Contract statistics table
      CREATE TABLE IF NOT EXISTS contract_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_address TEXT UNIQUE NOT NULL,
        total_investments INTEGER DEFAULT 0,
        total_tokens_distributed TEXT DEFAULT '0',
        total_investors INTEGER DEFAULT 0,
        contract_balance_wei TEXT DEFAULT '0',
        contract_balance_eth TEXT DEFAULT '0',
        token_balance TEXT DEFAULT '0',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Logs table
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(createTablesSQL, (err) => {
        if (err) {
          console.error('Error creating tables:', err.message);
          reject(err);
        } else {
          console.log('Database tables created/verified');
          resolve();
        }
      });
    });
  }

  // Investment methods
  async saveInvestment(investment) {
    const sql = `
      INSERT INTO investments (tx_hash, investor_address, contract_address, eth_amount, token_amount, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        investment.txHash,
        investment.investorAddress,
        investment.contractAddress,
        investment.ethAmount,
        investment.tokenAmount,
        investment.status || 'completed'
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async getInvestments(filters = {}) {
    let sql = 'SELECT * FROM investments WHERE 1=1';
    let params = [];

    if (filters.address) {
      sql += ' AND investor_address = ?';
      params.push(filters.address);
    }

    if (filters.contractAddress) {
      sql += ' AND contract_address = ?';
      params.push(filters.contractAddress);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY investment_time DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Contract deployment methods
  async saveContractDeployment(deployment) {
    const sql = `
      INSERT INTO contract_deployments (
        contract_name, contract_address, contract_type, network, deployer_address,
        signer1_address, signer2_address, deployment_tx_hash, contract_abi, contract_bytecode, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        deployment.contractName,
        deployment.contractAddress,
        deployment.contractType,
        deployment.network,
        deployment.deployerAddress,
        deployment.signer1Address,
        deployment.signer2Address,
        deployment.deploymentTxHash,
        deployment.contractAbi,
        deployment.contractBytecode,
        deployment.notes
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async getContractDeployments(network = null) {
    let sql = 'SELECT * FROM contract_deployments WHERE status = "active"';
    let params = [];

    if (network) {
      sql += ' AND network = ?';
      params.push(network);
    }

    sql += ' ORDER BY deployment_time DESC';

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getContractByAddress(address) {
    const sql = 'SELECT * FROM contract_deployments WHERE contract_address = ? AND status = "active"';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [address], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Transaction methods
  async saveTransaction(transaction) {
    const sql = `
      INSERT INTO transactions (
        tx_hash, contract_address, function_name, from_address, to_address,
        value_wei, value_eth, gas_used, gas_price, block_number, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        transaction.txHash,
        transaction.contractAddress,
        transaction.functionName,
        transaction.fromAddress,
        transaction.toAddress,
        transaction.valueWei || '0',
        transaction.valueEth || '0',
        transaction.gasUsed,
        transaction.gasPrice,
        transaction.blockNumber,
        transaction.status || 'pending',
        transaction.errorMessage
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async getTransactions(filters = {}) {
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    let params = [];

    if (filters.address) {
      sql += ' AND (from_address = ? OR to_address = ?)';
      params.push(filters.address, filters.address);
    }

    if (filters.contractAddress) {
      sql += ' AND contract_address = ?';
      params.push(filters.contractAddress);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Contract statistics methods
  async saveContractStats(stats) {
    const sql = `
      INSERT OR REPLACE INTO contract_stats (
        contract_address, total_investments, total_tokens_distributed, total_investors,
        contract_balance_wei, contract_balance_eth, token_balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        stats.contractAddress,
        stats.totalInvestments || 0,
        stats.totalTokensDistributed || '0',
        stats.totalInvestors || 0,
        stats.contractBalanceWei || '0',
        stats.contractBalanceEth || '0',
        stats.tokenBalance || '0'
      ], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async getContractStats(contractAddress) {
    const sql = 'SELECT * FROM contract_stats WHERE contract_address = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [contractAddress], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async updateContractStats(contractAddress, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(contractAddress);

    const sql = `UPDATE contract_stats SET ${fields}, last_updated = CURRENT_TIMESTAMP WHERE contract_address = ?`;
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  // Logging methods
  async log(level, message, details = null) {
    const sql = 'INSERT INTO logs (level, message, details) VALUES (?, ?, ?)';
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [level, message, details ? JSON.stringify(details) : null], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}
