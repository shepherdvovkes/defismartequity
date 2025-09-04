# DEFIMON Investment Platform

Децентрализованная платформа для инвестирования в проект DEFIMON с использованием смарт-контрактов на Ethereum Sepolia Testnet.

## Особенности

- **ERC20 токен DEFIMON**: 10 миллиардов токенов
- **Курс обмена**: 1 ETH = 100 DEFI токенов
- **Мультиподпись**: Для вывода средств требуется 2 из 2 подписей
- **Оптимизация газа**: Эффективное хранение данных инвесторов
- **MetaMask интеграция**: Безопасное подключение кошелька
- **Веб-интерфейс**: Современный и удобный UI

## Структура проекта

```
defismart/
├── contracts/                 # Смарт-контракты
│   ├── DefimonToken.sol      # ERC20 токен DEFIMON
│   └── DefimonInvestment.sol # Контракт для инвестиций
├── scripts/                  # Скрипты деплоя
│   └── deploy.js            # Деплой контрактов
├── test/                    # Тесты
│   └── DefimonTest.js       # Тесты контрактов
├── pages/                   # Next.js страницы
│   ├── api/                # API endpoints
│   ├── index.js            # Главная страница
│   └── _app.js             # App компонент
├── styles/                  # CSS стили
│   └── globals.css         # Глобальные стили
├── utils/                   # Утилиты
│   └── web3.js             # Web3 сервис
├── hardhat.config.js        # Конфигурация Hardhat
├── package.json            # Зависимости
└── README.md               # Документация
```

## Установка и настройка

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка переменных окружения

Создайте файл `.env` на основе `env.example`:

```bash
cp env.example .env
```

Заполните следующие переменные в `.env`:

```env
# Infura API Key для подключения к Sepolia
INFURA_API_KEY=your_infura_api_key_here

# Приватные ключи для мультиподписи (2 аккаунта)
PRIVATE_KEY_1=your_first_private_key_here
PRIVATE_KEY_2=your_second_private_key_here

# Etherscan API Key для верификации контрактов
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# Адреса контрактов (заполнятся после деплоя)
DEFIMON_TOKEN_ADDRESS=
INVESTMENT_CONTRACT_ADDRESS=
```

### 3. Компиляция контрактов

```bash
npm run compile
```

### 4. Запуск тестов

```bash
npm test
```

### 5. Деплой на Sepolia

```bash
npm run deploy:sepolia
```

После деплоя обновите переменные окружения с адресами контрактов.

### 6. Верификация контрактов

```bash
npx hardhat verify --network sepolia <TOKEN_ADDRESS>
npx hardhat verify --network sepolia <INVESTMENT_ADDRESS> <TOKEN_ADDRESS> <SIGNER1_ADDRESS> <SIGNER2_ADDRESS>
```

### 7. Запуск веб-приложения

```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:3000

## Использование

### Для инвесторов

1. **Установите MetaMask**
   - Скачайте расширение MetaMask
   - Создайте кошелек или импортируйте существующий

2. **Настройте Sepolia Testnet**
   - Переключитесь на Sepolia Testnet в MetaMask
   - Получите тестовые ETH с [Sepolia Faucet](https://sepoliafaucet.com/)

3. **Подключитесь к платформе**
   - Откройте веб-приложение
   - Нажмите "Подключить MetaMask"
   - Подтвердите подключение

4. **Инвестируйте**
   - Введите сумму в ETH
   - Нажмите "Инвестировать"
   - Подтвердите транзакцию в MetaMask
   - Получите DEFI токены

### Для владельцев контракта

#### Вывод средств (требует мультиподписи)

1. **Создание запроса на вывод**
   ```javascript
   const requestId = await defimonInvestment.requestWithdrawal(
     recipientAddress, 
     ethers.utils.parseEther("1.0")
   );
   ```

2. **Одобрение первым подписантом**
   ```javascript
   await defimonInvestment.connect(signer1).approveWithdrawal(requestId);
   ```

3. **Одобрение вторым подписантом** (автоматически выполняется)
   ```javascript
   await defimonInvestment.connect(signer2).approveWithdrawal(requestId);
   ```

#### Управление контрактом

- **Пауза/возобновление**: `pause()` / `unpause()`
- **Обновление подписантов**: `updateSigner(newSigner, signerIndex)`
- **Просмотр статистики**: `getContractInfo()`, `getInvestorInfo()`

## Смарт-контракты

### DefimonToken.sol

ERC20 токен с дополнительными функциями:

- **Общий выпуск**: 10,000,000,000 токенов
- **Название**: DEFIMON
- **Символ**: DEFI
- **Функции**: `transferTokens()`, `burnTokens()`

### DefimonInvestment.sol

Контракт для инвестиций с мультиподписью:

- **Курс обмена**: 1 ETH = 100 DEFI
- **Мультиподпись**: 2 из 2 для вывода средств
- **Отслеживание инвесторов**: Оптимизированное хранение
- **События**: Логирование всех операций

## Безопасность

- ✅ Использование OpenZeppelin библиотек
- ✅ Защита от реентрантности
- ✅ Мультиподпись для критических операций
- ✅ Пауза контракта в экстренных случаях
- ✅ Валидация входных данных
- ✅ Оптимизация газа

## Тестирование

Запустите полный набор тестов:

```bash
npm test
```

Тесты покрывают:
- Создание и настройку токенов
- Инвестиционные операции
- Мультиподпись
- Управление инвесторами
- Безопасность контрактов

## Развертывание

### Локальная сеть

```bash
npx hardhat node
npm run deploy:localhost
```

### Sepolia Testnet

```bash
npm run deploy:sepolia
```

### Mainnet (осторожно!)

```bash
npm run deploy:mainnet
```

## Мониторинг

- **Etherscan**: [Sepolia Explorer](https://sepolia.etherscan.io/)
- **События**: Все операции логируются в блокчейн
- **Статистика**: Доступна через веб-интерфейс

## Поддержка

При возникновении проблем:

1. Проверьте подключение к сети Sepolia
2. Убедитесь в наличии тестовых ETH
3. Проверьте логи в консоли браузера
4. Убедитесь в корректности адресов контрактов

## Лицензия

MIT License - см. файл LICENSE для деталей.

## Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Добавьте тесты
5. Создайте Pull Request

---

**Внимание**: Это тестовая версия для Sepolia Testnet. Не используйте в production без дополнительного аудита безопасности.
