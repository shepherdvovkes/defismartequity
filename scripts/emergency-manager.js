const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

class EmergencyManager {
    constructor() {
        this.contracts = null;
        this.investment = null;
        this.token = null;
        this.deployer = null;
    }

    async initialize() {
        console.log("🚨 ИНИЦИАЛИЗАЦИЯ ЭКСТРЕННОГО МЕНЕДЖЕРА DEFIMON V2");
        console.log("=".repeat(60));
        
        // Загружаем адреса контрактов
        const contractsPath = path.join(__dirname, "..", "deployed-contracts-v2.json");
        if (!fs.existsSync(contractsPath)) {
            throw new Error("❌ Файл deployed-contracts-v2.json не найден");
        }
        
        this.contracts = JSON.parse(fs.readFileSync(contractsPath, "utf8"));
        
        // Получаем аккаунт
        const [deployer] = await ethers.getSigners();
        this.deployer = deployer;
        
        console.log("Deployer:", deployer.address);
        console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
        
        // Подключаемся к контрактам
        const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
        const DefimonInvestmentV2 = await ethers.getContractFactory("DefimonInvestmentV2");
        
        this.token = DefimonTokenV2.attach(this.contracts.defimonTokenV2);
        this.investment = DefimonInvestmentV2.attach(this.contracts.defimonInvestmentV2);
        
        console.log("\n📋 Информация о контрактах:");
        console.log("Token address:", this.contracts.defimonTokenV2);
        console.log("Investment address:", this.contracts.defimonInvestmentV2);
        
        console.log("✅ Экстренный менеджер инициализирован");
    }

    async getSystemStatus() {
        console.log("\n📊 СТАТУС СИСТЕМЫ:");
        
        // Статус контрактов
        const tokenPaused = await this.token.paused();
        const investmentPaused = await this.investment.paused();
        
        console.log("Token paused:", tokenPaused ? "🔴 YES" : "🟢 NO");
        console.log("Investment paused:", investmentPaused ? "🔴 YES" : "🟢 NO");
        
        // Балансы
        const tokenBalance = await this.token.balanceOf(this.contracts.defimonInvestmentV2);
        const ethBalance = await this.investment.getContractBalance();
        
        console.log("Token balance:", ethers.utils.formatEther(tokenBalance), "DEFI");
        console.log("ETH balance:", ethers.utils.formatEther(ethBalance), "ETH");
        
        // Статистика
        const stats = await this.investment.getContractStats();
        console.log("Total investors:", stats.totalInvestors.toString());
        
        // Лимиты
        const limits = await this.investment.getInvestmentLimits();
        console.log("ETH/USD price:", (limits.currentEthUsdPrice / 100).toFixed(2), "USD");
        
        // Подписанты
        const signers = await this.investment.getSigners();
        console.log("\n👥 Подписанты:");
        console.log("Signer 1:", signers.signer1Address);
        console.log("Signer 2:", signers.signer2Address);
        console.log("Signer 3:", signers.signer3Address);
        
        return {
            tokenPaused,
            investmentPaused,
            tokenBalance,
            ethBalance,
            stats,
            limits,
            signers
        };
    }

    async emergencyPause() {
        console.log("\n🛑 ЭКСТРЕННАЯ ПРИОСТАНОВКА СИСТЕМЫ");
        
        const status = await this.getSystemStatus();
        
        if (status.tokenPaused && status.investmentPaused) {
            console.log("⚠️  Система уже приостановлена!");
            return;
        }
        
        console.log("⚠️  ВНИМАНИЕ: Это приостановит все операции!");
        
        const promises = [];
        
        if (!status.tokenPaused) {
            console.log("Приостановка токена...");
            promises.push(this.token.pause());
        }
        
        if (!status.investmentPaused) {
            console.log("Приостановка инвестиций...");
            promises.push(this.investment.pause());
        }
        
        const txs = await Promise.all(promises);
        
        console.log("⏳ Ожидание подтверждения...");
        const receipts = await Promise.all(txs.map(tx => tx.wait()));
        
        console.log("✅ Система приостановлена!");
        
        for (let i = 0; i < receipts.length; i++) {
            console.log(`Transaction ${i + 1}:`, receipts[i].blockNumber);
        }
        
        await this.logAction('EMERGENCY_PAUSE', {
            tokenPaused: !status.tokenPaused,
            investmentPaused: !status.investmentPaused,
            transactions: txs.map(tx => tx.hash)
        });
    }

