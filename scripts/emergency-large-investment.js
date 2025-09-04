const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("💰 УПРАВЛЕНИЕ КРУПНЫМИ ИНВЕСТИЦИЯМИ DEFIMON V2");
    console.log("=".repeat(60));
    
    // Получаем аргументы командной строки
    const action = process.argv[2]; // 'approve', 'reject', 'list', 'status'
    const requestId = process.argv[3];
    
    if (!action) {
        console.error("❌ Укажите действие:");
        console.error("npx hardhat run scripts/emergency-large-investment.js --network sepolia -- approve <requestId>");
        console.error("npx hardhat run scripts/emergency-large-investment.js --network sepolia -- reject <requestId>");
        console.error("npx hardhat run scripts/emergency-large-investment.js --network sepolia -- list");
        console.error("npx hardhat run scripts/emergency-large-investment.js --network sepolia -- status <requestId>");
        process.exit(1);
    }
    
    // Загружаем адреса контрактов
    const contractsPath = path.join(__dirname, "..", "deployed-contracts-v2.json");
    if (!fs.existsSync(contractsPath)) {
        throw new Error("❌ Файл deployed-contracts-v2.json не найден");
    }
    
    const contracts = JSON.parse(fs.readFileSync(contractsPath, "utf8"));
    
    // Получаем аккаунт
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
    
    // Подключаемся к контракту инвестиций
    const DefimonInvestmentV2 = await ethers.getContractFactory("DefimonInvestmentV2");
    const investment = DefimonInvestmentV2.attach(contracts.defimonInvestmentV2);
    
    console.log("\n📋 Информация об инвестиционном контракте:");
    console.log("Address:", contracts.defimonInvestmentV2);
    
    // Получаем информацию о подписантах
    const signers = await investment.getSigners();
    console.log("\n👥 Подписанты мультиподписи:");
    console.log("Signer 1:", signers.signer1Address);
    console.log("Signer 2:", signers.signer2Address);
    console.log("Signer 3:", signers.signer3Address);
    
    // Проверяем, является ли deployer подписантом
    const isSigner = deployer.address.toLowerCase() === signers.signer1Address.toLowerCase() ||
                    deployer.address.toLowerCase() === signers.signer2Address.toLowerCase() ||
                    deployer.address.toLowerCase() === signers.signer3Address.toLowerCase();
    
    if (!isSigner) {
        console.error("❌ Deployer не является подписантом мультиподписи!");
        process.exit(1);
    }
    
    console.log("✅ Deployer является подписантом");
    
    // Получаем лимиты инвестиций
    const limits = await investment.getInvestmentLimits();
    console.log("\n📊 Лимиты инвестиций:");
    console.log("Min investment (USD):", limits.minInvestmentUsd.toString());
    console.log("Max investment (USD):", limits.maxInvestmentUsd.toString());
    console.log("Large investment threshold (USD):", limits.largeInvestmentUsd.toString());
    console.log("Current ETH/USD price:", limits.currentEthUsdPrice.toString());
    console.log("Min investment (ETH):", ethers.utils.formatEther(limits.minInvestmentEth));
    console.log("Max investment (ETH):", ethers.utils.formatEther(limits.maxInvestmentEth));
    
    switch (action.toLowerCase()) {
        case 'approve':
            await approveLargeInvestment(investment, requestId, deployer);
            break;
        case 'reject':
            await rejectLargeInvestment(investment, requestId, deployer);
            break;
        case 'list':
            await listLargeInvestments(investment);
            break;
        case 'status':
            await checkLargeInvestmentStatus(investment, requestId);
            break;
        default:
            console.error("❌ Неизвестное действие:", action);
            process.exit(1);
    }
}

