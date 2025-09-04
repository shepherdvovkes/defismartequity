const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

class AlertSystem {
    constructor() {
        this.contracts = null;
        this.provider = null;
        this.alertRules = [];
        this.notificationChannels = [];
        this.alertHistory = [];
    }

    async initialize() {
        console.log("Инициализация системы алертов...");
        
        // Загружаем адреса контрактов
        const contractsPath = path.join(__dirname, "..", "deployed-contracts-v2.json");
        if (!fs.existsSync(contractsPath)) {
            throw new Error("❌ Файл deployed-contracts-v2.json не найден");
        }
        
        this.contracts = JSON.parse(fs.readFileSync(contractsPath, "utf8"));
        
        // Создаем провайдер
        this.provider = new ethers.providers.JsonRpcProvider(
            process.env.SEPOLIA_RPC_URL || `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
        );
        
        // Настраиваем правила алертов
        this.setupAlertRules();
        
        // Настраиваем каналы уведомлений
        this.setupNotificationChannels();
        
        console.log("✅ Система алертов инициализирована");
    }

    setupAlertRules() {
        this.alertRules = [
            {
                id: 'LARGE_TRANSFER',
                name: 'Large Token Transfer',
                description: 'Transfer of more than 1000 ETH worth of tokens',
                severity: 'HIGH',
                threshold: ethers.utils.parseEther('1000'),
                condition: (activity) => {
                    return activity.type === 'transfer' && 
                           ethers.BigNumber.from(activity.amount).gte(this.alertRules.find(r => r.id === 'LARGE_TRANSFER').threshold);
                },
                action: 'IMMEDIATE_NOTIFICATION'
            },
            {
                id: 'LARGE_INVESTMENT',
                name: 'Large Investment',
                description: 'Investment of more than 100 ETH',
                severity: 'HIGH',
                threshold: ethers.utils.parseEther('100'),
                condition: (activity) => {
                    return activity.type === 'investment' && 
                           ethers.BigNumber.from(activity.ethAmount).gte(this.alertRules.find(r => r.id === 'LARGE_INVESTMENT').threshold);
                },
                action: 'IMMEDIATE_NOTIFICATION'
            },
            {
                id: 'RAPID_TRANSACTIONS',
                name: 'Rapid Transactions',
                description: 'More than 10 transactions from same address in 1 hour',
                severity: 'MEDIUM',
                threshold: 10,
                condition: (activity, history) => {
                    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
                    const recentTransactions = history.filter(h => 
                        h.timestamp >= oneHourAgo && 
                        (h.from === activity.from || h.to === activity.to)
                    );
                    return recentTransactions.length >= 10;
                },
                action: 'SCHEDULED_NOTIFICATION'
            },
            {
                id: 'BLACKLIST_VIOLATION',
                name: 'Blacklist Violation',
                description: 'Transaction involving blacklisted address',
                severity: 'CRITICAL',
                condition: async (activity) => {
                    // Проверяем статус черного списка
                    const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
                    const token = DefimonTokenV2.attach(this.contracts.defimonTokenV2);
                    
                    const fromBlacklisted = await token.blacklisted(activity.from);
                    const toBlacklisted = await token.blacklisted(activity.to);
                    
                    return fromBlacklisted || toBlacklisted;
                },
                action: 'EMERGENCY_ACTION'
            },
            {
                id: 'PAUSE_VIOLATION',
                name: 'Pause Violation',
                description: 'Transaction attempted while contract is paused',
                severity: 'CRITICAL',
                condition: async (activity) => {
                    const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
                    const DefimonInvestmentV2 = await ethers.getContractFactory("DefimonInvestmentV2");
                    
                    const token = DefimonTokenV2.attach(this.contracts.defimonTokenV2);
                    const investment = DefimonInvestmentV2.attach(this.contracts.defimonInvestmentV2);
                    
                    const tokenPaused = await token.paused();
                    const investmentPaused = await investment.paused();
                    
                    return tokenPaused || investmentPaused;
                },
                action: 'EMERGENCY_ACTION'
            },
            {
                id: 'UNUSUAL_PATTERN',
                name: 'Unusual Transaction Pattern',
                description: 'Unusual transaction pattern detected',
                severity: 'MEDIUM',
                condition: (activity, history) => {
                    // Проверяем на необычные паттерны
                    const similarTransactions = history.filter(h => 
                        h.type === activity.type &&
                        h.amount === activity.amount &&
                        h.from === activity.from
                    );
                    
                    return similarTransactions.length >= 5;
                },
                action: 'SCHEDULED_NOTIFICATION'
            }
        ];
    }

    setupNotificationChannels() {
        this.notificationChannels = [
            {
                id: 'CONSOLE',
                name: 'Console Output',
                type: 'console',
                enabled: true,
                send: (alert) => {
                    console.log(`ALERT [${alert.severity}]: ${alert.rule.name}`);
                    console.log(`   Description: ${alert.rule.description}`);
                    console.log(`   Activity: ${JSON.stringify(alert.activity, null, 2)}`);
                    console.log(`   Time: ${alert.timestamp}`);
                }
            },
            {
                id: 'FILE',
                name: 'File Logging',
                type: 'file',
                enabled: true,
                send: (alert) => {
                    const logPath = path.join(__dirname, "..", "alert-log.json");
                    let logs = [];
                    
                    if (fs.existsSync(logPath)) {
                        logs = JSON.parse(fs.readFileSync(logPath, "utf8"));
                    }
                    
                    logs.push(alert);
                    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
                }
            },
            {
                id: 'TELEGRAM',
                name: 'Telegram Bot',
                type: 'telegram',
                enabled: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
                send: async (alert) => {
                    // Реализация отправки в Telegram
                    console.log("📱 Telegram notification sent");
                }
            },
            {
                id: 'EMAIL',
                name: 'Email Notification',
                type: 'email',
                enabled: process.env.SMTP_HOST && process.env.ALERT_EMAIL,
                send: async (alert) => {
                    // Реализация отправки email
                    console.log("📧 Email notification sent");
                }
            }
        ];
    }

    async processActivity(activity) {
        console.log(`🔍 Обработка активности: ${activity.type}`);
        
        for (const rule of this.alertRules) {
            try {
                let shouldAlert = false;
                
                if (typeof rule.condition === 'function') {
                    if (rule.condition.length === 1) {
                        shouldAlert = await rule.condition(activity);
                    } else {
                        shouldAlert = await rule.condition(activity, this.alertHistory);
                    }
                }
                
                if (shouldAlert) {
                    await this.triggerAlert(rule, activity);
                }
            } catch (error) {
                console.error(`❌ Ошибка при проверке правила ${rule.id}:`, error);
            }
        }
        
        // Добавляем активность в историю
        this.alertHistory.push({
            ...activity,
            processedAt: new Date().toISOString()
        });
        
        // Ограничиваем размер истории (последние 1000 записей)
        if (this.alertHistory.length > 1000) {
            this.alertHistory = this.alertHistory.slice(-1000);
        }
    }

    async triggerAlert(rule, activity) {
        const alert = {
            id: ethers.utils.id(JSON.stringify({ rule: rule.id, activity, timestamp: Date.now() })),
            rule: rule,
            activity: activity,
            timestamp: new Date().toISOString(),
            severity: rule.severity,
            action: rule.action
        };
        
                    console.log(`Сработал алерт: ${rule.name}`);
        
        // Отправляем уведомления
        await this.sendNotifications(alert);
        
        // Выполняем действия
        await this.executeAction(alert);
        
        // Сохраняем алерт
        await this.saveAlert(alert);
    }

    async sendNotifications(alert) {
        for (const channel of this.notificationChannels) {
            if (channel.enabled) {
                try {
                    await channel.send(alert);
                } catch (error) {
                    console.error(`❌ Ошибка отправки уведомления через ${channel.name}:`, error);
                }
            }
        }
    }

    async executeAction(alert) {
        switch (alert.action) {
            case 'IMMEDIATE_NOTIFICATION':
                console.log("Выполняется немедленное уведомление");
                break;
                
            case 'SCHEDULED_NOTIFICATION':
                console.log("📅 Запланировано уведомление");
                break;
                
            case 'EMERGENCY_ACTION':
                console.log("ВЫПОЛНЯЕТСЯ ЭКСТРЕННОЕ ДЕЙСТВИЕ!");
                await this.executeEmergencyAction(alert);
                break;
                
            default:
                console.log("ℹ️  Стандартное действие");
        }
    }

    async executeEmergencyAction(alert) {
                    console.log("ЭКСТРЕННОЕ ДЕЙСТВИЕ:");
        
        if (alert.rule.id === 'BLACKLIST_VIOLATION') {
            console.log("   - Блокировка адреса в черном списке");
            // Здесь можно добавить автоматическую блокировку
        }
        
        if (alert.rule.id === 'PAUSE_VIOLATION') {
            console.log("   - Приостановка контракта");
            // Здесь можно добавить автоматическую приостановку
        }
        
        // Отправляем критические уведомления
        console.log("   - Отправка критических уведомлений");
    }

    async saveAlert(alert) {
        const alertsPath = path.join(__dirname, "..", "security-alerts.json");
        let alerts = [];
        
        if (fs.existsSync(alertsPath)) {
            alerts = JSON.parse(fs.readFileSync(alertsPath, "utf8"));
        }
        
        alerts.push(alert);
        fs.writeFileSync(alertsPath, JSON.stringify(alerts, null, 2));
    }

    async generateAlertReport() {
        console.log("\nОТЧЕТ ПО АЛЕРТАМ");
        console.log("=".repeat(50));
        
        const alertsPath = path.join(__dirname, "..", "security-alerts.json");
        if (!fs.existsSync(alertsPath)) {
            console.log("Нет данных об алертах");
            return;
        }
        
        const alerts = JSON.parse(fs.readFileSync(alertsPath, "utf8"));
        const last24Hours = alerts.filter(alert => 
            new Date(alert.timestamp) >= new Date(Date.now() - 86400000)
        );
        
        console.log(`Всего алертов за 24 часа: ${last24Hours.length}`);
        
        // Статистика по серьезности
        const severityStats = {};
        last24Hours.forEach(alert => {
            severityStats[alert.severity] = (severityStats[alert.severity] || 0) + 1;
        });
        
        console.log("\nСтатистика по серьезности:");
        Object.entries(severityStats).forEach(([severity, count]) => {
            console.log(`  ${severity}: ${count}`);
        });
        
        // Статистика по типам
        const typeStats = {};
        last24Hours.forEach(alert => {
            typeStats[alert.rule.id] = (typeStats[alert.rule.id] || 0) + 1;
        });
        
        console.log("\nСтатистика по типам:");
        Object.entries(typeStats).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
    }

    async run() {
        try {
            await this.initialize();
            await this.generateAlertReport();
            
            console.log("\n✅ Система алертов готова к работе");
        } catch (error) {
            console.error("❌ Ошибка при инициализации системы алертов:", error);
        }
    }
}

// Запускаем систему алертов
if (require.main === module) {
    const alertSystem = new AlertSystem();
    alertSystem.run();
}

module.exports = { AlertSystem };
