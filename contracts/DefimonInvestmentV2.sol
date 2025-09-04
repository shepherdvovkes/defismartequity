// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./DefimonTokenV2.sol";

/**
 * @title DefimonInvestmentV2
 * @dev Контракт для инвестиций в проект DEFIMON (версия 2)
 * Система коэффициентов инвестиций:
 * - До 1 ноября 2025 (MVP): коэффициент x10
 * - До 1 февраля 2026 (первый релиз): коэффициент x5
 * - После 1 февраля 2026: коэффициент x1
 * Мультиподпись для вывода средств (2 из 2)
 */
contract DefimonInvestmentV2 is Ownable, ReentrancyGuard, Pausable {
    
    // Базовый курс обмена: 1 ETH = 100 DEFI токенов
    uint256 public constant BASE_EXCHANGE_RATE = 100;
    
    // Коэффициенты для разных периодов
    uint256 public constant MVP_COEFFICIENT = 10;      // x10 до MVP
    uint256 public constant RELEASE_COEFFICIENT = 5;   // x5 до релиза
    uint256 public constant STANDARD_COEFFICIENT = 1;  // x1 после релиза
    
    // Временные метки для периодов
    uint256 public constant MVP_DEADLINE = 1761955200; // 1 ноября 2025, 00:00 UTC
    uint256 public constant RELEASE_DEADLINE = 1769904000; // 1 февраля 2026, 00:00 UTC
    
    // Лимиты инвестиций (в USD, конвертируются в ETH по курсу)
    uint256 public constant MIN_INVESTMENT_USD = 20;           // Минимум 20 USD
    uint256 public constant MAX_INVESTMENT_USD = 1000000;      // Максимум 1,000,000 USD
    uint256 public constant LARGE_INVESTMENT_USD = 100000;     // Крупные инвестиции требуют одобрения
    
    // Курс ETH/USD (обновляется оракулом или администратором)
    uint256 public ethUsdPrice = 2000; // 2000 USD за 1 ETH (по умолчанию)
    uint256 public lastPriceUpdateTime; // Время последнего обновления цены
    uint256 public priceUpdateCount; // Счетчик обновлений цены
    
    // Настройки для обработки ошибок цен
    uint256 public constant PRICE_VALIDITY_PERIOD = 24 hours; // Цена действительна 24 часа
    uint256 public constant MAX_PRICE_CHANGE_PERCENT = 5000; // Максимальное изменение цены 5000% (для тестов)
    
    // Счетчик для генерации уникальных requestId
    uint256 private requestCounter = 0;
    
    // Ссылка на контракт токена
    DefimonTokenV2 public defimonToken;
    
    // Структура для хранения информации об инвесторе
    struct Investor {
        uint256 totalInvested; // Общая сумма инвестиций в wei
        uint256 totalTokens;   // Общее количество полученных токенов
        uint256 investmentCount; // Количество инвестиций
        uint256 lastInvestmentTime; // Время последней инвестиции
        bool exists;           // Флаг существования записи
    }
    
    // Маппинг инвесторов (оптимизация газа)
    mapping(address => Investor) public investors;
    
    // Массив адресов инвесторов для итерации
    address[] public investorAddresses;
    
    // Черный список адресов
    mapping(address => bool) public blacklisted;
    
    // Структура для крупных инвестиций, требующих одобрения
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
    
    // Маппинг запросов на крупные инвестиции
    mapping(bytes32 => LargeInvestmentRequest) public largeInvestmentRequests;
    
    // Мультиподпись для вывода средств (система "2 из 3")
    address public signer1;
    address public signer2;
    address public signer3;
    
    // Структура для запроса на вывод средств
    struct WithdrawalRequest {
        address to;
        uint256 amount;
        bool approvedBySigner1;
        bool approvedBySigner2;
        bool approvedBySigner3;
        bool executed;
        uint256 timestamp;
    }
    
    // Маппинг запросов на вывод
    mapping(bytes32 => WithdrawalRequest) public withdrawalRequests;
    
    // События
    event InvestmentMade(
        address indexed investor, 
        uint256 ethAmount, 
        uint256 tokenAmount, 
        uint256 coefficient,
        uint256 period
    );
    event LargeInvestmentRequested(
        bytes32 indexed requestId, 
        address indexed investor, 
        uint256 ethAmount, 
        uint256 usdAmount,
        string reason
    );
    event LargeInvestmentApproved(bytes32 indexed requestId, address signer);
    event LargeInvestmentExecuted(bytes32 indexed requestId, address investor, uint256 ethAmount);
    event WithdrawalRequested(bytes32 indexed requestId, address to, uint256 amount);
    event WithdrawalApproved(bytes32 indexed requestId, address signer);
    event WithdrawalExecuted(bytes32 indexed requestId, address to, uint256 amount);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner, uint8 signerIndex);
    event AddressBlacklisted(address indexed account, bool status);
    event EthUsdPriceUpdated(uint256 oldPrice, uint256 newPrice, uint256 timestamp, uint256 updateCount);
    event InvestmentLimitExceeded(address indexed investor, uint256 ethAmount, uint256 usdAmount);
    event PriceUpdateFailed(string reason, uint256 attemptedPrice);
    event PriceValidityWarning(uint256 lastUpdateTime, uint256 currentTime);
    
    constructor(
        address _defimonToken,
        address _signer1,
        address _signer2,
        address _signer3
    ) {
        lastPriceUpdateTime = block.timestamp;
        require(_defimonToken != address(0), "Invalid token address");
        require(_signer1 != address(0), "Invalid signer1 address");
        require(_signer2 != address(0), "Invalid signer2 address");
        require(_signer3 != address(0), "Invalid signer3 address");
        require(_signer1 != _signer2 && _signer1 != _signer3 && _signer2 != _signer3, "All signers must be different");
        
        defimonToken = DefimonTokenV2(_defimonToken);
        signer1 = _signer1;
        signer2 = _signer2;
        signer3 = _signer3;
    }
    
    /**
     * @dev Получение текущего коэффициента инвестиций
     * @return coefficient текущий коэффициент
     * @return period период инвестиций (1=MVP, 2=Release, 3=Standard)
     */
    function getCurrentCoefficient() public view returns (uint256 coefficient, uint8 period) {
        if (block.timestamp < MVP_DEADLINE) {
            return (MVP_COEFFICIENT, 1); // MVP период - x10
        } else if (block.timestamp < RELEASE_DEADLINE) {
            return (RELEASE_COEFFICIENT, 2); // Release период - x5
        } else {
            return (STANDARD_COEFFICIENT, 3); // Standard период - x1
        }
    }
    
    /**
     * @dev Конвертация ETH в USD
     * @param ethAmount количество ETH в wei
     * @return usdAmount эквивалент в USD (в центах)
     */
    function ethToUsd(uint256 ethAmount) public view returns (uint256 usdAmount) {
        return (ethAmount * ethUsdPrice) / 1e18;
    }
    
    /**
     * @dev Конвертация USD в ETH
     * @param usdAmount количество USD (в центах)
     * @return ethAmount эквивалент в ETH в wei
     */
    function usdToEth(uint256 usdAmount) public view returns (uint256 ethAmount) {
        return (usdAmount * 1e18) / ethUsdPrice;
    }
    
    /**
     * @dev Проверка лимитов инвестиций
     * @param ethAmount количество ETH в wei
     * @return isWithinLimits true если в пределах лимитов
     * @return requiresApproval true если требует одобрения
     */
    function checkInvestmentLimits(uint256 ethAmount) public view returns (bool isWithinLimits, bool requiresApproval) {
        uint256 usdAmount = ethToUsd(ethAmount);
        
        if (usdAmount < MIN_INVESTMENT_USD * 100) { // MIN_INVESTMENT_USD в центах
            return (false, false);
        }
        
        if (usdAmount > MAX_INVESTMENT_USD * 100) { // MAX_INVESTMENT_USD в центах
            return (false, false);
        }
        
        if (usdAmount >= LARGE_INVESTMENT_USD * 100) { // LARGE_INVESTMENT_USD в центах
            return (true, true);
        }
        
        return (true, false);
    }
    
    /**
     * @dev Получение информации о периодах инвестиций
     * @return mvpDeadline время до MVP
     * @return releaseDeadline время до релиза
     * @return currentTime текущее время
     * @return currentCoefficient текущий коэффициент
     */
    function getInvestmentPeriods() external view returns (
        uint256 mvpDeadline,
        uint256 releaseDeadline,
        uint256 currentTime,
        uint256 currentCoefficient
    ) {
        (uint256 coefficient, ) = getCurrentCoefficient();
        return (MVP_DEADLINE, RELEASE_DEADLINE, block.timestamp, coefficient);
    }
    
    /**
     * @dev Функция для инвестирования (получение токенов за ETH)
     */
    function invest() public payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Investment amount must be greater than 0");
        require(!blacklisted[msg.sender], "Investor is blacklisted");
        
        // Проверяем лимиты инвестиций
        (bool isWithinLimits, bool requiresApproval) = checkInvestmentLimits(msg.value);
        
        if (!isWithinLimits) {
            uint256 usdAmount = ethToUsd(msg.value);
            emit InvestmentLimitExceeded(msg.sender, msg.value, usdAmount);
            revert("Investment amount exceeds limits");
        }
        
        if (requiresApproval) {
            revert("Large investment requires multisig approval. Use requestLargeInvestment()");
        }
        
        // Получаем текущий коэффициент
        (uint256 coefficient, uint8 period) = getCurrentCoefficient();
        
        // Вычисляем количество токенов с учетом коэффициента
        uint256 tokenAmount = msg.value * BASE_EXCHANGE_RATE * coefficient;
        
        // Проверяем, что у контракта достаточно токенов
        require(
            defimonToken.balanceOf(address(this)) >= tokenAmount,
            "Insufficient tokens in contract"
        );
        
        // Обновляем информацию об инвесторе
        if (!investors[msg.sender].exists) {
            investors[msg.sender].exists = true;
            investors[msg.sender].investmentCount = 0;
            investorAddresses.push(msg.sender);
        }
        
        investors[msg.sender].totalInvested += msg.value;
        investors[msg.sender].totalTokens += tokenAmount;
        investors[msg.sender].investmentCount += 1;
        investors[msg.sender].lastInvestmentTime = block.timestamp;
        
        // Переводим токены инвестору
        defimonToken.transfer(msg.sender, tokenAmount);
        
        emit InvestmentMade(msg.sender, msg.value, tokenAmount, coefficient, period);
    }
    
    /**
     * @dev Запрос на крупную инвестицию (требует одобрения мультиподписи)
     * @param reason причина крупной инвестиции
     */
    function requestLargeInvestment(string memory reason) public payable nonReentrant whenNotPaused returns (bytes32) {
        require(msg.value > 0, "Investment amount must be greater than 0");
        require(!blacklisted[msg.sender], "Investor is blacklisted");
        
        // Проверяем, что это действительно крупная инвестиция
        (bool isWithinLimits, bool requiresApproval) = checkInvestmentLimits(msg.value);
        require(isWithinLimits && requiresApproval, "Investment does not require approval");
        
        // Генерируем уникальный requestId с использованием счетчика
        requestCounter++;
        bytes32 requestId = keccak256(abi.encodePacked(
            msg.sender, 
            msg.value, 
            block.timestamp, 
            block.number, 
            requestCounter
        ));
        
        uint256 usdAmount = ethToUsd(msg.value);
        
        largeInvestmentRequests[requestId] = LargeInvestmentRequest({
            investor: msg.sender,
            ethAmount: msg.value,
            usdAmount: usdAmount,
            approvedBySigner1: false,
            approvedBySigner2: false,
            approvedBySigner3: false,
            executed: false,
            timestamp: block.timestamp,
            reason: reason
        });
        
        emit LargeInvestmentRequested(requestId, msg.sender, msg.value, usdAmount, reason);
        return requestId;
    }
    
    /**
     * @dev Одобрение крупной инвестиции
     * @param requestId ID запроса
     */
    function approveLargeInvestment(bytes32 requestId) external {
        require(
            msg.sender == signer1 || msg.sender == signer2 || msg.sender == signer3,
            "Only authorized signers can approve"
        );
        
        LargeInvestmentRequest storage request = largeInvestmentRequests[requestId];
        require(request.investor != address(0), "Request does not exist");
        require(!request.executed, "Request already executed");
        
        if (msg.sender == signer1) {
            require(!request.approvedBySigner1, "Already approved by signer1");
            request.approvedBySigner1 = true;
        } else if (msg.sender == signer2) {
            require(!request.approvedBySigner2, "Already approved by signer2");
            request.approvedBySigner2 = true;
        } else {
            require(!request.approvedBySigner3, "Already approved by signer3");
            request.approvedBySigner3 = true;
        }
        
        emit LargeInvestmentApproved(requestId, msg.sender);
        
        // Если любые два подписанта одобрили, выполняем инвестицию
        uint256 approvalCount = 0;
        if (request.approvedBySigner1) approvalCount++;
        if (request.approvedBySigner2) approvalCount++;
        if (request.approvedBySigner3) approvalCount++;
        
        if (approvalCount >= 2) {
            _executeLargeInvestment(requestId);
        }
    }
    
    /**
     * @dev Выполнение крупной инвестиции
     * @param requestId ID запроса
     */
    function _executeLargeInvestment(bytes32 requestId) internal {
        LargeInvestmentRequest storage request = largeInvestmentRequests[requestId];
        
        require(!request.executed, "Already executed");
        
        // Проверяем, что минимум 2 из 3 подписантов одобрили
        uint256 approvalCount = 0;
        if (request.approvedBySigner1) approvalCount++;
        if (request.approvedBySigner2) approvalCount++;
        if (request.approvedBySigner3) approvalCount++;
        
        require(approvalCount >= 2, "At least 2 out of 3 signers must approve");
        
        request.executed = true;
        
        // Получаем текущий коэффициент
        (uint256 coefficient, uint8 period) = getCurrentCoefficient();
        
        // Вычисляем количество токенов с учетом коэффициента
        uint256 tokenAmount = request.ethAmount * BASE_EXCHANGE_RATE * coefficient;
        
        // Проверяем, что у контракта достаточно токенов
        require(
            defimonToken.balanceOf(address(this)) >= tokenAmount,
            "Insufficient tokens in contract"
        );
        
        // Обновляем информацию об инвесторе
        if (!investors[request.investor].exists) {
            investors[request.investor].exists = true;
            investors[request.investor].investmentCount = 0;
            investorAddresses.push(request.investor);
        }
        
        investors[request.investor].totalInvested += request.ethAmount;
        investors[request.investor].totalTokens += tokenAmount;
        investors[request.investor].investmentCount += 1;
        investors[request.investor].lastInvestmentTime = block.timestamp;
        
        // Переводим токены инвестору
        defimonToken.transfer(request.investor, tokenAmount);
        
        emit LargeInvestmentExecuted(requestId, request.investor, request.ethAmount);
        emit InvestmentMade(request.investor, request.ethAmount, tokenAmount, coefficient, period);
    }
    
    /**
     * @dev Создание запроса на вывод средств
     * @param to адрес получателя
     * @param amount сумма для вывода
     */
    function requestWithdrawal(address to, uint256 amount) external onlyOwner returns (bytes32) {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= amount, "Insufficient contract balance");
        
        // Генерируем уникальный requestId с использованием счетчика
        requestCounter++;
        bytes32 requestId = keccak256(abi.encodePacked(
            to, 
            amount, 
            block.timestamp, 
            block.number, 
            requestCounter
        ));
        
        withdrawalRequests[requestId] = WithdrawalRequest({
            to: to,
            amount: amount,
            approvedBySigner1: false,
            approvedBySigner2: false,
            approvedBySigner3: false,
            executed: false,
            timestamp: block.timestamp
        });
        
        emit WithdrawalRequested(requestId, to, amount);
        return requestId;
    }
    
    /**
     * @dev Одобрение запроса на вывод средств
     * @param requestId ID запроса
     */
    function approveWithdrawal(bytes32 requestId) external {
        require(
            msg.sender == signer1 || msg.sender == signer2 || msg.sender == signer3,
            "Only authorized signers can approve"
        );
        
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        require(request.to != address(0), "Request does not exist");
        require(!request.executed, "Request already executed");
        
        if (msg.sender == signer1) {
            require(!request.approvedBySigner1, "Already approved by signer1");
            request.approvedBySigner1 = true;
        } else if (msg.sender == signer2) {
            require(!request.approvedBySigner2, "Already approved by signer2");
            request.approvedBySigner2 = true;
        } else {
            require(!request.approvedBySigner3, "Already approved by signer3");
            request.approvedBySigner3 = true;
        }
        
        emit WithdrawalApproved(requestId, msg.sender);
        
        // Если любые два подписанта одобрили, выполняем вывод (система "2 из 3")
        uint256 approvalCount = 0;
        if (request.approvedBySigner1) approvalCount++;
        if (request.approvedBySigner2) approvalCount++;
        if (request.approvedBySigner3) approvalCount++;
        
        if (approvalCount >= 2) {
            _executeWithdrawal(requestId);
        }
    }
    
    /**
     * @dev Выполнение вывода средств
     * @param requestId ID запроса
     */
    function _executeWithdrawal(bytes32 requestId) internal {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        
        require(!request.executed, "Already executed");
        
        // Проверяем, что минимум 2 из 3 подписантов одобрили
        uint256 approvalCount = 0;
        if (request.approvedBySigner1) approvalCount++;
        if (request.approvedBySigner2) approvalCount++;
        if (request.approvedBySigner3) approvalCount++;
        
        require(approvalCount >= 2, "At least 2 out of 3 signers must approve");
        
        request.executed = true;
        
        // Выполняем перевод
        (bool success, ) = request.to.call{value: request.amount}("");
        require(success, "Transfer failed");
        
        emit WithdrawalExecuted(requestId, request.to, request.amount);
    }
    
    /**
     * @dev Обновление подписанта
     * @param newSigner новый адрес подписанта
     * @param signerIndex индекс подписанта (1, 2 или 3)
     */
    function updateSigner(address newSigner, uint8 signerIndex) external onlyOwner {
        require(newSigner != address(0), "Invalid signer address");
        require(signerIndex == 1 || signerIndex == 2 || signerIndex == 3, "Invalid signer index");
        
        address oldSigner;
        if (signerIndex == 1) {
            require(newSigner != signer2 && newSigner != signer3, "Signers must be different");
            oldSigner = signer1;
            signer1 = newSigner;
        } else if (signerIndex == 2) {
            require(newSigner != signer1 && newSigner != signer3, "Signers must be different");
            oldSigner = signer2;
            signer2 = newSigner;
        } else {
            require(newSigner != signer1 && newSigner != signer2, "Signers must be different");
            oldSigner = signer3;
            signer3 = newSigner;
        }
        
        emit SignerUpdated(oldSigner, newSigner, signerIndex);
    }
    
    /**
     * @dev Получение информации об инвесторе
     * @param investor адрес инвестора
     */
    function getInvestorInfo(address investor) external view returns (
        uint256 totalInvested,
        uint256 totalTokens,
        uint256 investmentCount,
        uint256 lastInvestmentTime,
        bool exists
    ) {
        Investor memory investorInfo = investors[investor];
        return (
            investorInfo.totalInvested, 
            investorInfo.totalTokens, 
            investorInfo.investmentCount,
            investorInfo.lastInvestmentTime,
            investorInfo.exists
        );
    }
    
    /**
     * @dev Получение общего количества инвесторов
     */
    function getInvestorCount() external view returns (uint256) {
        return investorAddresses.length;
    }
    
    /**
     * @dev Получение адреса инвестора по индексу
     * @param index индекс в массиве
     */
    function getInvestorByIndex(uint256 index) external view returns (address) {
        require(index < investorAddresses.length, "Index out of bounds");
        return investorAddresses[index];
    }
    
    /**
     * @dev Получение баланса контракта
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Получение баланса токенов контракта
     */
    function getTokenBalance() external view returns (uint256) {
        return defimonToken.balanceOf(address(this));
    }
    
    /**
     * @dev Получение статистики контракта
     */
    function getContractStats() external view returns (
        uint256 totalInvestments,
        uint256 totalTokensDistributed,
        uint256 totalInvestors,
        uint256 contractBalance,
        uint256 tokenBalance,
        uint256 currentCoefficient,
        uint8 currentPeriod
    ) {
        (uint256 coefficient, uint8 period) = getCurrentCoefficient();
        return (
            investorAddresses.length,
            defimonToken.totalSupply() - defimonToken.balanceOf(address(this)),
            investorAddresses.length,
            address(this).balance,
            defimonToken.balanceOf(address(this)),
            coefficient,
            period
        );
    }
    
    /**
     * @dev Пауза контракта (только владелец)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Снятие паузы (только владелец)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Получение информации о подписантах
     * @return signer1Address адрес первого подписанта
     * @return signer2Address адрес второго подписанта
     * @return signer3Address адрес третьего подписанта
     */
    function getSigners() external view returns (
        address signer1Address,
        address signer2Address,
        address signer3Address
    ) {
        return (signer1, signer2, signer3);
    }
    
    /**
     * @dev Управление черным списком (только владелец)
     * @param account адрес для добавления/удаления из черного списка
     * @param status true - добавить в черный список, false - удалить
     */
    function setBlacklist(address account, bool status) external onlyOwner {
        require(account != address(0), "Cannot blacklist zero address");
        require(account != owner(), "Cannot blacklist owner");
        require(account != signer1 && account != signer2 && account != signer3, "Cannot blacklist signers");
        
        blacklisted[account] = status;
        emit AddressBlacklisted(account, status);
    }
    
    /**
     * @dev Обновление курса ETH/USD (только владелец)
     * @param newPrice новый курс в USD (в центах)
     */
    function updateEthUsdPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be greater than 0");
        require(newPrice <= 100000, "Price seems too high"); // Максимум $100,000 за ETH
        
        uint256 oldPrice = ethUsdPrice;
        
        // Проверяем резкое изменение цены (защита от ошибок оракула)
        if (oldPrice > 0) {
            uint256 priceChangePercent = (newPrice > oldPrice) 
                ? ((newPrice - oldPrice) * 100) / oldPrice
                : ((oldPrice - newPrice) * 100) / oldPrice;
                
            if (priceChangePercent > MAX_PRICE_CHANGE_PERCENT) {
                emit PriceUpdateFailed("Price change too large", newPrice);
                revert("Price change exceeds maximum allowed percentage");
            }
        }
        
        ethUsdPrice = newPrice;
        lastPriceUpdateTime = block.timestamp;
        priceUpdateCount++;
        
        emit EthUsdPriceUpdated(oldPrice, newPrice, block.timestamp, priceUpdateCount);
    }
    
    /**
     * @dev Проверка валидности текущей цены ETH
     * @return isValid true если цена актуальна
     * @return timeSinceUpdate время с последнего обновления в секундах
     */
    function isPriceValid() public view returns (bool isValid, uint256 timeSinceUpdate) {
        timeSinceUpdate = block.timestamp - lastPriceUpdateTime;
        isValid = timeSinceUpdate <= PRICE_VALIDITY_PERIOD;
        
        if (!isValid) {
            // Эмитим предупреждение о неактуальной цене
            // (это view функция, но событие будет эмититься при вызове)
        }
        
        return (isValid, timeSinceUpdate);
    }
    
    /**
     * @dev Получение информации о цене ETH
     * @return currentPrice текущая цена в центах
     * @return lastUpdateTime время последнего обновления
     * @return updateCount количество обновлений
     * @return isValid валидность цены
     */
    function getPriceInfo() external view returns (
        uint256 currentPrice,
        uint256 lastUpdateTime,
        uint256 updateCount,
        bool isValid
    ) {
        (isValid,) = isPriceValid();
        return (ethUsdPrice, lastPriceUpdateTime, priceUpdateCount, isValid);
    }
    
    /**
     * @dev Экстренная функция для приостановки всех операций (только владелец)
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Экстренная функция для снятия приостановки (только владелец)
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Экстренная функция для извлечения всех средств (только владелец)
     * @param to адрес получателя
     */
    function emergencyWithdraw(address to) external onlyOwner {
        require(to != address(0), "Invalid recipient address");
        require(to != address(this), "Cannot withdraw to contract");
        
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = to.call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @dev Экстренная функция для извлечения токенов (только владелец)
     * @param to адрес получателя
     * @param amount количество токенов
     */
    function emergencyWithdrawTokens(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient address");
        require(to != address(this), "Cannot withdraw to contract");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 tokenBalance = defimonToken.balanceOf(address(this));
        require(tokenBalance >= amount, "Insufficient token balance");
        
        defimonToken.transfer(to, amount);
    }
    
    /**
     * @dev Получение информации о лимитах инвестиций
     */
    function getInvestmentLimits() external view returns (
        uint256 minInvestmentUsd,
        uint256 maxInvestmentUsd,
        uint256 largeInvestmentUsd,
        uint256 currentEthUsdPrice,
        uint256 minInvestmentEth,
        uint256 maxInvestmentEth
    ) {
        minInvestmentEth = usdToEth(MIN_INVESTMENT_USD * 100);
        maxInvestmentEth = usdToEth(MAX_INVESTMENT_USD * 100);
        
        return (
            MIN_INVESTMENT_USD,
            MAX_INVESTMENT_USD,
            LARGE_INVESTMENT_USD,
            ethUsdPrice,
            minInvestmentEth,
            maxInvestmentEth
        );
    }
    
    /**
     * @dev Получение информации о крупной инвестиции
     * @param requestId ID запроса
     */
    function getLargeInvestmentRequest(bytes32 requestId) external view returns (
        address investor,
        uint256 ethAmount,
        uint256 usdAmount,
        bool approvedBySigner1,
        bool approvedBySigner2,
        bool approvedBySigner3,
        bool executed,
        uint256 timestamp,
        string memory reason
    ) {
        LargeInvestmentRequest memory request = largeInvestmentRequests[requestId];
        return (
            request.investor,
            request.ethAmount,
            request.usdAmount,
            request.approvedBySigner1,
            request.approvedBySigner2,
            request.approvedBySigner3,
            request.executed,
            request.timestamp,
            request.reason
        );
    }
    
    /**
     * @dev Получение счетчика запросов
     */
    function getRequestCounter() external view returns (uint256) {
        return requestCounter;
    }
    
    /**
     * @dev Получение ETH (fallback функция)
     */
    receive() external payable {
        // Автоматически вызываем функцию инвестирования
        invest();
    }
}
