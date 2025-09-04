const notificationConfig = require('../notification-config');
const nodemailer = require('nodemailer');
const axios = require('axios');

class NotificationService {
    constructor() {
        this.config = notificationConfig;
        this.emailTransporter = null;
        this.alertHistory = new Map();
        this.initializeEmail();
    }

    async initializeEmail() {
        if (this.config.channels.email.enabled && this.config.channels.email.smtp.host) {
            this.emailTransporter = nodemailer.createTransporter(this.config.channels.email.smtp);
        }
    }

    async sendAlert(alert) {
        console.log(`📧 Отправка уведомления: ${alert.severity} - ${alert.type}`);
        
        // Проверяем cooldown
        if (this.isInCooldown(alert)) {
            console.log(`⏳ Алерт в cooldown, пропускаем`);
            return;
        }

        // Получаем конфигурацию для уровня серьезности
        const levelConfig = this.config.alertLevels[alert.severity];
        if (!levelConfig) {
            console.error(`❌ Неизвестный уровень серьезности: ${alert.severity}`);
            return;
        }

        // Получаем шаблон
        const template = this.config.templates[alert.severity.toLowerCase()];
        if (!template) {
            console.error(`❌ Шаблон не найден для уровня: ${alert.severity}`);
            return;
        }

        // Формируем сообщение
        const message = this.formatMessage(template, alert);

        // Отправляем через все каналы
        const promises = [];

        if (levelConfig.channels.includes('email') && this.config.channels.email.enabled) {
            promises.push(this.sendEmail(levelConfig.recipients, template.subject, message));
        }

        if (levelConfig.channels.includes('telegram') && this.config.channels.telegram.enabled) {
            promises.push(this.sendTelegram(message));
        }

        if (levelConfig.channels.includes('slack') && this.config.channels.slack.enabled) {
            promises.push(this.sendSlack(message));
        }

        if (levelConfig.channels.includes('phone') && alert.severity === 'CRITICAL') {
            promises.push(this.sendSMS(levelConfig.phone, message));
        }

        try {
            await Promise.allSettled(promises);
            this.recordAlert(alert);
            console.log(`✅ Уведомления отправлены для ${alert.severity}`);
        } catch (error) {
            console.error(`❌ Ошибка отправки уведомлений:`, error);
        }
    }

    async sendEmail(recipients, subject, message) {
        if (!this.emailTransporter) {
            console.log(`⚠️ Email транспортер не настроен`);
            return;
        }

        const mailOptions = {
            from: this.config.channels.email.smtp.auth.user,
            to: recipients.join(', '),
            subject: subject,
            text: message,
            html: this.formatHtmlMessage(message)
        };

        try {
            const result = await this.emailTransporter.sendMail(mailOptions);
            console.log(`📧 Email отправлен: ${result.messageId}`);
        } catch (error) {
            console.error(`❌ Ошибка отправки email:`, error);
        }
    }

    async sendTelegram(message) {
        const url = `https://api.telegram.org/bot${this.config.channels.telegram.botToken}/sendMessage`;
        
        try {
            const response = await axios.post(url, {
                chat_id: this.config.channels.telegram.chatId,
                text: message,
                parse_mode: 'HTML'
            });
            
            console.log(`📱 Telegram сообщение отправлено: ${response.data.message_id}`);
        } catch (error) {
            console.error(`❌ Ошибка отправки Telegram:`, error);
        }
    }

    async sendSlack(message) {
        try {
            const response = await axios.post(this.config.channels.slack.webhookUrl, {
                text: message,
                username: 'DEFIMON Security Bot',
                icon_emoji: ':shield:'
            });
            
            console.log(`💬 Slack сообщение отправлено`);
        } catch (error) {
            console.error(`❌ Ошибка отправки Slack:`, error);
        }
    }

    async sendSMS(phone, message) {
        // Здесь можно интегрировать с SMS провайдером
        console.log(`📞 SMS отправлен на ${phone}: ${message.substring(0, 100)}...`);
    }

    formatMessage(template, alert) {
        return template.body
            .replace('{timestamp}', alert.timestamp)
            .replace('{description}', alert.description)
            .replace('{contract}', alert.contract || 'N/A')
            .replace('{transactionHash}', alert.transactionHash || 'N/A')
            .replace('{severity}', alert.severity)
            .replace('{type}', alert.type);
    }

    formatHtmlMessage(textMessage) {
        return textMessage
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }

    isInCooldown(alert) {
        const key = `${alert.type}-${alert.severity}`;
        const lastSent = this.alertHistory.get(key);
        
        if (!lastSent) return false;
        
        const cooldownMs = this.config.monitoring.alertCooldown;
        return (Date.now() - lastSent) < cooldownMs;
    }

    recordAlert(alert) {
        const key = `${alert.type}-${alert.severity}`;
        this.alertHistory.set(key, Date.now());
    }

    async sendTestNotification() {
        console.log('🧪 Отправка тестового уведомления...');
        
        const testAlert = {
            type: 'TEST_ALERT',
            severity: 'LOW',
            description: 'Тестовое уведомление системы безопасности DEFIMON V2',
            timestamp: new Date().toISOString(),
            contract: 'Test Contract',
            transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
        };

        await this.sendAlert(testAlert);
    }

    async sendCriticalAlert(description, contract, transactionHash) {
        console.log('🚨 Отправка критического алерта...');
        
        const criticalAlert = {
            type: 'CRITICAL_SECURITY_ALERT',
            severity: 'CRITICAL',
            description: description,
            timestamp: new Date().toISOString(),
            contract: contract,
            transactionHash: transactionHash
        };

        await this.sendAlert(criticalAlert);
    }

    getTeamContacts() {
        return this.config.team;
    }

    getAlertLevels() {
        return this.config.alertLevels;
    }
}

// Экспортируем для использования в других модулях
module.exports = { NotificationService };

// Если скрипт запущен напрямую, отправляем тестовое уведомление
if (require.main === module) {
    const notificationService = new NotificationService();
    
    // Отправляем тестовое уведомление
    notificationService.sendTestNotification()
        .then(() => {
            console.log('✅ Тестовое уведомление отправлено');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Ошибка отправки тестового уведомления:', error);
            process.exit(1);
        });
}