async function approveLargeInvestment(investment, requestId, deployer) {
    if (!requestId) {
        console.error("❌ Укажите requestId для одобрения:");
        console.error("npx hardhat run scripts/emergency-large-investment.js --network sepolia -- approve <requestId>");
        process.exit(1);
    }
    
    console.log("\n✅ ОДОБРЕНИЕ КРУПНОЙ ИНВЕСТИЦИИ");
    console.log("Request ID:", requestId);
    
    // Получаем информацию о запросе
    const request = await investment.getLargeInvestmentRequest(requestId);
    
    if (request.investor === ethers.constants.AddressZero) {
        console.error("❌ Запрос не найден!");
        process.exit(1);
    }
    
    console.log("\n📋 Информация о запросе:");
    console.log("Investor:", request.investor);
    console.log("ETH Amount:", ethers.utils.formatEther(request.ethAmount));
    console.log("USD Amount:", request.usdAmount.toString());
    console.log("Reason:", request.reason);
    console.log("Timestamp:", new Date(request.timestamp * 1000).toISOString());
    console.log("Executed:", request.executed ? "✅ YES" : "❌ NO");
    
    if (request.executed) {
        console.log("⚠️  Запрос уже выполнен!");
        return;
    }
    
    console.log("\n👥 Статус одобрений:");
    console.log("Signer 1:", request.approvedBySigner1 ? "✅ APPROVED" : "❌ PENDING");
    console.log("Signer 2:", request.approvedBySigner2 ? "✅ APPROVED" : "❌ PENDING");
    console.log("Signer 3:", request.approvedBySigner3 ? "✅ APPROVED" : "❌ PENDING");
    
    // Проверяем, не одобрил ли уже этот подписант
    const signers = await investment.getSigners();
    let alreadyApproved = false;
    
    if (deployer.address.toLowerCase() === signers.signer1Address.toLowerCase() && request.approvedBySigner1) {
        alreadyApproved = true;
    } else if (deployer.address.toLowerCase() === signers.signer2Address.toLowerCase() && request.approvedBySigner2) {
        alreadyApproved = true;
    } else if (deployer.address.toLowerCase() === signers.signer3Address.toLowerCase() && request.approvedBySigner3) {
        alreadyApproved = true;
    }
    
    if (alreadyApproved) {
        console.log("⚠️  Вы уже одобрили этот запрос!");
        return;
    }
    
    // Подтверждение действия
    console.log("\n⚠️  ВНИМАНИЕ: Вы одобряете крупную инвестицию!");
    console.log("После одобрения инвестиция будет выполнена автоматически");
    console.log("если получит одобрение от 2 из 3 подписантов.");
    
    // Одобряем запрос
    console.log("\n✅ Одобрение запроса...");
    const tx = await investment.approveLargeInvestment(requestId);
    console.log("Transaction hash:", tx.hash);
    
    // Ждем подтверждения
    console.log("⏳ Ожидание подтверждения...");
    const receipt = await tx.wait();
    console.log("✅ Запрос успешно одобрен!");
    console.log("Block number:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Проверяем новый статус
    const newRequest = await investment.getLargeInvestmentRequest(requestId);
    console.log("\n📊 Новый статус одобрений:");
    console.log("Signer 1:", newRequest.approvedBySigner1 ? "✅ APPROVED" : "❌ PENDING");
    console.log("Signer 2:", newRequest.approvedBySigner2 ? "✅ APPROVED" : "❌ PENDING");
    console.log("Signer 3:", newRequest.approvedBySigner3 ? "✅ APPROVED" : "❌ PENDING");
    console.log("Executed:", newRequest.executed ? "✅ YES" : "❌ NO");
    
    // Логируем действие
    await logAction('APPROVE_LARGE_INVESTMENT', {
        requestId: requestId,
        investor: request.investor,
        ethAmount: ethers.utils.formatEther(request.ethAmount),
        usdAmount: request.usdAmount.toString(),
        reason: request.reason,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
    });
}

async function rejectLargeInvestment(investment, requestId, deployer) {
    if (!requestId) {
        console.error("❌ Укажите requestId для отклонения:");
        console.error("npx hardhat run scripts/emergency-large-investment.js --network sepolia -- reject <requestId>");
        process.exit(1);
    }
    
    console.log("\n❌ ОТКЛОНЕНИЕ КРУПНОЙ ИНВЕСТИЦИИ");
    console.log("Request ID:", requestId);
    
    // Получаем информацию о запросе
    const request = await investment.getLargeInvestmentRequest(requestId);
    
    if (request.investor === ethers.constants.AddressZero) {
        console.error("❌ Запрос не найден!");
        process.exit(1);
    }
    
    console.log("\n📋 Информация о запросе:");
    console.log("Investor:", request.investor);
    console.log("ETH Amount:", ethers.utils.formatEther(request.ethAmount));
    console.log("USD Amount:", request.usdAmount.toString());
    console.log("Reason:", request.reason);
    console.log("Executed:", request.executed ? "✅ YES" : "❌ NO");
    
    if (request.executed) {
        console.log("⚠️  Запрос уже выполнен, отклонение невозможно!");
        return;
    }
    
    console.log("\n⚠️  ВНИМАНИЕ: Отклонение крупной инвестиции!");
    console.log("Инвестор получит возврат ETH, но токены не будут выданы.");
    
    // Логируем отклонение (в контракте нет функции отклонения, только одобрения)
    await logAction('REJECT_LARGE_INVESTMENT', {
        requestId: requestId,
        investor: request.investor,
        ethAmount: ethers.utils.formatEther(request.ethAmount),
        usdAmount: request.usdAmount.toString(),
        reason: request.reason,
        note: "Rejection logged - investor should receive ETH refund"
    });
    
    console.log("📝 Отклонение записано в логи");
    console.log("💡 Рекомендация: Связаться с инвестором для возврата средств");
}

async function listLargeInvestments(investment) {
    console.log("\n📋 СПИСОК КРУПНЫХ ИНВЕСТИЦИЙ");
    
    // Получаем счетчик запросов
    const requestCounter = await investment.getRequestCounter();
    console.log("Total requests:", requestCounter.toString());
    
    // Получаем последние события LargeInvestmentRequested
    const filter = investment.filters.LargeInvestmentRequested();
    const events = await investment.queryFilter(filter, -1000);
    
    if (events.length === 0) {
        console.log("📭 Нет запросов на крупные инвестиции");
        return;
    }
    
    console.log(`\n📊 Найдено ${events.length} запросов:`);
    
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const { requestId, investor, ethAmount, usdAmount, reason } = event.args;
        
        console.log(`\n${i + 1}. Request ID: ${requestId}`);
        console.log(`   Investor: ${investor}`);
        console.log(`   ETH Amount: ${ethers.utils.formatEther(ethAmount)}`);
        console.log(`   USD Amount: ${usdAmount.toString()}`);
        console.log(`   Reason: ${reason}`);
        console.log(`   Block: ${event.blockNumber}`);
        
        // Получаем текущий статус
        const request = await investment.getLargeInvestmentRequest(requestId);
        console.log(`   Status: ${request.executed ? '✅ EXECUTED' : '⏳ PENDING'}`);
        console.log(`   Approvals: ${request.approvedBySigner1 ? '1' : '0'}/${request.approvedBySigner2 ? '1' : '0'}/${request.approvedBySigner3 ? '1' : '0'}`);
    }
}

