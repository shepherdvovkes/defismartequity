# DEFIMON V2 - Новые функции безопасности и управления

## Обзор

Версия 2 контрактов DEFIMON включает расширенные функции безопасности, мониторинга и управления для обеспечения надежности и прозрачности инвестиционной платформы.

## 🚀 Новые функции

### 1. Лимиты инвестиций

#### Параметры лимитов:
- **Минимальная инвестиция**: 20 USD
- **Максимальная инвестиция**: 100,000 USD
- **Крупные инвестиции**: ≥ 100,000 USD требуют одобрения мультиподписи (2 из 3)

#### Функции:
```solidity
// Проверка лимитов инвестиций
function checkInvestmentLimits(uint256 ethAmount) public view returns (bool isWithinLimits, bool requiresApproval)

// Получение информации о лимитах
function getInvestmentLimits() external view returns (
    uint256 minInvestmentUsd,
    uint256 maxInvestmentUsd,
    uint256 largeInvestmentUsd,
    uint256 currentEthUsdPrice,
    uint256 minInvestmentEth,
    uint256 maxInvestmentEth
)
```

### 2. Система черного списка

#### Функции управления:
```solidity
// Управление черным списком
function setBlacklist(address account, bool status) external onlyOwner

// События
event AddressBlacklisted(address indexed account, bool status)
```

#### Защита:
- Заблокированные адреса не могут инвестировать
- Заблокированные адреса не могут переводить/получать токены
- Владелец и подписанты не могут быть заблокированы

### 3. Улучшенная генерация requestId

#### Новый алгоритм:
```solidity
// Счетчик для уникальности
uint256 private requestCounter = 0;

// Генерация с использованием счетчика
bytes32 requestId = keccak256(abi.encodePacked(
    msg.sender, 
    msg.value, 
    block.timestamp, 
    block.number, 
    requestCounter
));
```

### 4. Крупные инвестиции с мультиподписью

#### Процесс одобрения:
1. Инвестор создает запрос через `requestLargeInvestment()`
2. Подписанты одобряют через `approveLargeInvestment()`
3. При получении 2 из 3 одобрений инвестиция выполняется автоматически

#### Структура запроса:
```solidity
struct LargeInvestmentRequest {
    address investor;
    uint256 ethAmount;
    uint256 usdAmount;
    bool approvedBySigner1;
    bool approvedBySigner2;
    bool approvedBySigner3;
    bool executed;
    uint256 timestamp;
    string reason;
}
```

### 5. Экстренные функции

#### Управление контрактом:
```solidity
// Экстренная приостановка
function emergencyPause() external onlyOwner

// Снятие приостановки
function emergencyUnpause() external onlyOwner

// Экстренный вывод средств
function emergencyWithdraw(address to) external onlyOwner

// Экстренный вывод токенов
function emergencyWithdrawTokens(address to, uint256 amount) external onlyOwner
```

#### Управление ценой:
```solidity
// Обновление курса ETH/USD
function updateEthUsdPrice(uint256 newPrice) external onlyOwner

// События
event EthUsdPriceUpdated(uint256 oldPrice, uint256 newPrice)
```

### 6. Расширенный мониторинг

#### Новые события:
- `LargeInvestmentRequested` - запрос на крупную инвестицию
- `LargeInvestmentApproved` - одобрение крупной инвестиции
- `LargeInvestmentExecuted` - выполнение крупной инвестиции
- `AddressBlacklisted` - изменение статуса черного списка
- `EthUsdPriceUpdated` - обновление курса
- `InvestmentLimitExceeded` - превышение лимитов

## 🛠️ Скрипты управления

### 1. Экстренный менеджер
```bash
# Показать статус системы
npx hardhat run scripts/emergency-manager.js --network sepolia -- status

# Приостановить систему
npx hardhat run scripts/emergency-manager.js --network sepolia -- pause

# Снять приостановку
npx hardhat run scripts/emergency-manager.js --network sepolia -- unpause

# Экстренный вывод средств
npx hardhat run scripts/emergency-manager.js --network sepolia -- withdraw 0x...

# Управление черным списком
npx hardhat run scripts/emergency-manager.js --network sepolia -- blacklist 0x... true

# Обновить курс ETH/USD
npx hardhat run scripts/emergency-manager.js --network sepolia -- price 2500
```

### 2. Управление черным списком
```bash
# Добавить в черный список
npx hardhat run scripts/emergency-blacklist.js --network sepolia -- 0x...

# Удалить из черного списка
npx hardhat run scripts/emergency-unblacklist.js --network sepolia -- 0x...

# Проверить статус
npx hardhat run scripts/check-blacklist-status.js --network sepolia -- 0x...
```

