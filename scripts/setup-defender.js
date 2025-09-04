const { Defender } = require('@openzeppelin/defender-sdk');
const fs = require('fs');
const path = require('path');

async function setupDefender() {
    console.log('🛡️  Настройка OpenZeppelin Defender...');
    
    // Проверяем наличие API ключей
    if (!process.env.DEFENDER_API_KEY || !process.env.DEFENDER_API_SECRET) {
        throw new Error('❌ DEFENDER_API_KEY и DEFENDER_API_SECRET должны быть установлены в .env файле');
    }
    
    // Инициализируем Defender
    const defender = new Defender({
        apiKey: process.env.DEFENDER_API_KEY,
        apiSecret: process.env.DEFENDER_API_SECRET
    });
    
    // Загружаем адреса контрактов
    const contractsPath = path.join(__dirname, '..', 'deployed-contracts-v2.json');
    if (!fs.existsSync(contractsPath)) {
        throw new Error('❌ Файл deployed-contracts-v2.json не найден. Сначала выполните деплой V2 контрактов.');
    }
    
    const contracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));
    
    console.log('📋 Настройка мониторинга для контрактов:');
    console.log('- DefimonTokenV2:', contracts.defimonTokenV2);
    console.log('- DefimonInvestmentV2:', contracts.defimonInvestmentV2);
    
    try {
        // 1. Создаем Sentinel для мониторинга
        console.log('\n🔍 Создание Sentinel для мониторинга...');
        
        const sentinel = await defender.sentinel.create({
            name: 'DEFIMON V2 Security Monitor',
            network: 'sepolia',
            addresses: [contracts.defimonTokenV2, contracts.defimonInvestmentV2],
            abi: [
                // DefimonTokenV2 events
                'event Transfer(address indexed from, address indexed to, uint256 value)',
                'event TokensTransferred(address indexed from, address indexed to, uint256 amount)',
                'event TokensBurned(address indexed from, uint256 amount)',
                'event AddressBlacklisted(address indexed account, bool status)',
                
                // DefimonInvestmentV2 events
                'event InvestmentMade(address indexed investor, uint256 ethAmount, uint256 tokenAmount, uint256 coefficient, uint256 period)',
                'event WithdrawalRequested(bytes32 indexed requestId, address to, uint256 amount)',
                'event WithdrawalApproved(bytes32 indexed requestId, address signer)',
                'event WithdrawalExecuted(bytes32 indexed requestId, address to, uint256 amount)',
                'event SignerUpdated(address indexed oldSigner, address indexed newSigner, uint8 signerIndex)'
            ],
            conditions: [
                {
                    type: 'event',
                    eventSignature: 'Transfer(address,address,uint256)',
                    expression: 'value > 1000000000000000000000', // > 1000 ETH worth of tokens
                    description: 'Large token transfer detected'
                },
                {
                    type: 'event',
                    eventSignature: 'InvestmentMade(address,uint256,uint256,uint256,uint256)',
                    expression: 'ethAmount > 100000000000000000000', // > 100 ETH
                    description: 'Large investment detected'
                },
                {
                    type: 'event',
                    eventSignature: 'AddressBlacklisted(address,bool)',
                    description: 'Address blacklist status changed'
                },
                {
                    type: 'event',
                    eventSignature: 'SignerUpdated(address,address,uint8)',
                    description: 'Multisig signer updated'
                }
            ],
            notifyConfig: {
                timeoutMs: 0,
                message: 'DEFIMON V2 Security Alert: {{message}}'
            }
        });
        
        console.log('✅ Sentinel создан:', sentinel.sentinelId);
        
        // 2. Создаем Autotask для мониторинга балансов
        console.log('\n🤖 Создание Autotask для мониторинга балансов...');
        
        const autotask = await defender.autotask.create({
            name: 'DEFIMON V2 Balance Monitor',
            description: 'Monitor contract balances and alert if low',
            trigger: {
                type: 'schedule',
                schedule: '0 */6 * * *' // Every 6 hours
            },
            encodedZippedCode: Buffer.from(`
                const { ethers } = require('ethers');
                
                exports.handler = async function(event) {
                    const { Defender } = require('@openzeppelin/defender-sdk');
                    const defender = new Defender(event.credentials);
                    
                    // Получаем адреса контрактов из переменных окружения
                    const tokenAddress = event.secrets.DEFIMON_TOKEN_V2_ADDRESS;
                    const investmentAddress = event.secrets.DEFIMON_INVESTMENT_V2_ADDRESS;
                    
                    if (!tokenAddress || !investmentAddress) {
                        throw new Error('Contract addresses not configured in secrets');
                    }
                    
                    // Создаем провайдер
                    const provider = new ethers.providers.JsonRpcProvider(event.secrets.SEPOLIA_RPC_URL);
                    
                    // Проверяем балансы
                    const tokenBalance = await provider.getBalance(tokenAddress);
                    const investmentBalance = await provider.getBalance(investmentAddress);
                    
                    // Алерт если баланс меньше 0.1 ETH
                    const minBalance = ethers.utils.parseEther('0.1');
                    
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
                    
                    return { 
                        success: true,
                        tokenBalance: ethers.utils.formatEther(tokenBalance),
                        investmentBalance: ethers.utils.formatEther(investmentBalance)
                    };
                };
            `).toString('base64'),
            secrets: {
                DEFIMON_TOKEN_V2_ADDRESS: contracts.defimonTokenV2,
                DEFIMON_INVESTMENT_V2_ADDRESS: contracts.defimonInvestmentV2,
                SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/' + process.env.INFURA_API_KEY
            }
        });
        
        console.log('✅ Autotask создан:', autotask.autotaskId);
        
        // 3. Создаем Relayer для автоматических действий
        console.log('\n⚡ Создание Relayer для автоматических действий...');
        
        const relayer = await defender.relay.create({
            name: 'DEFIMON V2 Emergency Relayer',
            network: 'sepolia',
            minBalance: '1000000000000000000', // 1 ETH
            policies: {
                rateLimitMax: 10,
                rateLimitN: 3600
            }
        });
        
        console.log('✅ Relayer создан:', relayer.relayerId);
        
        // 4. Сохраняем конфигурацию
        const defenderConfig = {
            sentinelId: sentinel.sentinelId,
            autotaskId: autotask.autotaskId,
            relayerId: relayer.relayerId,
            contracts: {
                defimonTokenV2: contracts.defimonTokenV2,
                defimonInvestmentV2: contracts.defimonInvestmentV2
            },
            network: 'sepolia',
            createdAt: new Date().toISOString()
        };
        
        const configPath = path.join(__dirname, '..', 'defender-setup.json');
        fs.writeFileSync(configPath, JSON.stringify(defenderConfig, null, 2));
        
        console.log('\n🎉 Настройка OpenZeppelin Defender завершена!');
        console.log('='.repeat(50));
        console.log('Sentinel ID:', sentinel.sentinelId);
        console.log('Autotask ID:', autotask.autotaskId);
        console.log('Relayer ID:', relayer.relayerId);
        console.log('='.repeat(50));
        
        console.log('\n📋 Следующие шаги:');
        console.log('1. Добавьте Relayer в MetaMask для автоматических действий');
        console.log('2. Настройте уведомления в Defender Dashboard');
        console.log('3. Проверьте работу Sentinel и Autotask');
        console.log('4. Сохраните Relayer ключи в безопасном месте');
        
    } catch (error) {
        console.error('❌ Ошибка при настройке Defender:', error);
        throw error;
    }
}

// Запускаем настройку только если скрипт вызван напрямую
if (require.main === module) {
    setupDefender()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ Ошибка:', error);
            process.exit(1);
        });
}

module.exports = { setupDefender };
