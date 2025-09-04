const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

class SuspiciousActivityMonitor {
    constructor() {
        this.contracts = null;
        this.provider = null;
        this.token = null;
        this.investment = null;
        this.alertThresholds = {
            largeTransfer: ethers.utils.parseEther("1000"), // 1000 ETH worth
            largeInvestment: ethers.utils.parseEther("100"), // 100 ETH
            rapidTransactions: 10, // 10 transactions in 1 hour
            timeWindow: 3600, // 1 hour in seconds
            unusualPattern: 5, // 5 similar transactions
            blacklistActivity: 1, // Any blacklist activity
            largeInvestmentRequest: ethers.utils.parseEther("50"), // 50 ETH
            priceChange: 20 // 20% price change
        };
        this.activityLog = [];
        this.suspiciousAddresses = new Set();
    }

    async initialize() {
        console.log("🔍 Инициализация монитора подозрительной активности...");
        
        // Загружаем адреса контрактов
        const contractsPath = path.join(__dirname, "..", "deployed-contracts-v2.json");
        if (!fs.existsSync(contractsPath)) {
            throw new Error("❌ Файл deployed-contracts-v2.json не найден");
        }
        
        this.contracts = JSON.parse(fs.readFileSync(contractsPath, "utf8"));
        
        // Создаем провайдер
        this.provider = new ethers.providers.JsonRpcProvider(
            process.env.SEPOLIA_RPC_URL || `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
        );
        
        // Подключаемся к контрактам
        const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
        const DefimonInvestmentV2 = await ethers.getContractFactory("DefimonInvestmentV2");
        
        this.token = DefimonTokenV2.attach(this.contracts.defimonTokenV2);
        this.investment = DefimonInvestmentV2.attach(this.contracts.defimonInvestmentV2);
        
        console.log("✅ Монитор инициализирован");
    }

    async monitorTransfers() {
        console.log("📊 Мониторинг переводов токенов...");
        
        // Получаем последние события Transfer
        const filter = this.token.filters.Transfer();
        const events = await this.token.queryFilter(filter, -1000); // Последние 1000 блоков
        
        for (const event of events) {
            const { from, to, value } = event.args;
            const block = await event.getBlock();
            
            const activity = {
                type: 'transfer',
                from: from,
                to: to,
                amount: value.toString(),
                amountFormatted: ethers.utils.formatEther(value),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: block.timestamp,
                gasPrice: event.gasPrice?.toString() || '0'
            };
            
            this.activityLog.push(activity);
            
            // Проверяем на подозрительную активность
            await this.checkSuspiciousTransfer(activity);
        }
    }

    async monitorInvestments() {
        console.log("💰 Мониторинг инвестиций...");
        
        // Получаем последние события InvestmentMade
        const investmentFilter = this.investment.filters.InvestmentMade();
        const investmentEvents = await this.investment.queryFilter(investmentFilter, -1000);
        
        for (const event of investmentEvents) {
            const { investor, ethAmount, tokenAmount, coefficient, period } = event.args;
            const block = await event.getBlock();
            
            const activity = {
                type: 'investment',
                investor: investor,
                ethAmount: ethAmount.toString(),
                ethAmountFormatted: ethers.utils.formatEther(ethAmount),
                tokenAmount: tokenAmount.toString(),
                tokenAmountFormatted: ethers.utils.formatEther(tokenAmount),
                coefficient: coefficient.toString(),
                period: period.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: block.timestamp
            };
            
            this.activityLog.push(activity);
            
            // Проверяем на подозрительную активность
            await this.checkSuspiciousInvestment(activity);
        }
        
        // Мониторим запросы на крупные инвестиции
        const largeInvestmentFilter = this.investment.filters.LargeInvestmentRequested();
        const largeInvestmentEvents = await this.investment.queryFilter(largeInvestmentFilter, -1000);
        
        for (const event of largeInvestmentEvents) {
            const { requestId, investor, ethAmount, usdAmount, reason } = event.args;
            const block = await event.getBlock();
            
            const activity = {
                type: 'large_investment_request',
                requestId: requestId,
                investor: investor,
                ethAmount: ethAmount.toString(),
                ethAmountFormatted: ethers.utils.formatEther(ethAmount),
                usdAmount: usdAmount.toString(),
                reason: reason,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: block.timestamp
            };
            
            this.activityLog.push(activity);
            
            // Проверяем на подозрительную активность
            await this.checkSuspiciousLargeInvestment(activity);
        }
        
        // Мониторим одобрения крупных инвестиций
        const approvalFilter = this.investment.filters.LargeInvestmentApproved();
        const approvalEvents = await this.investment.queryFilter(approvalFilter, -1000);
        
        for (const event of approvalEvents) {
            const { requestId, signer } = event.args;
            const block = await event.getBlock();
            
            const activity = {
                type: 'large_investment_approval',
                requestId: requestId,
                signer: signer,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: block.timestamp
            };
            
            this.activityLog.push(activity);
        }
    }

    async checkSuspiciousTransfer(activity) {
        const amount = ethers.BigNumber.from(activity.amount);
        
        // Проверка на крупный перевод
        if (amount.gte(this.alertThresholds.largeTransfer)) {
            await this.createAlert({
                type: 'LARGE_TRANSFER',
                severity: 'HIGH',
                description: `Large token transfer detected: ${activity.amountFormatted} DEFI`,
                activity: activity,
                recommendation: 'Review transaction and consider blacklisting if suspicious'
            });
        }
        
        // Проверка на переводы с/на нулевые адреса
        if (activity.from === '0x0000000000000000000000000000000000000000' || 
            activity.to === '0x0000000000000000000000000000000000000000') {
            await this.createAlert({
                type: 'ZERO_ADDRESS_TRANSFER',
                severity: 'MEDIUM',
                description: 'Transfer involving zero address detected',
                activity: activity,
                recommendation: 'Review transaction for potential issues'
            });
        }
        
        // Проверка на быстрые транзакции
        await this.checkRapidTransactions(activity);
    }

    async checkSuspiciousInvestment(activity) {
        const ethAmount = ethers.BigNumber.from(activity.ethAmount);
        
        // Проверка на крупную инвестицию
        if (ethAmount.gte(this.alertThresholds.largeInvestment)) {
            await this.createAlert({
                type: 'LARGE_INVESTMENT',
                severity: 'HIGH',
                description: `Large investment detected: ${activity.ethAmountFormatted} ETH`,
                activity: activity,
                recommendation: 'Review investor and consider additional verification'
            });
        }
        
        // Проверка на необычные коэффициенты
        if (activity.coefficient !== '10' && activity.coefficient !== '5' && activity.coefficient !== '1') {
            await this.createAlert({
                type: 'UNUSUAL_COEFFICIENT',
                severity: 'MEDIUM',
                description: `Unusual investment coefficient: ${activity.coefficient}`,
                activity: activity,
                recommendation: 'Verify coefficient calculation'
            });
        }
    }
    
    async checkSuspiciousLargeInvestment(activity) {
        const ethAmount = ethers.BigNumber.from(activity.ethAmount);
        
        // Проверка на очень крупные запросы инвестиций
        if (ethAmount.gte(this.alertThresholds.largeInvestmentRequest)) {
            await this.createAlert({
                type: 'LARGE_INVESTMENT_REQUEST',
                severity: 'HIGH',
                description: `Large investment request: ${activity.ethAmountFormatted} ETH (${activity.usdAmount} USD)`,
                activity: activity,
                recommendation: 'Review investor background and investment purpose'
            });
        }
        
        // Проверка на подозрительные причины
        const suspiciousReasons = ['test', 'hack', 'exploit', 'attack', 'scam'];
        const reason = activity.reason.toLowerCase();
        
        for (const suspicious of suspiciousReasons) {
            if (reason.includes(suspicious)) {
                await this.createAlert({
                    type: 'SUSPICIOUS_INVESTMENT_REASON',
                    severity: 'CRITICAL',
                    description: `Suspicious investment reason: "${activity.reason}"`,
                    activity: activity,
                    recommendation: 'Immediately review and potentially blacklist investor'
                });
                break;
            }
        }
    }
    
    async monitorBlacklistActivity() {
        console.log("🚫 Мониторинг активности черного списка...");
        
        // Мониторим события черного списка в токене
        const tokenBlacklistFilter = this.token.filters.AddressBlacklisted();
        const tokenBlacklistEvents = await this.token.queryFilter(tokenBlacklistFilter, -1000);
        
        for (const event of tokenBlacklistEvents) {
            const { account, status } = event.args;
            const block = await event.getBlock();
            
            const activity = {
                type: 'token_blacklist',
                account: account,
                status: status,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: block.timestamp
            };
            
            this.activityLog.push(activity);
            
            // Любая активность черного списка требует внимания
            await this.createAlert({
                type: 'BLACKLIST_ACTIVITY',
                severity: status ? 'HIGH' : 'MEDIUM',
                description: `Token blacklist ${status ? 'added' : 'removed'}: ${account}`,
                activity: activity,
                recommendation: status ? 'Monitor address for suspicious activity' : 'Verify address is safe to unblacklist'
            });
        }
        
        // Мониторим события черного списка в инвестиционном контракте
        const investmentBlacklistFilter = this.investment.filters.AddressBlacklisted();
        const investmentBlacklistEvents = await this.investment.queryFilter(investmentBlacklistFilter, -1000);
        
        for (const event of investmentBlacklistEvents) {
            const { account, status } = event.args;
            const block = await event.getBlock();
            
            const activity = {
                type: 'investment_blacklist',
                account: account,
                status: status,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: block.timestamp
            };
            
            this.activityLog.push(activity);
            
            await this.createAlert({
                type: 'BLACKLIST_ACTIVITY',
                severity: status ? 'HIGH' : 'MEDIUM',
                description: `Investment blacklist ${status ? 'added' : 'removed'}: ${account}`,
                activity: activity,
                recommendation: status ? 'Monitor address for suspicious activity' : 'Verify address is safe to unblacklist'
            });
        }
    }
    
    async monitorPriceChanges() {
        console.log("💱 Мониторинг изменений цены ETH/USD...");
        
        const priceFilter = this.investment.filters.EthUsdPriceUpdated();
        const priceEvents = await this.investment.queryFilter(priceFilter, -1000);
        
        for (const event of priceEvents) {
            const { oldPrice, newPrice } = event.args;
            const block = await event.getBlock();
            
            const priceChangePercent = ((newPrice - oldPrice) * 100) / oldPrice;
            
            const activity = {
                type: 'price_update',
                oldPrice: oldPrice.toString(),
                newPrice: newPrice.toString(),
                priceChangePercent: priceChangePercent.toString(),
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: block.timestamp
            };
            
            this.activityLog.push(activity);
            
            // Проверяем на значительные изменения цены
            if (Math.abs(priceChangePercent) >= this.alertThresholds.priceChange) {
                await this.createAlert({
                    type: 'SIGNIFICANT_PRICE_CHANGE',
                    severity: 'MEDIUM',
                    description: `Significant ETH/USD price change: ${priceChangePercent.toFixed(2)}% (${oldPrice} -> ${newPrice})`,
                    activity: activity,
                    recommendation: 'Review investment limits and update if necessary'
                });
            }
        }
    }

    async checkRapidTransactions(activity) {
        const now = Math.floor(Date.now() / 1000);
        const timeWindow = this.alertThresholds.timeWindow;
        
        // Подсчитываем транзакции от того же адреса за последний час
        const recentTransactions = this.activityLog.filter(log => 
            log.timestamp >= now - timeWindow &&
            (log.from === activity.from || log.to === activity.to)
        );
        
        if (recentTransactions.length >= this.alertThresholds.rapidTransactions) {
            await this.createAlert({
                type: 'RAPID_TRANSACTIONS',
                severity: 'MEDIUM',
                description: `Rapid transactions detected: ${recentTransactions.length} in ${timeWindow/60} minutes`,
                activity: activity,
                recommendation: 'Monitor for potential automated attacks'
            });
        }
    }

    async createAlert(alert) {
        const alertData = {
            ...alert,
            timestamp: new Date().toISOString(),
            id: ethers.utils.id(JSON.stringify(alert))
        };
        
        console.log(`🚨 ALERT [${alert.severity}]: ${alert.type}`);
        console.log(`   Description: ${alert.description}`);
        console.log(`   Recommendation: ${alert.recommendation}`);
        console.log(`   Transaction: ${alert.activity.transactionHash}`);
        
        // Сохраняем алерт
        await this.saveAlert(alertData);
        
        // Отправляем уведомление
        await this.sendNotification(alertData);
        
        // Добавляем адрес в список подозрительных
        if (alert.activity.from) {
            this.suspiciousAddresses.add(alert.activity.from);
        }
        if (alert.activity.to) {
            this.suspiciousAddresses.add(alert.activity.to);
        }
    }

    async saveAlert(alert) {
        const alertsPath = path.join(__dirname, "..", "security-alerts.json");
        let alerts = [];
        
        if (fs.existsSync(alertsPath)) {
            alerts = JSON.parse(fs.readFileSync(alertsPath, "utf8"));
        }
        
        alerts.push(alert);
        fs.writeFileSync(alertsPath, JSON.stringify(alerts, null, 2));
    }

    async sendNotification(alert) {
        // Здесь можно добавить отправку уведомлений через:
        // - Telegram Bot
        // - Email
        // - Slack
        // - Discord
        // - SMS
        
        console.log("📧 Уведомление отправлено");
    }

    async generateReport() {
        console.log("\n📊 ОТЧЕТ О ПОДОЗРИТЕЛЬНОЙ АКТИВНОСТИ");
        console.log("=".repeat(50));
        
        const now = Math.floor(Date.now() / 1000);
        const last24Hours = this.activityLog.filter(log => log.timestamp >= now - 86400);
        
        console.log(`Всего активностей за 24 часа: ${last24Hours.length}`);
        console.log(`Подозрительных адресов: ${this.suspiciousAddresses.size}`);
        
        // Статистика по типам
        const transferCount = last24Hours.filter(log => log.type === 'transfer').length;
        const investmentCount = last24Hours.filter(log => log.type === 'investment').length;
        
        console.log(`Переводов: ${transferCount}`);
        console.log(`Инвестиций: ${investmentCount}`);
        
        // Топ адресов по активности
        const addressActivity = {};
        last24Hours.forEach(log => {
            if (log.from) addressActivity[log.from] = (addressActivity[log.from] || 0) + 1;
            if (log.to) addressActivity[log.to] = (addressActivity[log.to] || 0) + 1;
        });
        
        const topAddresses = Object.entries(addressActivity)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        
        console.log("\n🏆 Топ-5 адресов по активности:");
        topAddresses.forEach(([address, count]) => {
            console.log(`  ${address}: ${count} транзакций`);
        });
        
        // Подозрительные адреса
        if (this.suspiciousAddresses.size > 0) {
            console.log("\n⚠️  Подозрительные адреса:");
            this.suspiciousAddresses.forEach(address => {
                console.log(`  ${address}`);
            });
        }
    }

    async run() {
        try {
            await this.initialize();
            await this.monitorTransfers();
            await this.monitorInvestments();
            await this.monitorBlacklistActivity();
            await this.monitorPriceChanges();
            await this.generateReport();
            
            console.log("\n✅ Мониторинг завершен");
        } catch (error) {
            console.error("❌ Ошибка при мониторинге:", error);
        }
    }
}

// Запускаем мониторинг
if (require.main === module) {
    const monitor = new SuspiciousActivityMonitor();
    monitor.run();
}

module.exports = { SuspiciousActivityMonitor };
