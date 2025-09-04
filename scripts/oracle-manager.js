const { PriceOracle } = require('./price-oracle');
const { PriceMonitor } = require('./price-monitor');
const { ethers } = require("hardhat");
require("dotenv").config();

class OracleManager {
  constructor(contractAddress) {
    this.contractAddress = contractAddress;
    this.oracle = null;
    this.monitor = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      console.log("🚀 Инициализация Oracle Manager...");
      
      // Инициализируем оракул
      const contractABI = [
        "function updateEthUsdPrice(uint256 newPrice) external",
        "function ethUsdPrice() external view returns (uint256)",
        "function getPriceInfo() external view returns (uint256 currentPrice, uint256 lastUpdateTime, uint256 updateCount, bool isValid)",
        "function getInvestmentLimits() external view returns (uint256 minInvestmentUsd, uint256 maxInvestmentUsd, uint256 largeInvestmentUsd, uint256 currentEthUsdPrice, uint256 minInvestmentEth, uint256 maxInvestmentEth)"
      ];

      this.oracle = new PriceOracle(this.contractAddress, contractABI);
      this.monitor = new PriceMonitor(this.contractAddress);

      const oracleInitialized = await this.oracle.initialize();
      const monitorInitialized = await this.monitor.initialize();

      if (oracleInitialized && monitorInitialized) {
        console.log("✅ Oracle Manager успешно инициализирован");
        return true;
      } else {
        throw new Error("Ошибка инициализации компонентов");
      }
    } catch (error) {
      console.error("❌ Ошибка инициализации Oracle Manager:", error.message);
      return false;
    }
  }

  async start() {
    if (this.isRunning) {
      console.log("⚠️ Oracle Manager уже запущен");
      return;
    }

    try {
      console.log("🚀 Запуск Oracle Manager...");
      
      // Запускаем мониторинг
      await this.monitor.startMonitoring();
      
      // Запускаем оракул
      await this.oracle.start();
      
      this.isRunning = true;
      console.log("✅ Oracle Manager запущен и работает");
      
      // Показываем статус каждые 5 минут
      this.statusInterval = setInterval(() => {
        this.showStatus();
      }, 5 * 60 * 1000);
      
    } catch (error) {
      console.error("❌ Ошибка запуска Oracle Manager:", error.message);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      console.log("⚠️ Oracle Manager не запущен");
      return;
    }

    try {
      console.log("🛑 Остановка Oracle Manager...");
      
      if (this.oracle) {
        await this.oracle.stop();
      }
      
      if (this.monitor) {
        await this.monitor.stopMonitoring();
      }
      
      if (this.statusInterval) {
        clearInterval(this.statusInterval);
        this.statusInterval = null;
      }
      
      this.isRunning = false;
      console.log("✅ Oracle Manager остановлен");
      
    } catch (error) {
      console.error("❌ Ошибка остановки Oracle Manager:", error.message);
      throw error;
    }
  }

  async showStatus() {
    try {
      console.log("\n📊 === СТАТУС ORACLE MANAGER ===");
      
      if (this.oracle) {
        const oracleStatus = this.oracle.getStatus();
        console.log(`🔧 Оракул: ${oracleStatus.isRunning ? '🟢 Работает' : '🔴 Остановлен'}`);
        console.log(`📈 Последнее обновление: ${oracleStatus.lastUpdateTime || 'Никогда'}`);
        console.log(`💰 Последняя цена: ${oracleStatus.lastPrice ? `$${oracleStatus.lastPrice / 100}` : 'Неизвестно'}`);
      }
      
      if (this.monitor) {
        const monitorStatus = this.monitor.getStatus();
        console.log(`👁️ Мониторинг: ${monitorStatus.isRunning ? '🟢 Работает' : '🔴 Остановлен'}`);
        console.log(`📊 История цен: ${monitorStatus.historySize} записей`);
      }
      
      // Получаем информацию из контракта
      const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_URL);
      const contractABI = [
        "function getPriceInfo() external view returns (uint256 currentPrice, uint256 lastUpdateTime, uint256 updateCount, bool isValid)"
      ];
      const contract = new ethers.Contract(this.contractAddress, contractABI, provider);
      
      const priceInfo = await contract.getPriceInfo();
      const lastUpdate = new Date(priceInfo.lastUpdateTime.toNumber() * 1000);
      const timeSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
      
      console.log(`📋 Контракт:`);
      console.log(`   Цена: $${priceInfo.currentPrice.toNumber() / 100}`);
      console.log(`   Обновлений: ${priceInfo.updateCount}`);
      console.log(`   Валидность: ${priceInfo.isValid ? '✅ Актуальна' : '⚠️ Устарела'}`);
      console.log(`   Время с обновления: ${Math.floor(timeSinceUpdate / 60)} минут`);
      
      console.log("================================\n");
      
    } catch (error) {
      console.error("❌ Ошибка получения статуса:", error.message);
    }
  }

  async getContractInfo() {
    try {
      const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_URL);
      const contractABI = [
        "function getPriceInfo() external view returns (uint256 currentPrice, uint256 lastUpdateTime, uint256 updateCount, bool isValid)",
        "function getInvestmentLimits() external view returns (uint256 minInvestmentUsd, uint256 maxInvestmentUsd, uint256 largeInvestmentUsd, uint256 currentEthUsdPrice, uint256 minInvestmentEth, uint256 maxInvestmentEth)"
      ];
      const contract = new ethers.Contract(this.contractAddress, contractABI, provider);
      
      const [priceInfo, limits] = await Promise.all([
        contract.getPriceInfo(),
        contract.getInvestmentLimits()
      ]);
      
      return {
        price: {
          current: priceInfo.currentPrice.toNumber() / 100,
          lastUpdate: new Date(priceInfo.lastUpdateTime.toNumber() * 1000),
          updateCount: priceInfo.updateCount.toNumber(),
          isValid: priceInfo.isValid
        },
        limits: {
          minUsd: limits.minInvestmentUsd.toNumber(),
          maxUsd: limits.maxInvestmentUsd.toNumber(),
          largeUsd: limits.largeInvestmentUsd.toNumber(),
          minEth: parseFloat(ethers.utils.formatEther(limits.minInvestmentEth)),
          maxEth: parseFloat(ethers.utils.formatEther(limits.maxInvestmentEth))
        }
      };
    } catch (error) {
      console.error("❌ Ошибка получения информации о контракте:", error.message);
      throw error;
    }
  }
}

// Функция для запуска Oracle Manager
async function startOracleManager() {
  try {
    const contractAddress = process.argv[2];
    if (!contractAddress) {
      throw new Error("Необходимо указать адрес контракта");
    }

    const manager = new OracleManager(contractAddress);
    
    if (await manager.initialize()) {
      await manager.start();
      
      // Показываем начальный статус
      await manager.showStatus();
      
      // Обработка сигналов для корректного завершения
      process.on('SIGINT', async () => {
        console.log("\n🛑 Получен сигнал завершения...");
        await manager.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log("\n🛑 Получен сигнал завершения...");
        await manager.stop();
        process.exit(0);
      });
    }
  } catch (error) {
    console.error("❌ Критическая ошибка:", error.message);
    process.exit(1);
  }
}

// Запускаем Oracle Manager, если файл вызван напрямую
if (require.main === module) {
  startOracleManager();
}

module.exports = { OracleManager, startOracleManager };
