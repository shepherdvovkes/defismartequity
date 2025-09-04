const { Defender } = require('@openzeppelin/defender-sdk');

// Конфигурация для OpenZeppelin Defender
const defenderConfig = {
  // API ключи (добавьте в .env файл)
  apiKey: process.env.DEFENDER_API_KEY,
  apiSecret: process.env.DEFENDER_API_SECRET,
  
  // Настройки мониторинга
  monitoring: {
    // Мониторинг контрактов
    contracts: [
      {
        name: 'DefimonTokenV2',
        address: process.env.DEFIMON_TOKEN_V2_ADDRESS,
        network: 'sepolia',
        abi: 'DefimonTokenV2.json'
      },
      {
        name: 'DefimonInvestmentV2',
        address: process.env.DEFIMON_INVESTMENT_V2_ADDRESS,
        network: 'sepolia',
        abi: 'DefimonInvestmentV2.json'
      }
    ],
    
    // Настройки алертов
    alerts: {
      // Алерты на подозрительную активность
      suspiciousActivity: {
        enabled: true,
        conditions: [
          {
            type: 'large_transfer',
            threshold: '1000000000000000000000', // 1000 ETH
            description: 'Large transfer detected'
          },
          {
            type: 'unusual_activity',
            threshold: '10', // 10 transactions in 1 hour
            timeWindow: '3600', // 1 hour
            description: 'Unusual activity detected'
          },
          {
            type: 'blacklist_violation',
            description: 'Blacklisted address attempted transaction'
          },
          {
            type: 'pause_violation',
            description: 'Transaction attempted while contract paused'
          }
        ]
      },
      
      // Алерты на изменения в контракте
      contractChanges: {
        enabled: true,
        conditions: [
          {
            type: 'owner_change',
            description: 'Contract owner changed'
          },
          {
            type: 'signer_change',
            description: 'Multisig signer changed'
          },
          {
            type: 'pause_state_change',
            description: 'Contract pause state changed'
          }
        ]
      },
      
      // Алерты на инвестиции
      investmentAlerts: {
        enabled: true,
        conditions: [
          {
            type: 'large_investment',
            threshold: '100000000000000000000', // 100 ETH
            description: 'Large investment detected'
          },
          {
            type: 'investment_failure',
            description: 'Investment transaction failed'
          }
        ]
      }
    }
  },
  
  // Настройки автономных задач
  autotasks: {
    // Задача для мониторинга балансов
    balanceMonitor: {
      name: 'Balance Monitor',
      description: 'Monitor contract balances and alert if low',
      trigger: {
        type: 'schedule',
        schedule: '0 */6 * * *' // Every 6 hours
      },
      code: `
        const { ethers } = require('ethers');
        
        exports.handler = async function(event) {
          const { Defender } = require('@openzeppelin/defender-sdk');
          const defender = new Defender(event.credentials);
          
          // Получаем адреса контрактов
          const tokenAddress = process.env.DEFIMON_TOKEN_V2_ADDRESS;
          const investmentAddress = process.env.DEFIMON_INVESTMENT_V2_ADDRESS;
          
          // Проверяем балансы
          const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
          
          const tokenBalance = await provider.getBalance(tokenAddress);
          const investmentBalance = await provider.getBalance(investmentAddress);
          
          // Алерт если баланс меньше 1 ETH
          const minBalance = ethers.utils.parseEther('1');
          
          if (tokenBalance.lt(minBalance)) {
            await defender.sentinel.createAlert({
              name: 'Low Token Contract Balance',
              description: \`Token contract balance is low: \${ethers.utils.formatEther(tokenBalance)} ETH\`,
              severity: 'high',
              addresses: [tokenAddress]
            });
          }
          
          if (investmentBalance.lt(minBalance)) {
            await defender.sentinel.createAlert({
              name: 'Low Investment Contract Balance',
              description: \`Investment contract balance is low: \${ethers.utils.formatEther(investmentBalance)} ETH\`,
              severity: 'high',
              addresses: [investmentAddress]
            });
          }
          
          return { success: true };
        };
      `
    },
    
    // Задача для проверки подписантов
    signerMonitor: {
      name: 'Signer Monitor',
      description: 'Monitor multisig signers for changes',
      trigger: {
        type: 'schedule',
        schedule: '0 0 * * *' // Daily
      },
      code: `
        const { ethers } = require('ethers');
        
        exports.handler = async function(event) {
          const { Defender } = require('@openzeppelin/defender-sdk');
          const defender = new Defender(event.credentials);
          
          const investmentAddress = process.env.DEFIMON_INVESTMENT_V2_ADDRESS;
          const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
          
          // ABI для получения подписантов
          const abi = ['function getSigners() view returns (address, address, address)'];
          const contract = new ethers.Contract(investmentAddress, abi, provider);
          
          const [signer1, signer2, signer3] = await contract.getSigners();
          
          // Проверяем, что все подписанты настроены
          if (signer1 === '0x0000000000000000000000000000000000000000' ||
              signer2 === '0x0000000000000000000000000000000000000000' ||
              signer3 === '0x0000000000000000000000000000000000000000') {
            
            await defender.sentinel.createAlert({
              name: 'Invalid Signer Configuration',
              description: 'One or more multisig signers are not properly configured',
              severity: 'critical',
              addresses: [investmentAddress]
            });
          }
          
          return { success: true };
        };
      `
    }
  }
};

module.exports = defenderConfig;