    async emergencyUnpause() {
        console.log("\n▶️  СНЯТИЕ ЭКСТРЕННОЙ ПРИОСТАНОВКИ");
        
        const status = await this.getSystemStatus();
        
        if (!status.tokenPaused && !status.investmentPaused) {
            console.log("⚠️  Система не приостановлена!");
            return;
        }
        
        console.log("⚠️  ВНИМАНИЕ: Это восстановит все операции!");
        
        const promises = [];
        
        if (status.tokenPaused) {
            console.log("Снятие приостановки токена...");
            promises.push(this.token.unpause());
        }
        
        if (status.investmentPaused) {
            console.log("Снятие приостановки инвестиций...");
            promises.push(this.investment.unpause());
        }
        
        const txs = await Promise.all(promises);
        
        console.log("⏳ Ожидание подтверждения...");
        const receipts = await Promise.all(txs.map(tx => tx.wait()));
        
        console.log("✅ Система восстановлена!");
        
        for (let i = 0; i < receipts.length; i++) {
            console.log(`Transaction ${i + 1}:`, receipts[i].blockNumber);
        }
        
        await this.logAction('EMERGENCY_UNPAUSE', {
            tokenUnpaused: status.tokenPaused,
            investmentUnpaused: status.investmentPaused,
            transactions: txs.map(tx => tx.hash)
        });
    }

    async emergencyWithdraw(recipient) {
        console.log("\n💰 ЭКСТРЕННЫЙ ВЫВОД СРЕДСТВ");
        
        if (!recipient) {
            console.error("❌ Укажите адрес получателя:");
            console.error("npx hardhat run scripts/emergency-manager.js --network sepolia -- withdraw <address>");
            return;
        }
        
        if (!ethers.utils.isAddress(recipient)) {
            console.error("❌ Неверный адрес получателя:", recipient);
            return;
        }
        
        const status = await this.getSystemStatus();
        
        console.log("Recipient:", recipient);
        console.log("ETH balance:", ethers.utils.formatEther(status.ethBalance), "ETH");
        console.log("Token balance:", ethers.utils.formatEther(status.tokenBalance), "DEFI");
        
        if (status.ethBalance.eq(0) && status.tokenBalance.eq(0)) {
            console.log("⚠️  Нет средств для вывода!");
            return;
        }
        
        console.log("⚠️  ВНИМАНИЕ: Это выведет ВСЕ средства из контракта!");
        
        const promises = [];
        
        if (status.ethBalance.gt(0)) {
            console.log("Вывод ETH...");
            promises.push(this.investment.emergencyWithdraw(recipient));
        }
        
        if (status.tokenBalance.gt(0)) {
            console.log("Вывод токенов...");
            promises.push(this.investment.emergencyWithdrawTokens(recipient, status.tokenBalance));
        }
        
        const txs = await Promise.all(promises);
        
        console.log("⏳ Ожидание подтверждения...");
        const receipts = await Promise.all(txs.map(tx => tx.wait()));
        
        console.log("✅ Средства выведены!");
        
        for (let i = 0; i < receipts.length; i++) {
            console.log(`Transaction ${i + 1}:`, receipts[i].blockNumber);
        }
        
        await this.logAction('EMERGENCY_WITHDRAW', {
            recipient: recipient,
            ethAmount: ethers.utils.formatEther(status.ethBalance),
            tokenAmount: ethers.utils.formatEther(status.tokenBalance),
            transactions: txs.map(tx => tx.hash)
        });
    }

    async blacklistAddress(address, status) {
        console.log(`\n🚫 ${status ? 'ДОБАВЛЕНИЕ В' : 'УДАЛЕНИЕ ИЗ'} ЧЕРНОГО СПИСКА`);
        
        if (!address) {
            console.error("❌ Укажите адрес:");
            console.error("npx hardhat run scripts/emergency-manager.js --network sepolia -- blacklist <address> <true/false>");
            return;
        }
        
        if (!ethers.utils.isAddress(address)) {
            console.error("❌ Неверный адрес:", address);
            return;
        }
        
        console.log("Address:", address);
        console.log("Action:", status ? "BLACKLIST" : "UNBLACKLIST");
        
        // Проверяем текущий статус
        const tokenBlacklisted = await this.token.blacklisted(address);
        const investmentBlacklisted = await this.investment.blacklisted(address);
        
        console.log("Current token blacklist status:", tokenBlacklisted);
        console.log("Current investment blacklist status:", investmentBlacklisted);
        
        if (status && tokenBlacklisted && investmentBlacklisted) {
            console.log("⚠️  Адрес уже в черном списке!");
            return;
        }
        
        if (!status && !tokenBlacklisted && !investmentBlacklisted) {
            console.log("⚠️  Адрес не в черном списке!");
            return;
        }
        
        console.log("⚠️  ВНИМАНИЕ: Это изменит статус адреса в черном списке!");
        
        const promises = [];
        
        if (tokenBlacklisted !== status) {
            console.log(`${status ? 'Добавление в' : 'Удаление из'} черного списка токена...`);
            promises.push(this.token.setBlacklist(address, status));
        }
        
        if (investmentBlacklisted !== status) {
            console.log(`${status ? 'Добавление в' : 'Удаление из'} черного списка инвестиций...`);
            promises.push(this.investment.setBlacklist(address, status));
        }
        
        const txs = await Promise.all(promises);
        
        console.log("⏳ Ожидание подтверждения...");
        const receipts = await Promise.all(txs.map(tx => tx.wait()));
        
        console.log("✅ Статус черного списка обновлен!");
        
        for (let i = 0; i < receipts.length; i++) {
            console.log(`Transaction ${i + 1}:`, receipts[i].blockNumber);
        }
        
        await this.logAction('BLACKLIST_UPDATE', {
            address: address,
            status: status,
            tokenUpdated: tokenBlacklisted !== status,
            investmentUpdated: investmentBlacklisted !== status,
            transactions: txs.map(tx => tx.hash)
        });
    }

