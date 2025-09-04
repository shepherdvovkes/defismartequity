const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Начинаем деплой V2 контрактов...");
    
    // Получаем аккаунты
    const [deployer, signer1, signer2, signer3] = await ethers.getSigners();
    
    console.log("📋 Информация о деплое:");
    console.log("Deployer:", deployer.address);
    console.log("Signer1:", signer1.address);
    console.log("Signer2:", signer2.address);
    console.log("Signer3:", signer3.address);
    console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
    
    // Проверяем баланс
    const balance = await deployer.getBalance();
    if (balance.lt(ethers.utils.parseEther("0.01"))) {
        throw new Error("❌ Недостаточно ETH для деплоя");
    }
    
    // 1. Деплой DefimonTokenV2
    console.log("\n📦 Деплой DefimonTokenV2...");
    const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
    const defimonTokenV2 = await DefimonTokenV2.deploy();
    await defimonTokenV2.deployed();
    
    console.log("✅ DefimonTokenV2 deployed to:", defimonTokenV2.address);
    
    // 2. Деплой DefimonInvestmentV2
    console.log("\n📦 Деплой DefimonInvestmentV2...");
    const DefimonInvestmentV2 = await ethers.getContractFactory("DefimonInvestmentV2");
    const defimonInvestmentV2 = await DefimonInvestmentV2.deploy(
        defimonTokenV2.address,
        signer1.address,
        signer2.address,
        signer3.address
    );
    await defimonInvestmentV2.deployed();
    
    console.log("✅ DefimonInvestmentV2 deployed to:", defimonInvestmentV2.address);
    
    // 3. Переводим токены в контракт инвестиций
    console.log("\n💰 Переводим токены в контракт инвестиций...");
    const totalSupply = await defimonTokenV2.TOTAL_SUPPLY();
    const transferAmount = totalSupply.div(2); // Переводим 50% токенов
    
    const transferTx = await defimonTokenV2.transferTokens(
        defimonInvestmentV2.address,
        transferAmount
    );
    await transferTx.wait();
    
    console.log("✅ Переведено", ethers.utils.formatEther(transferAmount), "токенов");
    
    // 4. Проверяем балансы
    console.log("\n📊 Проверяем балансы:");
    const deployerBalance = await defimonTokenV2.balanceOf(deployer.address);
    const contractBalance = await defimonTokenV2.balanceOf(defimonInvestmentV2.address);
    
    console.log("Deployer balance:", ethers.utils.formatEther(deployerBalance), "DEFI");
    console.log("Contract balance:", ethers.utils.formatEther(contractBalance), "DEFI");
    
    // 5. Сохраняем адреса контрактов
    const contractData = {
        defimonTokenV2: defimonTokenV2.address,
        defimonInvestmentV2: defimonInvestmentV2.address,
        deployer: deployer.address,
        signer1: signer1.address,
        signer2: signer2.address,
        signer3: signer3.address,
        network: "sepolia",
        deployedAt: new Date().toISOString(),
        version: "2.0"
    };
    
    const contractsPath = path.join(__dirname, "..", "deployed-contracts-v2.json");
    fs.writeFileSync(contractsPath, JSON.stringify(contractData, null, 2));
    
    console.log("\n📄 Адреса контрактов сохранены в deployed-contracts-v2.json");
    
    // 6. Выводим итоговую информацию
    console.log("\n🎉 Деплой V2 контрактов завершен!");
    console.log("=".repeat(50));
    console.log("DefimonTokenV2:", defimonTokenV2.address);
    console.log("DefimonInvestmentV2:", defimonInvestmentV2.address);
    console.log("=".repeat(50));
    
    // 7. Информация для верификации
    console.log("\n🔍 Команды для верификации:");
    console.log(`npx hardhat verify --network sepolia ${defimonTokenV2.address}`);
    console.log(`npx hardhat verify --network sepolia ${defimonInvestmentV2.address} "${defimonTokenV2.address}" "${signer1.address}" "${signer2.address}" "${signer3.address}"`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Ошибка при деплое:", error);
        process.exit(1);
    });
