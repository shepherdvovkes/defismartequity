const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔄 Начинаем миграцию с V1 на V2...");
    
    // Загружаем адреса старых контрактов
    const oldContractsPath = path.join(__dirname, "..", "deployed-contracts.json");
    const newContractsPath = path.join(__dirname, "..", "deployed-contracts-v2.json");
    
    if (!fs.existsSync(oldContractsPath)) {
        throw new Error("❌ Файл deployed-contracts.json не найден");
    }
    
    if (!fs.existsSync(newContractsPath)) {
        throw new Error("❌ Файл deployed-contracts-v2.json не найден. Сначала выполните деплой V2 контрактов.");
    }
    
    const oldContracts = JSON.parse(fs.readFileSync(oldContractsPath, "utf8"));
    const newContracts = JSON.parse(fs.readFileSync(newContractsPath, "utf8"));
    
    console.log("📋 Информация о миграции:");
    console.log("Старые контракты:", oldContracts);
    console.log("Новые контракты:", newContracts);
    
    // Получаем контракты
    const [deployer] = await ethers.getSigners();
    
    // Подключаемся к старым контрактам
    const DefimonToken = await ethers.getContractFactory("DefimonToken");
    const DefimonInvestment = await ethers.getContractFactory("DefimonInvestment");
    
    const oldToken = DefimonToken.attach(oldContracts.defimonToken);
    const oldInvestment = DefimonInvestment.attach(oldContracts.defimonInvestment);
    
    // Подключаемся к новым контрактам
    const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
    const DefimonInvestmentV2 = await ethers.getContractFactory("DefimonInvestmentV2");
    
    const newToken = DefimonTokenV2.attach(newContracts.defimonTokenV2);
    const newInvestment = DefimonInvestmentV2.attach(newContracts.defimonInvestmentV2);
    
    console.log("\n📊 Анализ данных для миграции...");
    
    // Получаем статистику старых контрактов
    const oldStats = await oldInvestment.getContractStats();
    const oldInvestorCount = await oldInvestment.getInvestorCount();
    
    console.log("Статистика V1 контрактов:");
    console.log("- Общее количество инвесторов:", oldInvestorCount.toString());
    console.log("- Общий объем инвестиций:", ethers.utils.formatEther(oldStats.totalInvestments), "ETH");
    console.log("- Распределено токенов:", ethers.utils.formatEther(oldStats.totalTokensDistributed), "DEFI");
    
    // Получаем список всех инвесторов
    console.log("\n👥 Получаем список инвесторов...");
    const investors = [];
    
    for (let i = 0; i < oldInvestorCount; i++) {
        const investorAddress = await oldInvestment.getInvestorByIndex(i);
        const investorInfo = await oldInvestment.getInvestorInfo(investorAddress);
        
        investors.push({
            address: investorAddress,
            totalInvested: investorInfo.totalInvested.toString(),
            totalTokens: investorInfo.totalTokens.toString(),
            investmentCount: investorInfo.investmentCount.toString(),
            lastInvestmentTime: investorInfo.lastInvestmentTime.toString()
        });
    }
    
    console.log(`✅ Получено ${investors.length} инвесторов`);
    
    // Создаем план миграции
    const migrationPlan = {
        timestamp: new Date().toISOString(),
        oldContracts: oldContracts,
        newContracts: newContracts,
        investors: investors,
        totalInvestors: investors.length,
        migrationStatus: "pending"
    };
    
    const migrationPath = path.join(__dirname, "..", "migration-plan.json");
    fs.writeFileSync(migrationPath, JSON.stringify(migrationPlan, null, 2));
    
    console.log("\n📄 План миграции сохранен в migration-plan.json");
    
    // Проверяем совместимость
    console.log("\n🔍 Проверяем совместимость контрактов...");
    
    const oldTokenInfo = {
        name: await oldToken.name(),
        symbol: await oldToken.symbol(),
        decimals: await oldToken.decimals(),
        totalSupply: (await oldToken.totalSupply()).toString()
    };
    
    const newTokenInfo = await newToken.getTokenInfo();
    
    console.log("Информация о токенах:");
    console.log("V1:", oldTokenInfo);
    console.log("V2:", newTokenInfo);
    
    // Проверяем, что основные параметры совпадают
    if (oldTokenInfo.name !== newTokenInfo.tokenName) {
        console.warn("⚠️  Название токена изменилось");
    }
    
    if (oldTokenInfo.symbol !== newTokenInfo.tokenSymbol) {
        console.warn("⚠️  Символ токена изменился");
    }
    
    if (oldTokenInfo.decimals !== newTokenInfo.tokenDecimals) {
        console.warn("⚠️  Количество десятичных знаков изменилось");
    }
    
    console.log("\n✅ Анализ миграции завершен");
    console.log("\n📋 Следующие шаги:");
    console.log("1. Проверьте план миграции в migration-plan.json");
    console.log("2. Уведомите инвесторов о переходе на V2");
    console.log("3. Обновите фронтенд для работы с V2 контрактами");
    console.log("4. Выполните тестирование V2 контрактов");
    console.log("5. После успешного тестирования обновите deployed-contracts.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Ошибка при миграции:", error);
        process.exit(1);
    });
