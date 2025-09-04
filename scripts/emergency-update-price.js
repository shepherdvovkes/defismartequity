const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

async function main() {
    console.log("💱 ОБНОВЛЕНИЕ КУРСА ETH/USD DEFIMON V2");
    console.log("=".repeat(60));
    
    // Получаем аргументы командной строки
    const priceSource = process.argv[2]; // 'manual', 'coingecko', 'coinmarketcap'
    const manualPrice = process.argv[3]; // цена в USD (только для manual)
    
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
    
    // Получаем текущий курс
    const currentPrice = await investment.ethUsdPrice();
    console.log("Current ETH/USD price:", currentPrice.toString(), "USD");
    
    let newPrice;
    
    switch (priceSource?.toLowerCase()) {
        case 'manual':
            if (!manualPrice) {
                console.error("❌ Укажите цену для ручного обновления:");
                console.error("npx hardhat run scripts/emergency-update-price.js --network sepolia -- manual 2500");
                process.exit(1);
            }
            
            newPrice = parseFloat(manualPrice);
            if (isNaN(newPrice) || newPrice <= 0) {
                console.error("❌ Неверная цена:", manualPrice);
                process.exit(1);
            }
            
            console.log("📝 Ручное обновление цены");
            break;
            
        case 'coingecko':
            console.log("🦎 Получение цены с CoinGecko...");
            newPrice = await getPriceFromCoinGecko();
            break;
            
        case 'coinmarketcap':
            console.log("📊 Получение цены с CoinMarketCap...");
            newPrice = await getPriceFromCoinMarketCap();
            break;
            
        default:
            console.error("❌ Укажите источник цены:");
            console.error("npx hardhat run scripts/emergency-update-price.js --network sepolia -- manual <price>");
            console.error("npx hardhat run scripts/emergency-update-price.js --network sepolia -- coingecko");
            console.error("npx hardhat run scripts/emergency-update-price.js --network sepolia -- coinmarketcap");
            process.exit(1);
    }
    
    // Конвертируем в центы (умножаем на 100)
    const newPriceInCents = Math.round(newPrice * 100);
    
    console.log("\n📊 Сравнение цен:");
    console.log("Current price:", currentPrice.toString(), "cents ($" + (currentPrice / 100).toFixed(2) + ")");
    console.log("New price:", newPriceInCents.toString(), "cents ($" + newPrice.toFixed(2) + ")");
    
    const priceChange = ((newPriceInCents - currentPrice) * 100) / currentPrice;
    console.log("Price change:", priceChange.toFixed(2) + "%");
    
    // Проверяем на значительные изменения
    if (Math.abs(priceChange) > 20) {
        console.log("⚠️  ВНИМАНИЕ: Значительное изменение цены (>20%)!");
        console.log("Это может повлиять на лимиты инвестиций.");
    }
    
    // Получаем лимиты инвестиций
    const limits = await investment.getInvestmentLimits();
    console.log("\n📊 Текущие лимиты инвестиций:");
    console.log("Min investment (USD):", limits.minInvestmentUsd.toString());
    console.log("Max investment (USD):", limits.maxInvestmentUsd.toString());
    console.log("Large investment threshold (USD):", limits.largeInvestmentUsd.toString());
    
    // Рассчитываем новые лимиты в ETH
    const newMinEth = (limits.minInvestmentUsd * 100 * 1e18) / newPriceInCents;
    const newMaxEth = (limits.maxInvestmentUsd * 100 * 1e18) / newPriceInCents;
    const newLargeEth = (limits.largeInvestmentUsd * 100 * 1e18) / newPriceInCents;
    
    console.log("\n📊 Новые лимиты в ETH:");
    console.log("Min investment (ETH):", ethers.utils.formatEther(newMinEth));
    console.log("Max investment (ETH):", ethers.utils.formatEther(newMaxEth));
    console.log("Large investment threshold (ETH):", ethers.utils.formatEther(newLargeEth));
    
    // Подтверждение действия
    console.log("\n⚠️  ВНИМАНИЕ: Это обновит курс ETH/USD в контракте!");
    console.log("Все новые инвестиции будут использовать новый курс.");
    
    // Обновляем цену
    console.log("\n💱 Обновление курса ETH/USD...");
    const tx = await investment.updateEthUsdPrice(newPriceInCents);
    console.log("Transaction hash:", tx.hash);
    
    // Ждем подтверждения
    console.log("⏳ Ожидание подтверждения...");
    const receipt = await tx.wait();
    console.log("✅ Курс ETH/USD успешно обновлен!");
    console.log("Block number:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Проверяем новый курс
    const updatedPrice = await investment.ethUsdPrice();
    console.log("Updated ETH/USD price:", updatedPrice.toString(), "cents ($" + (updatedPrice / 100).toFixed(2) + ")");
    
    // Логируем действие
    const logEntry = {
        timestamp: new Date().toISOString(),
        action: "UPDATE_ETH_USD_PRICE",
        contract: contracts.defimonInvestmentV2,
        deployer: deployer.address,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        priceChange: {
            oldPrice: currentPrice.toString(),
            newPrice: newPriceInCents.toString(),
            oldPriceUsd: (currentPrice / 100).toFixed(2),
            newPriceUsd: newPrice.toFixed(2),
            changePercent: priceChange.toFixed(2)
        },
        source: priceSource,
        limits: {
            minInvestmentUsd: limits.minInvestmentUsd.toString(),
            maxInvestmentUsd: limits.maxInvestmentUsd.toString(),
            largeInvestmentUsd: limits.largeInvestmentUsd.toString(),
            newMinEth: ethers.utils.formatEther(newMinEth),
            newMaxEth: ethers.utils.formatEther(newMaxEth),
            newLargeEth: ethers.utils.formatEther(newLargeEth)
        }
    };
    
    const logPath = path.join(__dirname, "..", "price-update-logs.json");
    let logs = [];
    
    if (fs.existsSync(logPath)) {
        logs = JSON.parse(fs.readFileSync(logPath, "utf8"));
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    
    console.log("\n📄 Действие записано в price-update-logs.json");
    
    // Уведомления
    console.log("\n📢 СЛЕДУЮЩИЕ ШАГИ:");
    console.log("1. Уведомите команду о изменении курса");
    console.log("2. Обновите документацию с новыми лимитами");
    console.log("3. Проверьте влияние на существующие инвестиции");
    console.log("4. Рассмотрите автоматизацию обновления цены");
    
    console.log("\n🔍 Для проверки лимитов используйте:");
    console.log("npx hardhat run scripts/check-investment-limits.js --network sepolia");
}

async function getPriceFromCoinGecko() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const price = response.data.ethereum.usd;
        console.log("CoinGecko ETH price: $" + price);
        return price;
    } catch (error) {
        console.error("❌ Ошибка получения цены с CoinGecko:", error.message);
        throw error;
    }
}

async function getPriceFromCoinMarketCap() {
    try {
        // Для CoinMarketCap нужен API ключ, используем публичный endpoint
        const response = await axios.get('https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?start=1&limit=1&sortBy=market_cap&sortType=desc&convert=USD');
        const ethData = response.data.data.cryptoCurrencyList.find(crypto => crypto.symbol === 'ETH');
        
        if (!ethData) {
            throw new Error("ETH not found in CoinMarketCap response");
        }
        
        const price = ethData.quotes[0].price;
        console.log("CoinMarketCap ETH price: $" + price);
        return price;
    } catch (error) {
        console.error("❌ Ошибка получения цены с CoinMarketCap:", error.message);
        console.log("💡 Попробуйте использовать CoinGecko или ручное обновление");
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Ошибка при обновлении курса:", error);
        process.exit(1);
    });
