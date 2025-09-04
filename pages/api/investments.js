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
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API Error:', error);
    await db.log('error', 'Investments API Error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

async function handleGet(req, res) {
  const { address, contractAddress, status, limit = 100 } = req.query;

  try {
    let sql = 'SELECT * FROM investments WHERE 1=1';
    let params = [];

    if (address) {
      sql += ' AND investor_address = ?';
      params.push(address);
    }

    if (contractAddress) {
      sql += ' AND contract_address = ?';
      params.push(contractAddress);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY investment_time DESC LIMIT ?';
    params.push(parseInt(limit));

    // Execute query
    const investments = await new Promise((resolve, reject) => {
      db.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.status(200).json(investments);

  } catch (error) {
    await db.log('error', 'GET investments error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch investments', details: error.message });
  }
}

async function handlePost(req, res) {
  try {
    const {
      txHash,
      investorAddress,
      contractAddress,
      ethAmount,
      tokenAmount,
      status
    } = req.body;

    // Validate required fields
    if (!txHash || !investorAddress || !contractAddress || !ethAmount || !tokenAmount) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['txHash', 'investorAddress', 'contractAddress', 'ethAmount', 'tokenAmount']
      });
    }

    // Save investment to database
    const investmentId = await db.saveInvestment({
      txHash,
      investorAddress,
      contractAddress,
      ethAmount,
      tokenAmount,
      status
    });

    // Log the investment
    await db.log('info', 'Investment saved', {
      txHash,
      investorAddress,
      contractAddress,
      ethAmount,
      tokenAmount,
      investmentId
    });

    res.status(201).json({
      success: true,
      message: 'Investment saved successfully',
      investmentId,
      txHash
    });

  } catch (error) {
    await db.log('error', 'POST investments error', { error: error.message, body: req.body });
    res.status(500).json({ error: 'Failed to save investment', details: error.message });
  }
}
