const { ethers } = require("hardhat");
const axios = require("axios");
require("dotenv").config();

class PriceOracle {
  constructor(contractAddress, contractABI) {
    this.contractAddress = contractAddress;
    this.contractABI = contractABI;
    this.updateInterval = 5 * 60 * 1000; // 5 минут
    this.maxRetries = 3;
    this.retryDelay = 10000; // 10 секунд
    this.isRunning = false;
    this.lastUpdateTime = null;
    this.lastPrice = null;
  }

  async initialize() {
    try {
      // Подключаемся к контракту
      const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_URL);
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      this.contract = new ethers.Contract(this.contractAddress, this.contractABI, wallet);
      
      console.log("✅ Price Oracle инициализирован");
              console.log(`Контракт: ${this.contractAddress}`);
      console.log(`⏰ Интервал обновления: ${this.updateInterval / 1000} секунд`);
      
      return true;
    } catch (error) {
      console.error("❌ Ошибка инициализации оракула:", error.message);
      return false;
    }
  }

  async getCurrentEthPrice() {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&precision=2`,
        {
          headers: {
            'x-cg-demo-api-key': process.env.COINGECKO_API_KEY
          },
          timeout: 10000
        }
      );

      if (response.data && response.data.ethereum && response.data.ethereum.usd) {
        const price = response.data.ethereum.usd;
        console.log(`💰 Текущая цена ETH: $${price}`);
        return Math.round(price * 100); // Конвертируем в центы
      } else {
        throw new Error("Неверный формат ответа от CoinGecko");
      }
    } catch (error) {
      console.error("❌ Ошибка получения цены ETH:", error.message);
      throw error;
    }
  }

  async updateContractPrice(newPrice) {
    try {
      // Проверяем, что цена изменилась значительно (более чем на 1%)
      if (this.lastPrice) {
        const priceChange = Math.abs(newPrice - this.lastPrice) / this.lastPrice;
        if (priceChange < 0.01) {
          console.log("Цена изменилась менее чем на 1%, пропускаем обновление");
          return false;
        }
      }

      console.log(`🔄 Обновляем цену в контракте: ${newPrice} центов ($${newPrice / 100})`);
      
      const tx = await this.contract.updateEthUsdPrice(newPrice);
      await tx.wait();
      
      this.lastPrice = newPrice;
      this.lastUpdateTime = new Date();
      
      console.log("✅ Цена успешно обновлена в контракте");
      return true;
    } catch (error) {
      console.error("❌ Ошибка обновления цены в контракте:", error.message);
      throw error;
    }
  }

  async updatePriceWithRetry() {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const newPrice = await this.getCurrentEthPrice();
        await this.updateContractPrice(newPrice);
        return true;
      } catch (error) {
        console.error(`❌ Попытка ${attempt}/${this.maxRetries} неудачна:`, error.message);
        
        if (attempt < this.maxRetries) {
          console.log(`⏳ Ожидание ${this.retryDelay / 1000} секунд перед повтором...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
    
    console.error("❌ Все попытки обновления цены исчерпаны");
    return false;
  }

  async start() {
    if (this.isRunning) {
      console.log("⚠️ Оракул уже запущен");
      return;
    }

    console.log("🚀 Запуск Price Oracle...");
    this.isRunning = true;

    // Первоначальное обновление
    await this.updatePriceWithRetry();

    // Устанавливаем интервал для регулярных обновлений
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.updatePriceWithRetry();
      }
    }, this.updateInterval);

    console.log("✅ Price Oracle запущен и работает");
  }

  async stop() {
    if (!this.isRunning) {
      console.log("⚠️ Оракул не запущен");
      return;
    }

    console.log("🛑 Остановка Price Oracle...");
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log("✅ Price Oracle остановлен");
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdateTime: this.lastUpdateTime,
      lastPrice: this.lastPrice,
      updateInterval: this.updateInterval
    };
  }
}

// Функция для запуска оракула
async function startPriceOracle() {
  try {
    // Получаем адрес контракта из аргументов командной строки
    const contractAddress = process.argv[2];
    if (!contractAddress) {
      throw new Error("Необходимо указать адрес контракта");
    }

    // ABI для функции updateEthUsdPrice
    const contractABI = [
      "function updateEthUsdPrice(uint256 newPrice) external",
      "function ethUsdPrice() external view returns (uint256)",
      "function getInvestmentLimits() external view returns (uint256 minInvestmentUsd, uint256 maxInvestmentUsd, uint256 largeInvestmentUsd, uint256 currentEthUsdPrice, uint256 minInvestmentEth, uint256 maxInvestmentEth)"
    ];

    const oracle = new PriceOracle(contractAddress, contractABI);
    
    if (await oracle.initialize()) {
      await oracle.start();
      
      // Обработка сигналов для корректного завершения
      process.on('SIGINT', async () => {
        console.log("\n🛑 Получен сигнал завершения...");
        await oracle.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log("\n🛑 Получен сигнал завершения...");
        await oracle.stop();
        process.exit(0);
      });
    }
  } catch (error) {
    console.error("❌ Критическая ошибка:", error.message);
    process.exit(1);
  }
}

// Запускаем оракул, если файл вызван напрямую
if (require.main === module) {
  startPriceOracle();
}

module.exports = { PriceOracle, startPriceOracle };
