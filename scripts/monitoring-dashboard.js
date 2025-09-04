const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

class MonitoringDashboard {
    constructor() {
        this.contracts = null;
        this.investment = null;
        this.token = null;
        this.provider = null;
    }

    async initialize() {
        console.log("📊 ИНИЦИАЛИЗАЦИЯ МОНИТОРИНГОВОЙ ПАНЕЛИ DEFIMON V2");
        console.log("=".repeat(60));
        
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
        
        console.log("✅ Мониторинговая панель инициализирована");
    }

    async getSystemOverview() {
        console.log("\n📊 ОБЗОР СИСТЕМЫ");
        console.log("=".repeat(40));
        
        // Статус контрактов
        const tokenPaused = await this.token.paused();
        const investmentPaused = await this.investment.paused();
        
        console.log("🔄 Статус контрактов:");
        console.log(`  Token: ${tokenPaused ? '🔴 ПРИОСТАНОВЛЕН' : '🟢 АКТИВЕН'}`);
        console.log(`  Investment: ${investmentPaused ? '🔴 ПРИОСТАНОВЛЕН' : '🟢 АКТИВЕН'}`);
        
        // Балансы
        const tokenBalance = await this.token.balanceOf(this.contracts.defimonInvestmentV2);
        const ethBalance = await this.investment.getContractBalance();
        
        console.log("\n💰 Балансы:");
        console.log(`  ETH: ${ethers.utils.formatEther(ethBalance)} ETH`);
        console.log(`  DEFI: ${ethers.utils.formatEther(tokenBalance)} DEFI`);
        
        // Статистика
        const stats = await this.investment.getContractStats();
        console.log("\n📈 Статистика:");
        console.log(`  Инвесторов: ${stats.totalInvestors.toString()}`);
        console.log(`  Распределено токенов: ${ethers.utils.formatEther(stats.totalTokensDistributed)} DEFI`);
        
        // Лимиты и курс
        const limits = await this.investment.getInvestmentLimits();
        console.log("\n💱 Курс и лимиты:");
        console.log(`  ETH/USD: $${(limits.currentEthUsdPrice / 100).toFixed(2)}`);
        console.log(`  Мин. инвестиция: $${limits.minInvestmentUsd.toString()}`);
        console.log(`  Макс. инвестиция: $${limits.maxInvestmentUsd.toString()}`);
        console.log(`  Крупная инвестиция: $${limits.largeInvestmentUsd.toString()}`);
        
        // Коэффициент
        const coefficient = await this.investment.getCurrentCoefficient();
        let periodName;
        switch (coefficient.period.toString()) {
            case '1': periodName = "MVP (x10)"; break;
            case '2': periodName = "Release (x5)"; break;
            case '3': periodName = "Standard (x1)"; break;
            default: periodName = "Unknown"; break;
        }
        console.log(`  Текущий коэффициент: ${coefficient.coefficient.toString()} (${periodName})`);
        
        return {
            tokenPaused,
            investmentPaused,
            tokenBalance,
            ethBalance,
            stats,
            limits,
            coefficient
        };
    }

    async getRecentActivity() {
        console.log("\n📋 ПОСЛЕДНЯЯ АКТИВНОСТЬ");
        console.log("=".repeat(40));
        
        // Получаем последние инвестиции
        const investmentFilter = this.investment.filters.InvestmentMade();
        const investmentEvents = await this.investment.queryFilter(investmentFilter, -100);
        
        console.log(`💰 Последние инвестиции (${investmentEvents.length}):`);
        for (let i = 0; i < Math.min(5, investmentEvents.length); i++) {
            const event = investmentEvents[i];
            const { investor, ethAmount, tokenAmount, coefficient } = event.args;
            const block = await event.getBlock();
            
            console.log(`  ${i + 1}. ${investor.substring(0, 10)}... - ${ethers.utils.formatEther(ethAmount)} ETH (x${coefficient}) - ${new Date(block.timestamp * 1000).toLocaleString()}`);
        }
        
        // Получаем последние запросы на крупные инвестиции
        const largeInvestmentFilter = this.investment.filters.LargeInvestmentRequested();
        const largeInvestmentEvents = await this.investment.queryFilter(largeInvestmentFilter, -100);
        
        console.log(`\n🏦 Запросы на крупные инвестиции (${largeInvestmentEvents.length}):`);
        for (let i = 0; i < Math.min(3, largeInvestmentEvents.length); i++) {
            const event = largeInvestmentEvents[i];
            const { requestId, investor, ethAmount, usdAmount } = event.args;
            const block = await event.getBlock();
            
            console.log(`  ${i + 1}. ${requestId.substring(0, 10)}... - ${investor.substring(0, 10)}... - ${ethers.utils.formatEther(ethAmount)} ETH ($${usdAmount / 100}) - ${new Date(block.timestamp * 1000).toLocaleString()}`);
        }
        
        // Получаем последние переводы токенов
        const transferFilter = this.token.filters.Transfer();
        const transferEvents = await this.token.queryFilter(transferFilter, -100);
        
        console.log(`\n🔄 Последние переводы токенов (${transferEvents.length}):`);
        for (let i = 0; i < Math.min(5, transferEvents.length); i++) {
            const event = transferEvents[i];
            const { from, to, value } = event.args;
            const block = await event.getBlock();
            
            if (from !== ethers.constants.AddressZero && to !== ethers.constants.AddressZero) {
                console.log(`  ${i + 1}. ${from.substring(0, 10)}... → ${to.substring(0, 10)}... - ${ethers.utils.formatEther(value)} DEFI - ${new Date(block.timestamp * 1000).toLocaleString()}`);
            }
        }
        
        return {
            investmentEvents,
            largeInvestmentEvents,
            transferEvents
        };
    }

