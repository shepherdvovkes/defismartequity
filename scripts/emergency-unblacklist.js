const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // Получаем адрес из аргументов командной строки
    const targetAddress = process.argv[2];
    
    if (!targetAddress) {
        console.error("❌ Укажите адрес для удаления из черного списка:");
        console.error("npx hardhat run scripts/emergency-unblacklist.js --network sepolia -- 0x...");
        process.exit(1);
    }
    
    // Проверяем валидность адреса
    if (!ethers.utils.isAddress(targetAddress)) {
        console.error("❌ Неверный формат адреса:", targetAddress);
        process.exit(1);
    }
    
    console.log("🔓 УДАЛЕНИЕ ИЗ ЧЕРНОГО СПИСКА DEFIMON V2");
    console.log("=".repeat(60));
    console.log("Target address:", targetAddress);
    
    // Загружаем адреса контрактов
    const contractsPath = path.join(__dirname, "..", "deployed-contracts-v2.json");
    if (!fs.existsSync(contractsPath)) {
        throw new Error("❌ Файл deployed-contracts-v2.json не найден");
    }
    
    const contracts = JSON.parse(fs.readFileSync(contractsPath, "utf8"));
    
    // Получаем аккаунт
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
    
    // Подключаемся к контрактам
    const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
    const DefimonInvestmentV2 = await ethers.getContractFactory("DefimonInvestmentV2");
    
    const token = DefimonTokenV2.attach(contracts.defimonTokenV2);
    const investment = DefimonInvestmentV2.attach(contracts.defimonInvestmentV2);
    
    console.log("\n📋 Информация о контрактах:");
    console.log("Token address:", contracts.defimonTokenV2);
    console.log("Investment address:", contracts.defimonInvestmentV2);
    
    // Проверяем текущий статус адреса в токене
    const isTokenBlacklisted = await token.blacklisted(targetAddress);
    console.log("Token blacklist status:", isTokenBlacklisted);
    
    // Проверяем текущий статус адреса в инвестиционном контракте
    const isInvestmentBlacklisted = await investment.blacklisted(targetAddress);
    console.log("Investment blacklist status:", isInvestmentBlacklisted);
    
    if (!isTokenBlacklisted && !isInvestmentBlacklisted) {
        console.log("⚠️  Адрес не находится в черном списке!");
        return;
    }
    
    // Получаем информацию о токене
    const tokenInfo = await token.getTokenInfo();
    console.log("Token name:", tokenInfo.tokenName);
    console.log("Token symbol:", tokenInfo.tokenSymbol);
    
    // Проверяем баланс адреса
    const tokenBalance = await token.balanceOf(targetAddress);
    console.log("Target address token balance:", ethers.utils.formatEther(tokenBalance), "DEFI");
    
    // Получаем информацию об инвесторе
    const investorInfo = await investment.getInvestorInfo(targetAddress);
    console.log("Investor total invested:", ethers.utils.formatEther(investorInfo.totalInvested), "ETH");
    console.log("Investor total tokens:", ethers.utils.formatEther(investorInfo.totalTokens), "DEFI");
    
    // Подтверждение действия
    console.log("\n⚠️  ВНИМАНИЕ: Это действие разблокирует адрес!");
    console.log("Разблокированный адрес сможет:");
    console.log("- Переводить токены");
    console.log("- Получать токены");
    console.log("- Участвовать в инвестициях");
    
    // Удаляем из черного списка токена
    if (isTokenBlacklisted) {
        console.log("\n🔓 Удаление адреса из черного списка токена...");
        const tokenTx = await token.setBlacklist(targetAddress, false);
        console.log("Token transaction hash:", tokenTx.hash);
        
        // Ждем подтверждения
        console.log("⏳ Ожидание подтверждения токена...");
        const tokenReceipt = await tokenTx.wait();
        console.log("✅ Адрес успешно удален из черного списка токена!");
        console.log("Token block number:", tokenReceipt.blockNumber);
        console.log("Token gas used:", tokenReceipt.gasUsed.toString());
    }
    
    // Удаляем из черного списка инвестиционного контракта
    if (isInvestmentBlacklisted) {
        console.log("\n🔓 Удаление адреса из черного списка инвестиций...");
        const investmentTx = await investment.setBlacklist(targetAddress, false);
        console.log("Investment transaction hash:", investmentTx.hash);
        
        // Ждем подтверждения
        console.log("⏳ Ожидание подтверждения инвестиций...");
        const investmentReceipt = await investmentTx.wait();
        console.log("✅ Адрес успешно удален из черного списка инвестиций!");
        console.log("Investment block number:", investmentReceipt.blockNumber);
        console.log("Investment gas used:", investmentReceipt.gasUsed.toString());
    }
    
    // Проверяем финальный статус
    const finalTokenStatus = await token.blacklisted(targetAddress);
    const finalInvestmentStatus = await investment.blacklisted(targetAddress);
    console.log("\n📊 Финальный статус:");
    console.log("Token blacklist status:", finalTokenStatus);
    console.log("Investment blacklist status:", finalInvestmentStatus);
    
    // Логируем действие
    const logEntry = {
        timestamp: new Date().toISOString(),
        action: "EMERGENCY_UNBLACKLIST",
        contracts: {
            token: contracts.defimonTokenV2,
            investment: contracts.defimonInvestmentV2
        },
        targetAddress: targetAddress,
        deployer: deployer.address,
        transactions: {
            token: isTokenBlacklisted ? tokenTx.hash : null,
            investment: isInvestmentBlacklisted ? investmentTx.hash : null
        },
        blockNumbers: {
            token: isTokenBlacklisted ? tokenReceipt.blockNumber : null,
            investment: isInvestmentBlacklisted ? investmentReceipt.blockNumber : null
        },
        gasUsed: {
            token: isTokenBlacklisted ? tokenReceipt.gasUsed.toString() : null,
            investment: isInvestmentBlacklisted ? investmentReceipt.gasUsed.toString() : null
        },
        targetBalance: ethers.utils.formatEther(tokenBalance),
        investorInfo: {
            totalInvested: ethers.utils.formatEther(investorInfo.totalInvested),
            totalTokens: ethers.utils.formatEther(investorInfo.totalTokens),
            investmentCount: investorInfo.investmentCount.toString()
        },
        reason: "Address unblacklisted after security review"
    };
    
    const logPath = path.join(__dirname, "..", "emergency-logs.json");
    let logs = [];
    
    if (fs.existsSync(logPath)) {
        logs = JSON.parse(fs.readFileSync(logPath, "utf8"));
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    
    console.log("\n📄 Действие записано в emergency-logs.json");
    
    // Уведомления
    console.log("\n📢 СЛЕДУЮЩИЕ ШАГИ:");
    console.log("1. Уведомите команду безопасности о разблокировке");
    console.log("2. Проведите мониторинг активности адреса");
    console.log("3. Убедитесь, что причина блокировки устранена");
    console.log("4. Обновите документацию по безопасности");
    
    console.log("\n📊 Для проверки статуса используйте:");
    console.log(`npx hardhat run scripts/check-blacklist-status.js --network sepolia -- ${targetAddress}`);
    
    console.log("\n🔍 Для мониторинга активности используйте:");
    console.log("npx hardhat run scripts/suspicious-activity-monitor.js --network sepolia");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Ошибка при удалении из черного списка:", error);
        process.exit(1);
    });
