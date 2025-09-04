const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // Получаем адрес из аргументов командной строки
    const targetAddress = process.argv[2];
    
    if (!targetAddress) {
        console.error("❌ Укажите адрес для добавления в черный список:");
        console.error("npx hardhat run scripts/emergency-blacklist.js --network sepolia -- 0x...");
        process.exit(1);
    }
    
    // Проверяем валидность адреса
    if (!ethers.utils.isAddress(targetAddress)) {
        console.error("❌ Неверный формат адреса:", targetAddress);
        process.exit(1);
    }
    
    console.log("🚨 ЭКСТРЕННОЕ ДОБАВЛЕНИЕ В ЧЕРНЫЙ СПИСОК DEFIMON V2");
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
    
    // Подключаемся к контракту токена
    const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
    const token = DefimonTokenV2.attach(contracts.defimonTokenV2);
    
    console.log("\n📋 Информация о токене:");
    console.log("Address:", contracts.defimonTokenV2);
    
    // Проверяем текущий статус адреса
    const isBlacklisted = await token.blacklisted(targetAddress);
    console.log("Current blacklist status:", isBlacklisted);
    
    if (isBlacklisted) {
        console.log("⚠️  Адрес уже находится в черном списке!");
        return;
    }
    
    // Получаем информацию о токене
    const tokenInfo = await token.getTokenInfo();
    console.log("Token name:", tokenInfo.tokenName);
    console.log("Token symbol:", tokenInfo.tokenSymbol);
    
    // Проверяем баланс адреса
    const balance = await token.balanceOf(targetAddress);
    console.log("Target address balance:", ethers.utils.formatEther(balance), "DEFI");
    
    // Подтверждение действия
    console.log("\n⚠️  ВНИМАНИЕ: Это действие заблокирует адрес!");
    console.log("Заблокированный адрес не сможет:");
    console.log("- Переводить токены");
    console.log("- Получать токены");
    console.log("- Участвовать в инвестициях");
    
    // Добавляем в черный список
    console.log("\n🛑 Добавление адреса в черный список...");
    const tx = await token.setBlacklist(targetAddress, true);
    console.log("Transaction hash:", tx.hash);
    
    // Ждем подтверждения
    console.log("⏳ Ожидание подтверждения...");
    const receipt = await tx.wait();
    console.log("✅ Адрес успешно добавлен в черный список!");
    console.log("Block number:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Проверяем статус
    const newBlacklistStatus = await token.blacklisted(targetAddress);
    console.log("New blacklist status:", newBlacklistStatus);
    
    // Логируем действие
    const logEntry = {
        timestamp: new Date().toISOString(),
        action: "EMERGENCY_BLACKLIST",
        contract: contracts.defimonTokenV2,
        targetAddress: targetAddress,
        deployer: deployer.address,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        targetBalance: ethers.utils.formatEther(balance),
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
    console.log("2. Проведите анализ активности адреса");
    console.log("3. Определите причину блокировки");
    console.log("4. Подготовьте план дальнейших действий");
    
    console.log("\n🔄 Для снятия блокировки используйте:");
    console.log(`npx hardhat run scripts/emergency-unblacklist.js --network sepolia -- ${targetAddress}`);
    
    console.log("\n📊 Для проверки статуса используйте:");
    console.log(`npx hardhat run scripts/check-blacklist-status.js --network sepolia -- ${targetAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Ошибка при добавлении в черный список:", error);
        process.exit(1);
    });
