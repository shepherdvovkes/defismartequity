const { ethers } = require("hardhat");
const axios = require("axios");
require("dotenv").config();

class PriceMonitor {
  constructor(contractAddress) {
    this.contractAddress = contractAddress;
    this.quicknodeUrl = process.env.QUICKNODE_API_KEY ? 
      `https://${process.env.QUICKNODE_API_KEY}.ethereum-sepolia.quiknode.pro/` : 
      process.env.SEPOLIA_URL;
    this.monitoringInterval = 2 * 60 * 1000; // 2 минуты
    this.alertThreshold = 5; // 5% изменение цены
    this.isRunning = false;
    this.lastPrice = null;
    this.priceHistory = [];
    this.maxHistorySize = 100;
  }

  async initialize() {
    try {
      // Подключаемся к QuickNode для более стабильного соединения
      const provider = new ethers.providers.JsonRpcProvider(this.quicknodeUrl);
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      
      // ABI для мониторинга
      const contractABI = [
        "function getPriceInfo() external view returns (uint256 currentPrice, uint256 lastUpdateTime, uint256 updateCount, bool isValid)",
        "function updateEthUsdPrice(uint256 newPrice) external",
        "event EthUsdPriceUpdated(uint256 oldPrice, uint256 newPrice, uint256 timestamp, uint256 updateCount)",
        "event PriceUpdateFailed(string reason, uint256 attemptedPrice)",
        "event PriceValidityWarning(uint256 lastUpdateTime, uint256 currentTime)"
      ];
      
      this.contract = new ethers.Contract(this.contractAddress, contractABI, wallet);
      
      console.log("✅ Price Monitor инициализирован");
              console.log(`Контракт: ${this.contractAddress}`);
      console.log(`🔗 QuickNode URL: ${this.quicknodeUrl.substring(0, 50)}...`);
      console.log(`⏰ Интервал мониторинга: ${this.monitoringInterval / 1000} секунд`);
      
      return true;
    } catch (error) {
      console.error("❌ Ошибка инициализации монитора:", error.message);
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
        return response.data.ethereum.usd;
      } else {
        throw new Error("Неверный формат ответа от CoinGecko");
      }
    } catch (error) {
      console.error("❌ Ошибка получения цены ETH:", error.message);
      throw error;
    }
  }

  async getContractPriceInfo() {
    try {
      const priceInfo = await this.contract.getPriceInfo();
      return {
        currentPrice: priceInfo.currentPrice.toNumber() / 100, // Конвертируем из центов
        lastUpdateTime: priceInfo.lastUpdateTime.toNumber(),
        updateCount: priceInfo.updateCount.toNumber(),
        isValid: priceInfo.isValid
      };
    } catch (error) {
      console.error("❌ Ошибка получения информации о цене из контракта:", error.message);
      throw error;
    }
  }

  calculatePriceChange(currentPrice, previousPrice) {
    if (!previousPrice) return 0;
    return ((currentPrice - previousPrice) / previousPrice) * 100;
  }

  async checkPriceDiscrepancy() {
    try {
      const marketPrice = await this.getCurrentEthPrice();
      const contractInfo = await this.getContractPriceInfo();
      
      const priceDifference = Math.abs(marketPrice - contractInfo.currentPrice);
      const priceDifferencePercent = (priceDifference / marketPrice) * 100;
      
              console.log(`Рыночная цена: $${marketPrice}`);
        console.log(`Цена в контракте: $${contractInfo.currentPrice}`);
        console.log(`Разница: ${priceDifferencePercent.toFixed(2)}%`);
      
      // Проверяем валидность цены в контракте
      if (!contractInfo.isValid) {
        const timeSinceUpdate = Math.floor((Date.now() / 1000) - contractInfo.lastUpdateTime);
        console.log(`⚠️ Цена в контракте устарела на ${timeSinceUpdate} секунд`);
        await this.sendAlert(`Цена в контракте устарела на ${Math.floor(timeSinceUpdate / 3600)} часов`);
      }
      
      // Проверяем значительное расхождение цен
      if (priceDifferencePercent > this.alertThreshold) {
        console.log(`Значительное расхождение цен: ${priceDifferencePercent.toFixed(2)}%`);
        await this.sendAlert(`Значительное расхождение цен: ${priceDifferencePercent.toFixed(2)}%`);
      }
      
      // Сохраняем в историю
      this.priceHistory.push({
        timestamp: Date.now(),
        marketPrice,
        contractPrice: contractInfo.currentPrice,
        difference: priceDifferencePercent
      });
      
      // Ограничиваем размер истории
      if (this.priceHistory.length > this.maxHistorySize) {
        this.priceHistory.shift();
      }
      
      return {
        marketPrice,
        contractPrice: contractInfo.currentPrice,
        difference: priceDifferencePercent,
        isValid: contractInfo.isValid
      };
    } catch (error) {
      console.error("❌ Ошибка проверки расхождения цен:", error.message);
      throw error;
    }
  }

  async sendAlert(message) {
    try {
      // Здесь можно добавить отправку уведомлений (email, Slack, Telegram и т.д.)
              console.log(`АЛЕРТ: ${message}`);
      
      // Пример отправки в лог файл
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ALERT: ${message}\n`;
      
      // В реальном проекте здесь была бы отправка уведомлений
      console.log(`📧 Уведомление отправлено: ${message}`);
    } catch (error) {
      console.error("❌ Ошибка отправки уведомления:", error.message);
    }
  }

  async startMonitoring() {
    if (this.isRunning) {
      console.log("⚠️ Мониторинг уже запущен");
      return;
    }

    console.log("🚀 Запуск мониторинга цен...");
    this.isRunning = true;

    // Первоначальная проверка
    await this.checkPriceDiscrepancy();

    // Устанавливаем интервал для регулярного мониторинга
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        try {
          await this.checkPriceDiscrepancy();
        } catch (error) {
          console.error("❌ Ошибка в цикле мониторинга:", error.message);
        }
      }
    }, this.monitoringInterval);

    console.log("✅ Мониторинг цен запущен");
  }

  async stopMonitoring() {
    if (!this.isRunning) {
      console.log("⚠️ Мониторинг не запущен");
      return;
    }

    console.log("🛑 Остановка мониторинга...");
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log("✅ Мониторинг остановлен");
  }

  getPriceHistory() {
    return this.priceHistory;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastPrice: this.lastPrice,
      historySize: this.priceHistory.length,
      monitoringInterval: this.monitoringInterval
    };
  }
}

// Функция для запуска мониторинга
async function startPriceMonitoring() {
  try {
    const contractAddress = process.argv[2];
    if (!contractAddress) {
      throw new Error("Необходимо указать адрес контракта");
    }

    const monitor = new PriceMonitor(contractAddress);
    
    if (await monitor.initialize()) {
      await monitor.startMonitoring();
      
      // Обработка сигналов для корректного завершения
      process.on('SIGINT', async () => {
        console.log("\n🛑 Получен сигнал завершения...");
        await monitor.stopMonitoring();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log("\n🛑 Получен сигнал завершения...");
        await monitor.stopMonitoring();
        process.exit(0);
      });
    }
  } catch (error) {
    console.error("❌ Критическая ошибка:", error.message);
    process.exit(1);
  }
}

// Запускаем мониторинг, если файл вызван напрямую
if (require.main === module) {
  startPriceMonitoring();
}

module.exports = { PriceMonitor, startPriceMonitoring };
