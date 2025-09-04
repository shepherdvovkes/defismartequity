const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // Получаем адрес из аргументов командной строки
    const targetAddress = process.argv[2];
    
    if (!targetAddress) {
        console.error("❌ Укажите адрес для проверки:");
        console.error("npx hardhat run scripts/check-blacklist-status.js --network sepolia -- 0x...");
        process.exit(1);
    }
    
    // Проверяем валидность адреса
    if (!ethers.utils.isAddress(targetAddress)) {
        console.error("❌ Неверный формат адреса:", targetAddress);
        process.exit(1);
    }
    
    console.log("🔍 ПРОВЕРКА СТАТУСА ЧЕРНОГО СПИСКА DEFIMON V2");
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
    
    // Проверяем статус в токене
    console.log("\n🪙 СТАТУС В ТОКЕНЕ:");
    const isTokenBlacklisted = await token.blacklisted(targetAddress);
    console.log("Blacklist status:", isTokenBlacklisted ? "🔴 BLACKLISTED" : "🟢 CLEAR");
    
    const tokenBalance = await token.balanceOf(targetAddress);
    console.log("Token balance:", ethers.utils.formatEther(tokenBalance), "DEFI");
    
    // Проверяем статус в инвестиционном контракте
    console.log("\n💰 СТАТУС В ИНВЕСТИЦИОННОМ КОНТРАКТЕ:");
    const isInvestmentBlacklisted = await investment.blacklisted(targetAddress);
    console.log("Blacklist status:", isInvestmentBlacklisted ? "🔴 BLACKLISTED" : "🟢 CLEAR");
    
    // Получаем информацию об инвесторе
    const investorInfo = await investment.getInvestorInfo(targetAddress);
    console.log("Investor exists:", investorInfo.exists ? "✅ YES" : "❌ NO");
    
    if (investorInfo.exists) {
        console.log("Total invested:", ethers.utils.formatEther(investorInfo.totalInvested), "ETH");
        console.log("Total tokens:", ethers.utils.formatEther(investorInfo.totalTokens), "DEFI");
        console.log("Investment count:", investorInfo.investmentCount.toString());
        console.log("Last investment time:", new Date(investorInfo.lastInvestmentTime * 1000).toISOString());
    }
    
    // Проверяем лимиты инвестиций
    console.log("\n📊 ЛИМИТЫ ИНВЕСТИЦИЙ:");
    const limits = await investment.getInvestmentLimits();
    console.log("Min investment (USD):", limits.minInvestmentUsd.toString());
    console.log("Max investment (USD):", limits.maxInvestmentUsd.toString());
    console.log("Large investment threshold (USD):", limits.largeInvestmentUsd.toString());
    console.log("Current ETH/USD price:", limits.currentEthUsdPrice.toString());
    console.log("Min investment (ETH):", ethers.utils.formatEther(limits.minInvestmentEth));
    console.log("Max investment (ETH):", ethers.utils.formatEther(limits.maxInvestmentEth));
    
    // Проверяем, может ли адрес инвестировать
    console.log("\n🔍 ПРОВЕРКА ВОЗМОЖНОСТИ ИНВЕСТИРОВАНИЯ:");
    const canInvest = !isInvestmentBlacklisted && !isTokenBlacklisted;
    console.log("Can invest:", canInvest ? "✅ YES" : "❌ NO");
    
    if (!canInvest) {
        console.log("Reasons:");
        if (isInvestmentBlacklisted) console.log("- Address is blacklisted in investment contract");
        if (isTokenBlacklisted) console.log("- Address is blacklisted in token contract");
    }
    
    // Проверяем статус контрактов
    console.log("\n⏸️  СТАТУС КОНТРАКТОВ:");
    const tokenPaused = await token.paused();
    const investmentPaused = await investment.paused();
    console.log("Token paused:", tokenPaused ? "🔴 YES" : "🟢 NO");
    console.log("Investment paused:", investmentPaused ? "🔴 YES" : "🟢 NO");
    
    // Получаем информацию о подписантах
    console.log("\n👥 ПОДПИСАНТЫ МУЛЬТИПОДПИСИ:");
    const signers = await investment.getSigners();
    console.log("Signer 1:", signers.signer1Address);
    console.log("Signer 2:", signers.signer2Address);
    console.log("Signer 3:", signers.signer3Address);
    
    // Проверяем, является ли адрес подписантом
    const isSigner = targetAddress.toLowerCase() === signers.signer1Address.toLowerCase() ||
                    targetAddress.toLowerCase() === signers.signer2Address.toLowerCase() ||
                    targetAddress.toLowerCase() === signers.signer3Address.toLowerCase();
    console.log("Is signer:", isSigner ? "✅ YES" : "❌ NO");
    
    // Проверяем, является ли адрес владельцем
    const tokenOwner = await token.owner();
    const investmentOwner = await investment.owner();
    const isOwner = targetAddress.toLowerCase() === tokenOwner.toLowerCase() ||
                   targetAddress.toLowerCase() === investmentOwner.toLowerCase();
    console.log("Is owner:", isOwner ? "✅ YES" : "❌ NO");
    
    // Итоговый статус
    console.log("\n📋 ИТОГОВЫЙ СТАТУС:");
    if (isTokenBlacklisted || isInvestmentBlacklisted) {
        console.log("🔴 АДРЕС ЗАБЛОКИРОВАН");
        console.log("Действия недоступны:");
        console.log("- Инвестирование");
        console.log("- Перевод токенов");
        console.log("- Получение токенов");
    } else if (tokenPaused || investmentPaused) {
        console.log("🟡 КОНТРАКТЫ ПРИОСТАНОВЛЕНЫ");
        console.log("Действия недоступны до снятия приостановки");
    } else {
        console.log("🟢 АДРЕС АКТИВЕН");
        console.log("Все действия доступны");
    }
    
    // Сохраняем отчет
    const report = {
        timestamp: new Date().toISOString(),
        targetAddress: targetAddress,
        status: {
            tokenBlacklisted: isTokenBlacklisted,
            investmentBlacklisted: isInvestmentBlacklisted,
            tokenPaused: tokenPaused,
            investmentPaused: investmentPaused,
            canInvest: canInvest,
            isSigner: isSigner,
            isOwner: isOwner
        },
        balances: {
            tokenBalance: ethers.utils.formatEther(tokenBalance)
        },
        investorInfo: investorInfo.exists ? {
            totalInvested: ethers.utils.formatEther(investorInfo.totalInvested),
            totalTokens: ethers.utils.formatEther(investorInfo.totalTokens),
            investmentCount: investorInfo.investmentCount.toString(),
            lastInvestmentTime: new Date(investorInfo.lastInvestmentTime * 1000).toISOString()
        } : null,
        limits: {
            minInvestmentUsd: limits.minInvestmentUsd.toString(),
            maxInvestmentUsd: limits.maxInvestmentUsd.toString(),
            largeInvestmentUsd: limits.largeInvestmentUsd.toString(),
            currentEthUsdPrice: limits.currentEthUsdPrice.toString(),
            minInvestmentEth: ethers.utils.formatEther(limits.minInvestmentEth),
            maxInvestmentEth: ethers.utils.formatEther(limits.maxInvestmentEth)
        }
    };
    
    const reportPath = path.join(__dirname, "..", `blacklist-status-${targetAddress}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Отчет сохранен в: ${reportPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Ошибка при проверке статуса:", error);
        process.exit(1);
    });
