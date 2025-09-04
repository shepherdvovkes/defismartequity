import Database from '../../utils/database';
import { withAuth, withRateLimit } from '../../src/middleware/auth';

let db = null;

async function handler(req, res) {
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
    await db.log('error', 'Stats API Error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

async function handleGet(req, res) {
  const { contractAddress, network } = req.query;

  try {
    if (contractAddress) {
      // Get stats for specific contract
      const stats = await db.getContractStats(contractAddress);
      if (!stats) {
        return res.status(404).json({ error: 'Contract statistics not found' });
      }
      res.status(200).json(stats);
    } else {
      // Get stats for all contracts or by network
      let sql = `
        SELECT cs.*, cd.contract_name, cd.network 
        FROM contract_stats cs
        JOIN contract_deployments cd ON cs.contract_address = cd.contract_address
        WHERE cd.status = 'active'
      `;
      let params = [];

      if (network) {
        sql += ' AND cd.network = ?';
        params.push(network);
      }

      sql += ' ORDER BY cs.last_updated DESC';

      // Execute query
      const allStats = await new Promise((resolve, reject) => {
        db.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      res.status(200).json(allStats);
    }

  } catch (error) {
    await db.log('error', 'GET stats error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch statistics', details: error.message });
  }
}

async function handlePost(req, res) {
  try {
    const {
      contractAddress,
      totalInvestments,
      totalTokensDistributed,
      totalInvestors,
      contractBalanceWei,
      contractBalanceEth,
      tokenBalance
    } = req.body;

    // Validate required fields
    if (!contractAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['contractAddress']
      });
    }

    // Update contract statistics
    const updatedRows = await db.updateContractStats(contractAddress, {
      totalInvestments,
      totalTokensDistributed,
      totalInvestors,
      contractBalanceWei,
      contractBalanceEth,
      tokenBalance
    });

    // Log the stats update
    await db.log('info', 'Contract statistics updated', {
      contractAddress,
      totalInvestments,
      totalTokensDistributed,
      totalInvestors,
      contractBalanceEth,
      tokenBalance
    });

    res.status(200).json({
      success: true,
      message: 'Contract statistics updated successfully',
      contractAddress,
      updatedRows
    });

  } catch (error) {
    await db.log('error', 'POST stats error', { error: error.message, body: req.body });
    res.status(500).json({ error: 'Failed to update statistics', details: error.message });
  }
}

async function handlePut(req, res) {
  try {
    const { contractAddress } = req.query;
    const updateData = req.body;

    if (!contractAddress) {
      return res.status(400).json({ error: 'Contract address is required' });
    }

    // Get existing stats
    const existingStats = await db.getContractStats(contractAddress);
    if (!existingStats) {
      return res.status(404).json({ error: 'Contract statistics not found' });
    }

    // Update specific fields
    const updatedStats = { ...existingStats, ...updateData };
    const updatedRows = await db.updateContractStats(contractAddress, updatedStats);

    // Log the update
    await db.log('info', 'Contract statistics partially updated', {
      contractAddress,
      updateData,
      updatedRows
    });

    res.status(200).json({
      success: true,
      message: 'Contract statistics updated successfully',
      contractAddress,
      updatedRows
    });

  } catch (error) {
    await db.log('error', 'PUT stats error', { error: error.message, body: req.body });
    res.status(500).json({ error: 'Failed to update statistics', details: error.message });
  }
}

export default withRateLimit({ maxRequests: 50, windowMs: 15 * 60 * 1000 })(
  withAuth(handler)
);