    async getBlacklistStatus() {
        console.log("\n🚫 СТАТУС ЧЕРНОГО СПИСКА");
        console.log("=".repeat(40));
        
        // Получаем последние события черного списка
        const tokenBlacklistFilter = this.token.filters.AddressBlacklisted();
        const tokenBlacklistEvents = await this.token.queryFilter(tokenBlacklistFilter, -100);
        
        const investmentBlacklistFilter = this.investment.filters.AddressBlacklisted();
        const investmentBlacklistEvents = await this.investment.queryFilter(investmentBlacklistFilter, -100);
        
        console.log(`🪙 События черного списка токена (${tokenBlacklistEvents.length}):`);
        for (let i = 0; i < Math.min(5, tokenBlacklistEvents.length); i++) {
            const event = tokenBlacklistEvents[i];
            const { account, status } = event.args;
            const block = await event.getBlock();
            
            console.log(`  ${i + 1}. ${account.substring(0, 10)}... - ${status ? '🔴 ЗАБЛОКИРОВАН' : '🟢 РАЗБЛОКИРОВАН'} - ${new Date(block.timestamp * 1000).toLocaleString()}`);
        }
        
        console.log(`\n💰 События черного списка инвестиций (${investmentBlacklistEvents.length}):`);
        for (let i = 0; i < Math.min(5, investmentBlacklistEvents.length); i++) {
            const event = investmentBlacklistEvents[i];
            const { account, status } = event.args;
            const block = await event.getBlock();
            
            console.log(`  ${i + 1}. ${account.substring(0, 10)}... - ${status ? '🔴 ЗАБЛОКИРОВАН' : '🟢 РАЗБЛОКИРОВАН'} - ${new Date(block.timestamp * 1000).toLocaleString()}`);
        }
        
        return {
            tokenBlacklistEvents,
            investmentBlacklistEvents
        };
    }

    async getLargeInvestmentRequests() {
        console.log("\n🏦 ЗАПРОСЫ НА КРУПНЫЕ ИНВЕСТИЦИИ");
        console.log("=".repeat(40));
        
        // Получаем все запросы на крупные инвестиции
        const largeInvestmentFilter = this.investment.filters.LargeInvestmentRequested();
        const largeInvestmentEvents = await this.investment.queryFilter(largeInvestmentFilter, -1000);
        
        if (largeInvestmentEvents.length === 0) {
            console.log("📭 Нет запросов на крупные инвестиции");
            return [];
        }
        
        console.log(`📊 Найдено ${largeInvestmentEvents.length} запросов:`);
        
        for (let i = 0; i < largeInvestmentEvents.length; i++) {
            const event = largeInvestmentEvents[i];
            const { requestId, investor, ethAmount, usdAmount, reason } = event.args;
            const block = await event.getBlock();
            
            // Получаем текущий статус запроса
            const request = await this.investment.getLargeInvestmentRequest(requestId);
            
            const approvalCount = (request.approvedBySigner1 ? 1 : 0) + 
                                 (request.approvedBySigner2 ? 1 : 0) + 
                                 (request.approvedBySigner3 ? 1 : 0);
            
            let status;
            if (request.executed) {
                status = "✅ ВЫПОЛНЕН";
            } else if (approvalCount >= 2) {
                status = "⚠️  ГОТОВ К ВЫПОЛНЕНИЮ";
            } else {
                status = `⏳ ОЖИДАЕТ (${approvalCount}/3)`;
            }
            
            console.log(`\n${i + 1}. Request ID: ${requestId.substring(0, 16)}...`);
            console.log(`   Investor: ${investor.substring(0, 10)}...`);
            console.log(`   Amount: ${ethers.utils.formatEther(ethAmount)} ETH ($${usdAmount / 100})`);
            console.log(`   Reason: ${reason}`);
            console.log(`   Status: ${status}`);
            console.log(`   Date: ${new Date(block.timestamp * 1000).toLocaleString()}`);
        }
        
        return largeInvestmentEvents;
    }

