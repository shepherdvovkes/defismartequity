const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("ЭКСТРЕННАЯ ПРИОСТАНОВКА ИНВЕСТИЦИОННОГО КОНТРАКТА DEFIMON V2");
    console.log("=".repeat(60));
    
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
    
    // Подключаемся к контракту инвестиций
    const DefimonInvestmentV2 = await ethers.getContractFactory("DefimonInvestmentV2");
    const investment = DefimonInvestmentV2.attach(contracts.defimonInvestmentV2);
    
    console.log("\n📋 Информация об инвестиционном контракте:");
    console.log("Address:", contracts.defimonInvestmentV2);
    
    // Проверяем текущий статус
    const isPaused = await investment.paused();
    console.log("Current pause status:", isPaused);
    
    if (isPaused) {
        console.log("⚠️  Инвестиционный контракт уже приостановлен!");
        return;
    }
    
    // Получаем статистику контракта
    const stats = await investment.getContractStats();
    console.log("Contract balance:", ethers.utils.formatEther(stats.contractBalance), "ETH");
    console.log("Token balance:", ethers.utils.formatEther(stats.tokenBalance), "DEFI");
    console.log("Total investors:", stats.totalInvestors.toString());
    console.log("Current coefficient:", stats.currentCoefficient.toString());
    
    // Получаем информацию о подписантах
    const signers = await investment.getSigners();
    console.log("\n👥 Подписанты мультиподписи:");
    console.log("Signer 1:", signers.signer1Address);
    console.log("Signer 2:", signers.signer2Address);
    console.log("Signer 3:", signers.signer3Address);
    
    // Подтверждение действия
    console.log("\n⚠️  ВНИМАНИЕ: Это действие приостановит все инвестиции!");
    console.log("Пользователи не смогут инвестировать до снятия приостановки.");
    console.log("Вывод средств через мультиподпись останется доступным.");
    
    // Приостанавливаем контракт
    console.log("\n🛑 Приостановка инвестиционного контракта...");
    const tx = await investment.pause();
    console.log("Transaction hash:", tx.hash);
    
    // Ждем подтверждения
    console.log("⏳ Ожидание подтверждения...");
    const receipt = await tx.wait();
    console.log("✅ Инвестиционный контракт успешно приостановлен!");
    console.log("Block number:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Проверяем статус
    const newPauseStatus = await investment.paused();
    console.log("New pause status:", newPauseStatus);
    
    // Логируем действие
    const logEntry = {
        timestamp: new Date().toISOString(),
        action: "EMERGENCY_PAUSE_INVESTMENT",
        contract: contracts.defimonInvestmentV2,
        deployer: deployer.address,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        contractBalance: ethers.utils.formatEther(stats.contractBalance),
        tokenBalance: ethers.utils.formatEther(stats.tokenBalance),
        totalInvestors: stats.totalInvestors.toString(),
        reason: "Emergency security measure"
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
    console.log("1. Уведомите команду безопасности");
    console.log("2. Уведомите пользователей о приостановке инвестиций");
    console.log("3. Проведите анализ угроз");
    console.log("4. Подготовьте план восстановления");
    console.log("5. Координируйте с подписантами мультиподписи");
    
    console.log("\n🔄 Для снятия приостановки используйте:");
    console.log("npx hardhat run scripts/emergency-unpause-investment.js --network sepolia");
    
    console.log("\n💰 Для экстренного вывода средств используйте:");
    console.log("npx hardhat run scripts/emergency-withdrawal.js --network sepolia");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Ошибка при экстренной приостановке:", error);
        process.exit(1);
    });
