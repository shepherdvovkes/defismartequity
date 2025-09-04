import Database from '../../utils/database';

let db = null;

export default async function handler(req, res) {
  // Initialize database connection
  if (!db) {
    db = new Database();
    await db.init();
  }

  try {
    switch (req.method) {
      case 'GET':
        await handleGet(req, res);
        break;
      case 'POST':
        await handlePost(req, res);
        break;
      case 'PUT':
        await handlePut(req, res);
        break;
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API Error:', error);
    await db.log('error', 'Transactions API Error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

async function handleGet(req, res) {
  const { address, contractAddress, status, limit = 100 } = req.query;

  try {
    // Get transactions with filters
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    let params = [];

    if (address) {
      sql += ' AND (from_address = ? OR to_address = ?)';
      params.push(address, address);
    }

    if (contractAddress) {
      sql += ' AND contract_address = ?';
      params.push(contractAddress);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    // Execute query
    const transactions = await new Promise((resolve, reject) => {
      db.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.status(200).json(transactions);

  } catch (error) {
    await db.log('error', 'GET transactions error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
  }
}

async function handlePost(req, res) {
  try {
    const {
      txHash,
      contractAddress,
      functionName,
      fromAddress,
      toAddress,
      valueWei,
      valueEth,
      gasUsed,
      gasPrice,
      blockNumber,
      status,
      errorMessage
    } = req.body;

    // Validate required fields
    if (!txHash || !contractAddress || !functionName || !fromAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['txHash', 'contractAddress', 'functionName', 'fromAddress']
      });
    }

    // Save transaction to database
    const transactionId = await db.saveTransaction({
      txHash,
      contractAddress,
      functionName,
      fromAddress,
      toAddress,
      valueWei,
      valueEth,
      gasUsed,
      gasPrice,
      blockNumber,
      status,
      errorMessage
    });

    // Log the transaction
    await db.log('info', 'Transaction saved', {
      txHash,
      contractAddress,
      functionName,
      fromAddress,
      transactionId
    });

    res.status(201).json({
      success: true,
      message: 'Transaction saved successfully',
      transactionId,
      txHash
    });

  } catch (error) {
    await db.log('error', 'POST transactions error', { error: error.message, body: req.body });
    res.status(500).json({ error: 'Failed to save transaction', details: error.message });
  }
}

async function handlePut(req, res) {
  try {
    const { txHash } = req.query;
    const { status, blockNumber, gasUsed, errorMessage } = req.body;

    if (!txHash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }

    // Update transaction status
    const updatedRows = await db.updateTransactionStatus(
      txHash, 
      status, 
      blockNumber, 
      gasUsed, 
      errorMessage
    );

    if (updatedRows === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Log the update
    await db.log('info', 'Transaction status updated', {
      txHash,
      status,
      blockNumber,
      gasUsed
    });

    res.status(200).json({
      success: true,
      message: 'Transaction status updated successfully',
      txHash,
      status
    });

  } catch (error) {
    await db.log('error', 'PUT transactions error', { error: error.message, body: req.body });
    res.status(500).json({ error: 'Failed to update transaction', details: error.message });
  }
}
