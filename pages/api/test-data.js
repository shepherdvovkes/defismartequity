import Database from '../../utils/database';

let db = null;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // GET - возвращаем информацию о доступных тестовых данных
    return res.status(200).json({
      message: 'Test data endpoint',
      availableData: [
        'DefimonToken - Test ERC20 token contract',
        'DefimonInvestment - Test investment contract',
        'Sample transactions and investments',
        'Contract statistics'
      ],
      usage: 'Use POST method to populate database with test data'
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize database connection
  if (!db) {
    db = new Database();
    await db.init();
  }

  try {
    // Add test contract deployments
    const testContracts = [
      {
        contractName: 'DefimonToken',
        contractAddress: '0x1234567890123456789012345678901234567890',
        contractType: 'ERC20',
        network: 'sepolia',
        deployerAddress: '0x1111111111111111111111111111111111111111',
        signer1Address: '0x2222222222222222222222222222222222222222',
        signer2Address: '0x3333333333333333333333333333333333333333',
        deploymentTxHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
        contractAbi: '[]',
        contractBytecode: '0x',
        notes: 'Test token contract for demonstration'
      },
      {
        contractName: 'DefimonInvestment',
        contractAddress: '0x5555555555555555555555555555555555555555',
        contractType: 'Investment',
        network: 'sepolia',
        deployerAddress: '0x1111111111111111111111111111111111111111',
        signer1Address: '0x2222222222222222222222222222222222222222',
        signer2Address: '0x3333333333333333333333333333333333333333',
        deploymentTxHash: '0x6666666666666666666666666666666666666666666666666666666666666666',
        contractAbi: '[]',
        contractBytecode: '0x',
        notes: 'Test investment contract for demonstration'
      }
    ];

    const results = [];
    for (const contract of testContracts) {
      try {
        const deploymentId = await db.saveContractDeployment(contract);
        results.push({
          success: true,
          contractName: contract.contractName,
          deploymentId
        });
      } catch (error) {
        results.push({
          success: false,
          contractName: contract.contractName,
          error: error.message
        });
      }
    }

    // Add test transaction
    try {
      await db.saveTransaction({
        txHash: '0x7777777777777777777777777777777777777777777777777777777777777777',
        functionName: 'deploy',
        fromAddress: '0x1111111111111111111111111111111111111111',
        contractAddress: '0x1234567890123456789012345678901234567890',
        valueEth: '0',
        status: 'completed',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.log('Failed to save test transaction:', error.message);
    }

    // Add test investment
    try {
      await db.saveInvestment({
        txHash: '0x8888888888888888888888888888888888888888888888888888888888888888',
        investorAddress: '0x1111111111111111111111111111111111111111',
        contractAddress: '0x5555555555555555555555555555555555555555',
        ethAmount: '0.1',
        tokenAmount: '10',
        status: 'completed',
        investmentTime: new Date().toISOString()
      });
    } catch (error) {
      console.log('Failed to save test investment:', error.message);
    }

    // Add test stats
    try {
      await db.saveContractStats({
        contractAddress: '0x5555555555555555555555555555555555555555',
        contractName: 'DefimonInvestment',
        network: 'sepolia',
        totalInvestments: '1',
        totalTokensDistributed: '10',
        totalInvestors: '1',
        contractBalanceEth: '0.1',
        tokenBalance: '1000',
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.log('Failed to save test stats:', error.message);
    }

    res.status(200).json({
      success: true,
      message: 'Test data added successfully',
      results
    });

  } catch (error) {
    console.error('Error adding test data:', error);
    res.status(500).json({ 
      error: 'Failed to add test data', 
      details: error.message 
    });
  }
}