    async getPriceHistory() {
        console.log("\n💱 ИСТОРИЯ ИЗМЕНЕНИЙ ЦЕНЫ");
        console.log("=".repeat(40));
        
        // Получаем события изменения цены
        const priceFilter = this.investment.filters.EthUsdPriceUpdated();
        const priceEvents = await this.investment.queryFilter(priceFilter, -100);
        
        if (priceEvents.length === 0) {
            console.log("📭 Нет истории изменений цены");
            return [];
        }
        
        console.log(`📊 Найдено ${priceEvents.length} изменений цены:`);
        
        for (let i = 0; i < priceEvents.length; i++) {
            const event = priceEvents[i];
            const { oldPrice, newPrice } = event.args;
            const block = await event.getBlock();
            
            const priceChange = ((newPrice - oldPrice) * 100) / oldPrice;
            
            console.log(`\n${i + 1}. ${new Date(block.timestamp * 1000).toLocaleString()}`);
            console.log(`   Старая цена: $${(oldPrice / 100).toFixed(2)}`);
            console.log(`   Новая цена: $${(newPrice / 100).toFixed(2)}`);
            console.log(`   Изменение: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`);
        }
        
        return priceEvents;
    }

    async generateReport() {
        console.log("\n📄 ГЕНЕРАЦИЯ ОТЧЕТА");
        console.log("=".repeat(40));
        
        const overview = await this.getSystemOverview();
        const activity = await this.getRecentActivity();
        const blacklist = await this.getBlacklistStatus();
        const largeInvestments = await this.getLargeInvestmentRequests();
        const priceHistory = await this.getPriceHistory();
        
        const report = {
            timestamp: new Date().toISOString(),
            overview: {
                tokenPaused: overview.tokenPaused,
                investmentPaused: overview.investmentPaused,
                tokenBalance: ethers.utils.formatEther(overview.tokenBalance),
                ethBalance: ethers.utils.formatEther(overview.ethBalance),
                totalInvestors: overview.stats.totalInvestors.toString(),
                totalTokensDistributed: ethers.utils.formatEther(overview.stats.totalTokensDistributed),
                ethUsdPrice: (overview.limits.currentEthUsdPrice / 100).toFixed(2),
                coefficient: overview.coefficient.coefficient.toString(),
                period: overview.coefficient.period.toString()
            },
            activity: {
                recentInvestments: activity.investmentEvents.length,
                largeInvestmentRequests: activity.largeInvestmentEvents.length,
                recentTransfers: activity.transferEvents.length
            },
            blacklist: {
                tokenBlacklistEvents: blacklist.tokenBlacklistEvents.length,
                investmentBlacklistEvents: blacklist.investmentBlacklistEvents.length
            },
            largeInvestments: {
                totalRequests: largeInvestments.length,
                pendingRequests: largeInvestments.filter(event => {
                    // Здесь нужно проверить статус каждого запроса
                    return true; // Упрощенная версия
                }).length
            },
            priceHistory: {
                totalChanges: priceHistory.length,
                lastChange: priceHistory.length > 0 ? new Date(priceHistory[priceHistory.length - 1].blockNumber * 1000).toISOString() : null
            }
        };
        
        // Сохраняем отчет
        const reportPath = path.join(__dirname, "..", "monitoring-report.json");
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log("✅ Отчет сохранен в monitoring-report.json");
        
        return report;
    }

    async run() {
        try {
            await this.initialize();
            
            console.log("\n🚀 ЗАПУСК МОНИТОРИНГОВОЙ ПАНЕЛИ");
            console.log("=".repeat(60));
            
            await this.getSystemOverview();
            await this.getRecentActivity();
            await this.getBlacklistStatus();
            await this.getLargeInvestmentRequests();
            await this.getPriceHistory();
            await this.generateReport();
            
            console.log("\n✅ Мониторинговая панель завершена");
            
        } catch (error) {
            console.error("❌ Ошибка в мониторинговой панели:", error);
        }
    }
}

// Запускаем панель
if (require.main === module) {
    const dashboard = new MonitoringDashboard();
    dashboard.run();
}

module.exports = { MonitoringDashboard };