    async updatePrice(price) {
        console.log("\n💱 ОБНОВЛЕНИЕ КУРСА ETH/USD");
        
        if (!price) {
            console.error("❌ Укажите цену:");
            console.error("npx hardhat run scripts/emergency-manager.js --network sepolia -- price <price>");
            return;
        }
        
        const newPrice = parseFloat(price);
        if (isNaN(newPrice) || newPrice <= 0) {
            console.error("❌ Неверная цена:", price);
            return;
        }
        
        const currentPrice = await this.investment.ethUsdPrice();
        const newPriceInCents = Math.round(newPrice * 100);
        
        console.log("Current price:", (currentPrice / 100).toFixed(2), "USD");
        console.log("New price:", newPrice.toFixed(2), "USD");
        
        const priceChange = ((newPriceInCents - currentPrice) * 100) / currentPrice;
        console.log("Price change:", priceChange.toFixed(2) + "%");
        
        if (Math.abs(priceChange) > 20) {
            console.log("⚠️  ВНИМАНИЕ: Значительное изменение цены (>20%)!");
        }
        
        console.log("⚠️  ВНИМАНИЕ: Это обновит курс ETH/USD!");
        
        const tx = await this.investment.updateEthUsdPrice(newPriceInCents);
        console.log("Transaction hash:", tx.hash);
        
        console.log("⏳ Ожидание подтверждения...");
        const receipt = await tx.wait();
        
        console.log("✅ Курс обновлен!");
        console.log("Block number:", receipt.blockNumber);
        
        await this.logAction('PRICE_UPDATE', {
            oldPrice: currentPrice.toString(),
            newPrice: newPriceInCents.toString(),
            priceChange: priceChange.toFixed(2),
            transactionHash: tx.hash
        });
    }

    async logAction(action, data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action: action,
            deployer: this.deployer.address,
            ...data
        };
        
        const logPath = path.join(__dirname, "..", "emergency-manager-logs.json");
        let logs = [];
        
        if (fs.existsSync(logPath)) {
            logs = JSON.parse(fs.readFileSync(logPath, "utf8"));
        }
        
        logs.push(logEntry);
        fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
        
        console.log("📄 Действие записано в emergency-manager-logs.json");
    }

    async showHelp() {
        console.log("\n📖 СПРАВКА ПО ЭКСТРЕННОМУ МЕНЕДЖЕРУ");
        console.log("=".repeat(60));
        console.log("Доступные команды:");
        console.log("");
        console.log("📊 status                    - Показать статус системы");
        console.log("🛑 pause                     - Приостановить систему");
        console.log("▶️  unpause                   - Снять приостановку");
        console.log("💰 withdraw <address>        - Экстренный вывод средств");
        console.log("🚫 blacklist <address> <true/false> - Управление черным списком");
        console.log("💱 price <price>             - Обновить курс ETH/USD");
        console.log("📖 help                      - Показать эту справку");
        console.log("");
        console.log("Примеры использования:");
        console.log("npx hardhat run scripts/emergency-manager.js --network sepolia -- status");
        console.log("npx hardhat run scripts/emergency-manager.js --network sepolia -- pause");
        console.log("npx hardhat run scripts/emergency-manager.js --network sepolia -- withdraw 0x...");
        console.log("npx hardhat run scripts/emergency-manager.js --network sepolia -- blacklist 0x... true");
        console.log("npx hardhat run scripts/emergency-manager.js --network sepolia -- price 2500");
    }
}

async function main() {
    const manager = new EmergencyManager();
    
    try {
        await manager.initialize();
        
        const command = process.argv[2];
        const arg1 = process.argv[3];
        const arg2 = process.argv[4];
        
        switch (command) {
            case 'status':
                await manager.getSystemStatus();
                break;
            case 'pause':
                await manager.emergencyPause();
                break;
            case 'unpause':
                await manager.emergencyUnpause();
                break;
            case 'withdraw':
                await manager.emergencyWithdraw(arg1);
                break;
            case 'blacklist':
                await manager.blacklistAddress(arg1, arg2 === 'true');
                break;
            case 'price':
                await manager.updatePrice(arg1);
                break;
            case 'help':
                await manager.showHelp();
                break;
            default:
                console.error("❌ Неизвестная команда:", command);
                await manager.showHelp();
                process.exit(1);
        }
        
    } catch (error) {
        console.error("❌ Ошибка в экстренном менеджере:", error);
        process.exit(1);
    }
}

// Запускаем менеджер
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Критическая ошибка:", error);
            process.exit(1);
        });
}

module.exports = { EmergencyManager };
