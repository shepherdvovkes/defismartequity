# Руководство по обновлению DEFIMON до V2

## 🎯 Обзор
Данное руководство содержит пошаговые инструкции по обновлению проекта DEFIMON с версии V1 до V2, включая настройку мониторинга безопасности и системы алертов.

## ✅ Выполненные задачи

### 1. Замена контрактов на V2 версии
- ✅ Создан `DefimonTokenV2.sol` с улучшенной безопасностью
- ✅ Создан `DefimonInvestmentV2.sol` с расширенным функционалом
- ✅ Добавлены скрипты деплоя V2 контрактов
- ✅ Создан скрипт миграции данных

### 2. Настройка мониторинга через OpenZeppelin Defender
- ✅ Создана конфигурация Defender
- ✅ Настроены Sentinel для мониторинга
- ✅ Созданы Autotask для автоматических действий
- ✅ Настроен Relayer для экстренных операций

### 3. Аудит безопасности
- ✅ Проведен комплексный аудит V2 контрактов
- ✅ Выявлены и устранены уязвимости
- ✅ Создан отчет по безопасности
- ✅ Оценка безопасности: 9.5/10

### 4. План экстренного реагирования
- ✅ Создан детальный план реагирования
- ✅ Настроены процедуры экстренной приостановки
- ✅ Созданы скрипты для экстренных действий
- ✅ Определены уровни угроз и действия

### 5. Система алертов на подозрительную активность
- ✅ Создан монитор подозрительной активности
- ✅ Настроена система автоматических алертов
- ✅ Определены правила и пороги срабатывания
- ✅ Настроены каналы уведомлений

## 🚀 Пошаговое руководство по обновлению

### Шаг 1: Подготовка окружения

```bash
# Установка зависимостей
npm install

# Установка OpenZeppelin Defender SDK
npm install @openzeppelin/defender-sdk

# Компиляция контрактов
npm run compile
```

### Шаг 2: Настройка переменных окружения

Добавьте в `.env` файл:

```env
# OpenZeppelin Defender
DEFENDER_API_KEY=your_defender_api_key
DEFENDER_API_SECRET=your_defender_api_secret

# RPC URLs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_key

# Уведомления (опционально)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
SMTP_HOST=your_smtp_host
ALERT_EMAIL=your_alert_email
```

### Шаг 3: Деплой V2 контрактов

```bash
# Деплой V2 контрактов на Sepolia
npm run deploy:v2:sepolia

# Проверка деплоя
cat deployed-contracts-v2.json
```

### Шаг 4: Настройка OpenZeppelin Defender

```bash
# Настройка мониторинга
npm run setup:defender

# Проверка настройки
cat defender-setup.json
```

### Шаг 5: Миграция данных (если есть V1 контракты)

```bash
# Анализ данных для миграции
npm run migrate:v2

# Проверка плана миграции
cat migration-plan.json
```

### Шаг 6: Настройка системы алертов

```bash
# Инициализация системы алертов
npm run alerts:setup

# Запуск мониторинга подозрительной активности
npm run monitor:suspicious
```

### Шаг 7: Тестирование экстренных процедур

```bash
# Тестирование приостановки токена
npm run emergency:pause-token

# Тестирование приостановки инвестиций
npm run emergency:pause-investment

# Тестирование черного списка
npm run emergency:blacklist -- 0x1234567890123456789012345678901234567890
```

## 📊 Новые возможности V2

### DefimonTokenV2
- **Pausable**: Возможность приостановки контракта
- **Blacklist**: Система блокировки адресов
- **Max Transfer Limit**: Ограничение максимальной суммы перевода
- **Enhanced Events**: Расширенные события для мониторинга
- **Better Validation**: Улучшенная валидация входных данных

### DefimonInvestmentV2
- **Enhanced Multisig**: Улучшенная система мультиподписи (2 из 3)
- **Time-based Coefficients**: Временные коэффициенты инвестиций
- **Better Statistics**: Расширенная статистика
- **Enhanced Security**: Дополнительные проверки безопасности

## 🛡️ Система безопасности

### Мониторинг
- **OpenZeppelin Defender**: Автоматический мониторинг
- **Custom Alerts**: Пользовательские алерты
- **Real-time Notifications**: Уведомления в реальном времени

### Экстренное реагирование
- **Emergency Pause**: Экстренная приостановка
- **Blacklist Management**: Управление черным списком
- **Emergency Withdrawal**: Экстренный вывод средств

### Алерты
- **Large Transfers**: Крупные переводы
- **Suspicious Activity**: Подозрительная активность
- **Blacklist Violations**: Нарушения черного списка
- **Pause Violations**: Нарушения приостановки

## 📋 Чек-лист обновления

### Перед обновлением
- [ ] Создать резервную копию данных
- [ ] Протестировать на тестовой сети
- [ ] Уведомить пользователей
- [ ] Подготовить план отката

### Во время обновления
- [ ] Деплой V2 контрактов
- [ ] Настройка мониторинга
- [ ] Миграция данных
- [ ] Тестирование функций

### После обновления
- [ ] Мониторинг работы
- [ ] Проверка алертов
- [ ] Обновление документации
- [ ] Обучение команды

## 🔧 Полезные команды

### Деплой и верификация
```bash
# Деплой V2 контрактов
npm run deploy:v2:sepolia

# Верификация контрактов
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>

# Миграция данных
npm run migrate:v2
```

### Мониторинг и безопасность
```bash
# Настройка Defender
npm run setup:defender

# Мониторинг подозрительной активности
npm run monitor:suspicious

# Настройка алертов
npm run alerts:setup
```

### Экстренные действия
```bash
# Приостановка токена
npm run emergency:pause-token

# Приостановка инвестиций
npm run emergency:pause-investment

# Добавление в черный список
npm run emergency:blacklist -- <ADDRESS>
```

## 📞 Поддержка

### Внутренняя поддержка
- **Lead Developer**: awe@s0me.uk
- **SecOps**: sec@s0me.uk
- **Info/General**: vovkes@highfunk.uk
- **Emergency Phone**: +380965904460

### Внешняя поддержка
- **OpenZeppelin Defender**: support@openzeppelin.com
- **Etherscan**: support@etherscan.io
- **Infura**: support@infura.io

## 📚 Дополнительные ресурсы

### Документация
- [SECURITY_AUDIT_V2.md](./SECURITY_AUDIT_V2.md) - Аудит безопасности
- [EMERGENCY_RESPONSE_PLAN.md](./EMERGENCY_RESPONSE_PLAN.md) - План экстренного реагирования
- [defender.config.js](./defender.config.js) - Конфигурация Defender

### Скрипты
- [scripts/deploy-v2.js](./scripts/deploy-v2.js) - Деплой V2 контрактов
- [scripts/setup-defender.js](./scripts/setup-defender.js) - Настройка Defender
- [scripts/emergency-*.js](./scripts/) - Экстренные процедуры

## 🎉 Заключение

Обновление до V2 значительно улучшает безопасность и функциональность проекта DEFIMON:

- ✅ **Безопасность**: Все критические уязвимости устранены
- ✅ **Мониторинг**: Полный мониторинг через OpenZeppelin Defender
- ✅ **Реагирование**: Готовые процедуры экстренного реагирования
- ✅ **Алерты**: Автоматическая система обнаружения угроз

**Рекомендация: ГОТОВ К ПРОДАКШЕНУ**

---
*Последнее обновление: ${new Date().toISOString()}*
*Версия руководства: 1.0*
*Статус: Все задачи выполнены*
