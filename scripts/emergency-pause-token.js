const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("ЭКСТРЕННАЯ ПРИОСТАНОВКА ТОКЕНА DEFIMON V2");
    console.log("=".repeat(50));
    
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
    
    // Подключаемся к контракту токена
    const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
    const token = DefimonTokenV2.attach(contracts.defimonTokenV2);
    
    console.log("\n📋 Информация о токене:");
    console.log("Address:", contracts.defimonTokenV2);
    
    // Проверяем текущий статус
    const isPaused = await token.paused();
    console.log("Current pause status:", isPaused);
    
    if (isPaused) {
        console.log("⚠️  Токен уже приостановлен!");
        return;
    }
    
    // Получаем информацию о токене
    const tokenInfo = await token.getTokenInfo();
    console.log("Token name:", tokenInfo.tokenName);
    console.log("Token symbol:", tokenInfo.tokenSymbol);
    console.log("Total supply:", ethers.utils.formatEther(tokenInfo.tokenTotalSupply));
    
    // Подтверждение действия
    console.log("\n⚠️  ВНИМАНИЕ: Это действие приостановит все операции с токеном!");
    console.log("Пользователи не смогут переводить токены до снятия приостановки.");
    
    // Приостанавливаем токен
    console.log("\n🛑 Приостановка токена...");
    const tx = await token.pause();
    console.log("Transaction hash:", tx.hash);
    
    // Ждем подтверждения
    console.log("⏳ Ожидание подтверждения...");
    const receipt = await tx.wait();
    console.log("✅ Токен успешно приостановлен!");
    console.log("Block number:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Проверяем статус
    const newPauseStatus = await token.paused();
    console.log("New pause status:", newPauseStatus);
    
    // Логируем действие
    const logEntry = {
        timestamp: new Date().toISOString(),
        action: "EMERGENCY_PAUSE_TOKEN",
        contract: contracts.defimonTokenV2,
        deployer: deployer.address,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
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
    console.log("2. Уведомите пользователей");
    console.log("3. Проведите анализ угроз");
    console.log("4. Подготовьте план восстановления");
    
    console.log("\n🔄 Для снятия приостановки используйте:");
    console.log("npx hardhat run scripts/emergency-unpause-token.js --network sepolia");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Ошибка при экстренной приостановке:", error);
        process.exit(1);
    });