async function checkLargeInvestmentStatus(investment, requestId) {
    if (!requestId) {
        console.error("❌ Укажите requestId для проверки:");
        console.error("npx hardhat run scripts/emergency-large-investment.js --network sepolia -- status <requestId>");
        process.exit(1);
    }
    
    console.log("\n🔍 СТАТУС КРУПНОЙ ИНВЕСТИЦИИ");
    console.log("Request ID:", requestId);
    
    // Получаем информацию о запросе
    const request = await investment.getLargeInvestmentRequest(requestId);
    
    if (request.investor === ethers.constants.AddressZero) {
        console.error("❌ Запрос не найден!");
        process.exit(1);
    }
    
    console.log("\n📋 Детальная информация:");
    console.log("Investor:", request.investor);
    console.log("ETH Amount:", ethers.utils.formatEther(request.ethAmount));
    console.log("USD Amount:", request.usdAmount.toString());
    console.log("Reason:", request.reason);
    console.log("Timestamp:", new Date(request.timestamp * 1000).toISOString());
    console.log("Executed:", request.executed ? "✅ YES" : "❌ NO");
    
    console.log("\n👥 Статус одобрений:");
    console.log("Signer 1:", request.approvedBySigner1 ? "✅ APPROVED" : "❌ PENDING");
    console.log("Signer 2:", request.approvedBySigner2 ? "✅ APPROVED" : "❌ PENDING");
    console.log("Signer 3:", request.approvedBySigner3 ? "✅ APPROVED" : "❌ PENDING");
    
    const approvalCount = (request.approvedBySigner1 ? 1 : 0) + 
                         (request.approvedBySigner2 ? 1 : 0) + 
                         (request.approvedBySigner3 ? 1 : 0);
    
    console.log(`\n📊 Прогресс: ${approvalCount}/3 одобрений`);
    
    if (request.executed) {
        console.log("✅ Инвестиция выполнена");
    } else if (approvalCount >= 2) {
        console.log("⚠️  Достаточно одобрений для выполнения, но инвестиция не выполнена");
    } else {
        console.log("⏳ Ожидает дополнительных одобрений");
    }
}

async function logAction(action, data) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        action: action,
        ...data
    };
    
    const logPath = path.join(__dirname, "..", "large-investment-logs.json");
    let logs = [];
    
    if (fs.existsSync(logPath)) {
        logs = JSON.parse(fs.readFileSync(logPath, "utf8"));
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    
    console.log("\n📄 Действие записано в large-investment-logs.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Ошибка при управлении крупными инвестициями:", error);
        process.exit(1);
    });