### 3. Управление крупными инвестициями
```bash
# Одобрить крупную инвестицию
npx hardhat run scripts/emergency-large-investment.js --network sepolia -- approve <requestId>

# Отклонить крупную инвестицию
npx hardhat run scripts/emergency-large-investment.js --network sepolia -- reject <requestId>

# Список запросов
npx hardhat run scripts/emergency-large-investment.js --network sepolia -- list

# Статус запроса
npx hardhat run scripts/emergency-large-investment.js --network sepolia -- status <requestId>
```

### 4. Управление ценой
```bash
# Ручное обновление цены
npx hardhat run scripts/emergency-update-price.js --network sepolia -- manual 2500

# Автоматическое обновление с CoinGecko
npx hardhat run scripts/emergency-update-price.js --network sepolia -- coingecko

# Автоматическое обновление с CoinMarketCap
npx hardhat run scripts/emergency-update-price.js --network sepolia -- coinmarketcap
```

### 5. Мониторинг и отчеты
```bash
# Проверка лимитов инвестиций
npx hardhat run scripts/check-investment-limits.js --network sepolia -- 1.5

# Мониторинговая панель
npx hardhat run scripts/monitoring-dashboard.js --network sepolia

# Мониторинг подозрительной активности
npx hardhat run scripts/suspicious-activity-monitor.js --network sepolia
```

## 📊 Мониторинг событий

### Расширенные алерты:
- **LARGE_INVESTMENT_REQUEST** - запросы на крупные инвестиции
- **SUSPICIOUS_INVESTMENT_REASON** - подозрительные причины инвестиций
- **BLACKLIST_ACTIVITY** - активность черного списка
- **SIGNIFICANT_PRICE_CHANGE** - значительные изменения цены
- **INVESTMENT_LIMIT_EXCEEDED** - превышение лимитов

### Пороги алертов:
- Крупные переводы: > 1000 ETH
- Крупные инвестиции: > 100 ETH
- Быстрые транзакции: > 10 в час
- Изменение цены: > 20%

## 🔒 Безопасность

### Многоуровневая защита:
1. **Лимиты инвестиций** - предотвращение аномальных транзакций
2. **Черный список** - блокировка подозрительных адресов
3. **Мультиподпись** - контроль крупных операций
4. **Мониторинг** - отслеживание подозрительной активности
5. **Экстренные функции** - быстрое реагирование на угрозы

### Права доступа:
- **Владелец**: полный контроль над контрактом
- **Подписанты**: одобрение крупных инвестиций и выводов
- **Инвесторы**: стандартные инвестиции в пределах лимитов

## 📈 Аналитика

### Отчеты:
- `monitoring-report.json` - общий отчет системы
- `emergency-logs.json` - логи экстренных действий
- `large-investment-logs.json` - логи крупных инвестиций
- `price-update-logs.json` - логи изменений цены
- `security-alerts.json` - алерты безопасности

### Метрики:
- Количество инвесторов
- Объем инвестиций
- Статус черного списка
- Активность крупных инвестиций
- Изменения курса ETH/USD

## 🚨 Процедуры экстренного реагирования

### 1. Обнаружение подозрительной активности:
```bash
# Запустить мониторинг
npx hardhat run scripts/suspicious-activity-monitor.js --network sepolia

# Проверить статус адреса
npx hardhat run scripts/check-blacklist-status.js --network sepolia -- <address>
```

### 2. Блокировка подозрительного адреса:
```bash
# Добавить в черный список
npx hardhat run scripts/emergency-blacklist.js --network sepolia -- <address>
```

### 3. Экстренная приостановка:
```bash
# Приостановить систему
npx hardhat run scripts/emergency-manager.js --network sepolia -- pause
```

### 4. Экстренный вывод средств:
```bash
# Вывести все средства
npx hardhat run scripts/emergency-manager.js --network sepolia -- withdraw <safe-address>
```

## 📋 Чек-лист безопасности

### Ежедневно:
- [ ] Проверить статус системы
- [ ] Просмотреть алерты безопасности
- [ ] Проверить балансы контрактов

### Еженедельно:
- [ ] Обновить курс ETH/USD
- [ ] Проверить активность крупных инвестиций
- [ ] Проанализировать отчеты мониторинга

### При подозрительной активности:
- [ ] Запустить мониторинг
- [ ] Проверить статус адресов
- [ ] При необходимости заблокировать адреса
- [ ] Уведомить команду безопасности

## 🔧 Техническая поддержка

### Логи и отладка:
- Все действия логируются в JSON файлы
- Транзакции содержат полную информацию
- События контрактов отслеживаются автоматически

### Восстановление:
- Экстренные функции позволяют быстро реагировать
- Мультиподпись обеспечивает контроль
- Резервное копирование состояния контрактов

---

**Версия**: 2.0  
**Дата обновления**: $(date)  
**Статус**: Готово к продакшену
