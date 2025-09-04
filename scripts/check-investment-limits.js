const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("ПРОВЕРКА ЛИМИТОВ ИНВЕСТИЦИЙ DEFIMON V2");
    console.log("=".repeat(60));
    
    // Получаем аргументы командной строки
    const ethAmount = process.argv[2]; // количество ETH для проверки
    
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
    
    // Получаем лимиты инвестиций
    const limits = await investment.getInvestmentLimits();
    
    console.log("\nЛИМИТЫ ИНВЕСТИЦИЙ:");
    console.log("Min investment (USD):", limits.minInvestmentUsd.toString());
    console.log("Max investment (USD):", limits.maxInvestmentUsd.toString());
    console.log("Large investment threshold (USD):", limits.largeInvestmentUsd.toString());
    console.log("Current ETH/USD price:", limits.currentEthUsdPrice.toString(), "cents");
    console.log("Current ETH/USD price:", (limits.currentEthUsdPrice / 100).toFixed(2), "USD");
    
    console.log("\nЛИМИТЫ В ETH:");
    console.log("Min investment (ETH):", ethers.utils.formatEther(limits.minInvestmentEth));
    console.log("Max investment (ETH):", ethers.utils.formatEther(limits.maxInvestmentEth));
    
    // Рассчитываем лимит для крупных инвестиций в ETH
    const largeInvestmentEth = (limits.largeInvestmentUsd * 100 * 1e18) / limits.currentEthUsdPrice;
    console.log("Large investment threshold (ETH):", ethers.utils.formatEther(largeInvestmentEth));
    
    // Получаем текущий коэффициент
    const coefficient = await investment.getCurrentCoefficient();
    console.log("\n📈 ТЕКУЩИЙ КОЭФФИЦИЕНТ:");
    console.log("Coefficient:", coefficient.coefficient.toString());
    console.log("Period:", coefficient.period.toString());
    
    // Определяем период
    let periodName;
    switch (coefficient.period.toString()) {
        case '1':
            periodName = "MVP (x10)";
            break;
        case '2':
            periodName = "Release (x5)";
            break;
        case '3':
            periodName = "Standard (x1)";
            break;
        default:
            periodName = "Unknown";
    }
    console.log("Period name:", periodName);
    
    // Получаем информацию о периодах
    const periods = await investment.getInvestmentPeriods();
    console.log("\n⏰ ПЕРИОДЫ ИНВЕСТИЦИЙ:");
    console.log("MVP deadline:", new Date(periods.mvpDeadline * 1000).toISOString());
    console.log("Release deadline:", new Date(periods.releaseDeadline * 1000).toISOString());
    console.log("Current time:", new Date(periods.currentTime * 1000).toISOString());
    
    // Проверяем, если указана сумма для проверки
    if (ethAmount) {
        const testAmount = ethers.utils.parseEther(ethAmount);
        console.log(`\n🔍 ПРОВЕРКА СУММЫ: ${ethAmount} ETH`);
        
        // Проверяем лимиты
        const [isWithinLimits, requiresApproval] = await investment.checkInvestmentLimits(testAmount);
        
        console.log("Within limits:", isWithinLimits ? "✅ YES" : "❌ NO");
        console.log("Requires approval:", requiresApproval ? "✅ YES" : "❌ NO");
        
        // Конвертируем в USD
        const usdAmount = await investment.ethToUsd(testAmount);
        console.log("USD equivalent:", usdAmount.toString(), "cents ($" + (usdAmount / 100).toFixed(2) + ")");
        
        // Рассчитываем количество токенов
        const tokenAmount = testAmount * 100 * coefficient.coefficient; // BASE_EXCHANGE_RATE * coefficient
        console.log("Token amount:", ethers.utils.formatEther(tokenAmount), "DEFI");
        
        // Определяем тип инвестиции
        let investmentType;
        if (!isWithinLimits) {
            investmentType = "❌ REJECTED (Outside limits)";
        } else if (requiresApproval) {
            investmentType = "⚠️  REQUIRES APPROVAL (Large investment)";
        } else {
            investmentType = "✅ STANDARD (Normal investment)";
        }
        
        console.log("Investment type:", investmentType);
        
        // Проверяем баланс токенов контракта
        const tokenBalance = await investment.getTokenBalance();
        console.log("\n🪙 БАЛАНС ТОКЕНОВ КОНТРАКТА:");
        console.log("Available tokens:", ethers.utils.formatEther(tokenBalance), "DEFI");
        console.log("Sufficient for investment:", tokenBalance.gte(tokenAmount) ? "✅ YES" : "❌ NO");
        
        if (!tokenBalance.gte(tokenAmount)) {
            console.log("⚠️  ВНИМАНИЕ: Недостаточно токенов в контракте!");
            console.log("Необходимо пополнить контракт токенами.");
        }
    }
    
    // Получаем статистику контракта
    const stats = await investment.getContractStats();
    console.log("\nСТАТИСТИКА КОНТРАКТА:");
    console.log("Total investors:", stats.totalInvestors.toString());
    console.log("Contract balance:", ethers.utils.formatEther(stats.contractBalance), "ETH");
    console.log("Token balance:", ethers.utils.formatEther(stats.tokenBalance), "DEFI");
    console.log("Total tokens distributed:", ethers.utils.formatEther(stats.totalTokensDistributed), "DEFI");
    
    // Получаем информацию о подписантах
    const signers = await investment.getSigners();
    console.log("\n👥 ПОДПИСАНТЫ МУЛЬТИПОДПИСИ:");
    console.log("Signer 1:", signers.signer1Address);
    console.log("Signer 2:", signers.signer2Address);
    console.log("Signer 3:", signers.signer3Address);
    
    // Получаем счетчик запросов
    const requestCounter = await investment.getRequestCounter();
    console.log("\n🔢 СЧЕТЧИКИ:");
    console.log("Request counter:", requestCounter.toString());
    
    // Проверяем статус контракта
    const isPaused = await investment.paused();
    console.log("\n⏸️  СТАТУС КОНТРАКТА:");
    console.log("Paused:", isPaused ? "🔴 YES" : "🟢 NO");
    
    // Создаем отчет
    const report = {
        timestamp: new Date().toISOString(),
        limits: {
            minInvestmentUsd: limits.minInvestmentUsd.toString(),
            maxInvestmentUsd: limits.maxInvestmentUsd.toString(),
            largeInvestmentUsd: limits.largeInvestmentUsd.toString(),
            currentEthUsdPrice: limits.currentEthUsdPrice.toString(),
            minInvestmentEth: ethers.utils.formatEther(limits.minInvestmentEth),
            maxInvestmentEth: ethers.utils.formatEther(limits.maxInvestmentEth),
            largeInvestmentEth: ethers.utils.formatEther(largeInvestmentEth)
        },
        coefficient: {
            value: coefficient.coefficient.toString(),
            period: coefficient.period.toString(),
            periodName: periodName
        },
        periods: {
            mvpDeadline: new Date(periods.mvpDeadline * 1000).toISOString(),
            releaseDeadline: new Date(periods.releaseDeadline * 1000).toISOString(),
            currentTime: new Date(periods.currentTime * 1000).toISOString()
        },
        stats: {
            totalInvestors: stats.totalInvestors.toString(),
            contractBalance: ethers.utils.formatEther(stats.contractBalance),
            tokenBalance: ethers.utils.formatEther(stats.tokenBalance),
            totalTokensDistributed: ethers.utils.formatEther(stats.totalTokensDistributed)
        },
        signers: {
            signer1: signers.signer1Address,
            signer2: signers.signer2Address,
            signer3: signers.signer3Address
        },
        counters: {
            requestCounter: requestCounter.toString()
        },
        status: {
            paused: isPaused
        }
    };
    
    // Добавляем проверку суммы, если указана
    if (ethAmount) {
        const testAmount = ethers.utils.parseEther(ethAmount);
        const [isWithinLimits, requiresApproval] = await investment.checkInvestmentLimits(testAmount);
        const usdAmount = await investment.ethToUsd(testAmount);
        const tokenAmount = testAmount * 100 * coefficient.coefficient;
        const tokenBalance = await investment.getTokenBalance();
        
        report.testAmount = {
            ethAmount: ethAmount,
            usdAmount: usdAmount.toString(),
            usdAmountFormatted: (usdAmount / 100).toFixed(2),
            tokenAmount: ethers.utils.formatEther(tokenAmount),
            isWithinLimits: isWithinLimits,
            requiresApproval: requiresApproval,
            sufficientTokens: tokenBalance.gte(tokenAmount)
        };
    }
    
    // Сохраняем отчет
    const reportPath = path.join(__dirname, "..", "investment-limits-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Отчет сохранен в: ${reportPath}`);
    
    // Рекомендации
    console.log("\n💡 РЕКОМЕНДАЦИИ:");
    
    if (isPaused) {
        console.log("⚠️  Контракт приостановлен - необходимо снять приостановку");
    }
    
    if (stats.tokenBalance.lt(ethers.utils.parseEther("1000000"))) { // Меньше 1M токенов
        console.log("⚠️  Низкий баланс токенов - рассмотрите пополнение");
    }
    
    if (stats.contractBalance.lt(ethers.utils.parseEther("10"))) { // Меньше 10 ETH
        console.log("⚠️  Низкий баланс ETH - рассмотрите пополнение");
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime > periods.mvpDeadline && coefficient.period.toString() === '1') {
        console.log("⚠️  MVP период истек - проверьте коэффициент");
    }
    
    if (currentTime > periods.releaseDeadline && coefficient.period.toString() === '2') {
        console.log("⚠️  Release период истек - проверьте коэффициент");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Ошибка при проверке лимитов:", error);
        process.exit(1);
    });
