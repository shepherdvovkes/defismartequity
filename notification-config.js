// Конфигурация системы уведомлений DEFIMON V2
const notificationConfig = {
  // Контакты команды
  team: {
    leadDeveloper: {
      name: 'Lead Developer',
      email: 'awe@s0me.uk',
      role: 'Technical Lead'
    },
    secOps: {
      name: 'SecOps',
      email: 'sec@s0me.uk',
      role: 'Security Operations'
    },
    info: {
      name: 'Info/General',
      email: 'vovkes@highfunk.uk',
      role: 'General Information'
    },
    emergencyPhone: '+380965904460'
  },

  // Уровни уведомлений
  alertLevels: {
    CRITICAL: {
      recipients: ['awe@s0me.uk', 'sec@s0me.uk'],
      phone: '+380965904460',
      channels: ['email', 'phone', 'telegram', 'slack'],
      responseTime: 'immediate'
    },
    HIGH: {
      recipients: ['awe@s0me.uk', 'sec@s0me.uk'],
      channels: ['email', 'telegram', 'slack'],
      responseTime: '15 minutes'
    },
    MEDIUM: {
      recipients: ['awe@s0me.uk'],
      channels: ['email', 'telegram'],
      responseTime: '1 hour'
    },
    LOW: {
      recipients: ['vovkes@highfunk.uk'],
      channels: ['email'],
      responseTime: '24 hours'
    }
  },

  // Шаблоны уведомлений
  templates: {
    critical: {
      subject: '🚨 CRITICAL ALERT - DEFIMON V2 Security Incident',
      body: `
🚨 КРИТИЧЕСКИЙ АЛЕРТ DEFIMON V2

Уровень угрозы: КРИТИЧЕСКИЙ
Время: {timestamp}
Описание: {description}
Контракт: {contract}
Транзакция: {transactionHash}

ТРЕБУЕТСЯ НЕМЕДЛЕННАЯ РЕАКЦИЯ!

Действия:
1. Проверить Defender Dashboard
2. При необходимости приостановить контракты
3. Связаться с командой безопасности

Контакты:
- Lead Developer: awe@s0me.uk
- SecOps: sec@s0me.uk
- Emergency Phone: +380965904460

---
DEFIMON V2 Security System
      `,
      priority: 'high'
    },
    
    high: {
      subject: '⚠️ HIGH PRIORITY ALERT - DEFIMON V2',
      body: `
⚠️ ВЫСОКИЙ ПРИОРИТЕТ DEFIMON V2

Уровень угрозы: ВЫСОКИЙ
Время: {timestamp}
Описание: {description}
Контракт: {contract}
Транзакция: {transactionHash}

Требуется внимание в течение 15 минут.

Действия:
1. Проверить Defender Dashboard
2. Проанализировать активность
3. При необходимости принять меры

Контакты:
- Lead Developer: awe@s0me.uk
- SecOps: sec@s0me.uk

---
DEFIMON V2 Security System
      `,
      priority: 'normal'
    },
    
    medium: {
      subject: '📊 MEDIUM PRIORITY ALERT - DEFIMON V2',
      body: `
📊 СРЕДНИЙ ПРИОРИТЕТ DEFIMON V2

Уровень угрозы: СРЕДНИЙ
Время: {timestamp}
Описание: {description}
Контракт: {contract}
Транзакция: {transactionHash}

Требуется внимание в течение 1 часа.

Действия:
1. Проверить Defender Dashboard
2. Мониторить ситуацию
3. При необходимости принять меры

Контакты:
- Lead Developer: awe@s0me.uk

---
DEFIMON V2 Security System
      `,
      priority: 'normal'
    },
    
    low: {
      subject: 'ℹ️ LOW PRIORITY ALERT - DEFIMON V2',
      body: `
ℹ️ НИЗКИЙ ПРИОРИТЕТ DEFIMON V2

Уровень угрозы: НИЗКИЙ
Время: {timestamp}
Описание: {description}
Контракт: {contract}
Транзакция: {transactionHash}

Информационное уведомление.

Действия:
1. Проверить Defender Dashboard
2. Зафиксировать в логах

Контакты:
- Info: vovkes@highfunk.uk

---
DEFIMON V2 Security System
      `,
      priority: 'low'
    }
  },

  // Настройки каналов
  channels: {
    email: {
      enabled: true,
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      }
    },
    
    telegram: {
      enabled: !!process.env.TELEGRAM_BOT_TOKEN,
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID
    },
    
    slack: {
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      webhookUrl: process.env.SLACK_WEBHOOK_URL
    },
    
    phone: {
      enabled: true,
      number: '+380965904460',
      provider: 'sms' // или 'call'
    }
  },

  // Настройки мониторинга
  monitoring: {
    checkInterval: 60000, // 1 минута
    alertCooldown: 300000, // 5 минут между одинаковыми алертами
    maxAlertsPerHour: 10,
    retentionDays: 30
  },

  // Настройки логирования
  logging: {
    level: 'info', // debug, info, warn, error
    file: './logs/security-alerts.log',
    maxSize: '10MB',
    maxFiles: 5
  }
};

module.exports = notificationConfig;
