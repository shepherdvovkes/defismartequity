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
      case 'DELETE':
        await handleDelete(req, res);
        break;
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API Error:', error);
    await db.log('error', 'API Error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

async function handleGet(req, res) {
  const { address, network, type } = req.query;

  try {
    if (address) {
      // Get specific contract by address
      const contract = await db.getContractByAddress(address);
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Parse ABI from JSON string
      if (contract.contract_abi) {
        contract.contract_abi = JSON.parse(contract.contract_abi);
      }
      
      res.status(200).json(contract);
    } else {
      // Get all contracts with optional filters
      const contracts = await db.getContractDeployments(network);
      
      // Parse ABI for each contract
      contracts.forEach(contract => {
        if (contract.contract_abi) {
          contract.contract_abi = JSON.parse(contract.contract_abi);
        }
      });
      
      res.status(200).json(contracts);
    }
  } catch (error) {
    await db.log('error', 'GET contracts error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch contracts', details: error.message });
  }
}

async function handlePost(req, res) {
  try {
    const {
      contractName,
      contractAddress,
      contractType,
      network,
      deployerAddress,
      signer1Address,
      signer2Address,
      deploymentTxHash,
      contractAbi,
      contractBytecode,
      notes
    } = req.body;

    // Validate required fields
    if (!contractName || !contractAddress || !contractType || !network || !deployerAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['contractName', 'contractAddress', 'contractType', 'network', 'deployerAddress']
      });
    }

    // Save contract deployment to database
    const deploymentId = await db.saveContractDeployment({
      contractName,
      contractAddress,
      contractType,
      network,
      deployerAddress,
      signer1Address,
      signer2Address,
      deploymentTxHash,
      contractAbi,
      contractBytecode,
      notes
    });

    // Log the deployment
    await db.log('info', 'Contract deployed', {
      contractName,
      contractAddress,
      network,
      deployerAddress,
      deploymentId
    });

    res.status(201).json({
      success: true,
      message: 'Contract deployment saved successfully',
      deploymentId,
      contractAddress
    });

  } catch (error) {
    await db.log('error', 'POST contracts error', { error: error.message, body: req.body });
    res.status(500).json({ error: 'Failed to save contract deployment', details: error.message });
  }
}

async function handlePut(req, res) {
  try {
    const { address } = req.query;
    const updateData = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Contract address is required' });
    }

    // Get existing contract
    const existingContract = await db.getContractByAddress(address);
    if (!existingContract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Update contract (implement update logic as needed)
    // For now, we'll just log the update attempt
    await db.log('info', 'Contract update requested', {
      contractAddress: address,
      updateData
    });

    res.status(200).json({
      success: true,
      message: 'Contract update logged successfully'
    });

  } catch (error) {
    await db.log('error', 'PUT contracts error', { error: error.message, body: req.body });
    res.status(500).json({ error: 'Failed to update contract', details: error.message });
  }
}

async function handleDelete(req, res) {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({ error: 'Contract address is required' });
    }

    // Get existing contract
    const existingContract = await db.getContractByAddress(address);
    if (!existingContract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Soft delete by updating status
    // Note: You might want to implement actual soft delete in the database class
    await db.log('info', 'Contract deletion requested', {
      contractAddress: address,
      contractName: existingContract.contract_name
    });

    res.status(200).json({
      success: true,
      message: 'Contract deletion logged successfully'
    });

  } catch (error) {
    await db.log('error', 'DELETE contracts error', { error: error.message });
    res.status(500).json({ error: 'Failed to delete contract', details: error.message });
  }
}
