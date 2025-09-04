# 🚀 Инструкции по деплою DEFIMON

## ✅ Веб-интерфейс запущен!

Веб-интерфейс успешно запущен и доступен по адресу: **http://localhost:3000**

Chrome уже открыт с этой страницей.

## 📋 Пошаговый деплой

### 1. Подготовка .env файла

Создайте файл `.env` на основе `env.example`:

```bash
cp env.example .env
```

Заполните следующие переменные:

```env
# Infura API Key (получите на https://infura.io)
INFURA_API_KEY=your_infura_api_key_here

# Приватные ключи для мультиподписи (2 аккаунта)
PRIVATE_KEY_1=your_first_private_key_here
PRIVATE_KEY_2=your_second_private_key_here

# Etherscan API Key (для верификации)
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

### 2. Компиляция контрактов

```bash
npm run compile
```

### 3. Запуск тестов

```bash
npm test
```

### 4. Деплой на Sepolia

```bash
npm run deploy:sepolia
```

### 5. Верификация контрактов

```bash
npm run verify:sepolia
```

### 6. Обновление адресов в веб-интерфейсе

После деплоя обновите файл `deployed-contracts.json` с реальными адресами контрактов.

## 🔧 Что нужно для деплоя

### MetaMask
1. Установите [MetaMask](https://metamask.io) если еще не установлен
2. Создайте или импортируйте кошелек
3. Переключитесь на **Sepolia Testnet**
4. Получите тестовые ETH с [Sepolia Faucet](https://sepoliafaucet.com)

### Аккаунты для мультиподписи
Вам понадобится **3 аккаунта**:
- **Deployer** - для деплоя контрактов
- **Signer 1** - первый подписант для мультиподписи
- **Signer 2** - второй подписант для мультиподписи

### Тестовые ETH
Получите тестовые ETH для всех аккаунтов:
- [Sepolia Faucet](https://sepoliafaucet.com)
- [Alchemy Faucet](https://sepoliafaucet.com)
- [Chainlink Faucet](https://faucets.chain.link/sepolia)

## 🌐 Веб-интерфейс

После деплоя веб-интерфейс будет полностью функциональным:

### Для инвесторов:
1. Подключите MetaMask
2. Переключитесь на Sepolia Testnet
3. Получите тестовые ETH
4. Инвестируйте ETH → получите DEFI токены

### Для владельцев:
1. Создавайте запросы на вывод средств
2. Одобряйте через мультиподпись
3. Управляйте контрактом

## 📊 Мониторинг

После деплоя вы сможете отслеживать:
- [Sepolia Etherscan](https://sepolia.etherscan.io) - просмотр транзакций
- Веб-интерфейс - статистика и управление
- События контрактов - логирование операций

## 🆘 Решение проблем

### Ошибка "Insufficient funds"
- Получите больше тестовых ETH
- Проверьте баланс аккаунта

### Ошибка "Invalid network"
- Убедитесь, что используете Sepolia Testnet
- Проверьте RPC URL в MetaMask

### Ошибка компиляции
- Проверьте версии зависимостей
- Запустите `npm install --legacy-peer-deps`

## 🎯 Готово к деплою!

Все готово для деплоя. Следуйте инструкциям выше, и ваша DEFIMON платформа будет работать на Sepolia Testnet!

---

**Веб-интерфейс:** http://localhost:3000  
**Chrome:** Уже открыт с платформой  
**Статус:** Готов к деплою! 🚀
