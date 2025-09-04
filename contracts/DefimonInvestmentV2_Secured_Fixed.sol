// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./DefimonTokenV2.sol";

/**
 * @title DefimonInvestmentV2_Secured_Fixed
 * @dev Enhanced version with additional reentrancy protection and security hardening
 * 
 * SECURITY IMPROVEMENTS:
 * - Enhanced reentrancy protection with state locks
 * - Additional input validation
 * - Improved access control
 * - Better error handling
 */
contract DefimonInvestmentV2_Secured_Fixed is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for DefimonTokenV2;
    
    // 🔒 ENHANCED SECURITY: State lock for reentrancy protection
    bool private _locked;
    
    // Роли для контроля доступа
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    bytes32 public constant MULTISIG_ROLE = keccak256("MULTISIG_ROLE");
    
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
    
    // Настройки для обработки ошибок цен (УЛУЧШЕНО)
    uint256 public constant PRICE_VALIDITY_PERIOD = 24 hours; // Цена действительна 24 часа
    uint256 public constant MAX_PRICE_CHANGE_PERCENT = 50; // Максимальное изменение цены 50%
    uint256 public constant PRICE_UPDATE_COOLDOWN = 1 hours; // Минимальный интервал между обновлениями
    
    // Настройки мультиподписи (УЛУЧШЕНО)
    uint256 public constant MULTISIG_DELAY = 24 hours; // Задержка для мультиподписи
    uint256 public constant MIN_SIGNERS = 3; // Минимальное количество подписантов
    uint256 public constant REQUIRED_APPROVALS = 2; // Требуемое количество одобрений
    
    // Счетчик для генерации уникальных requestId
    uint256 private requestCounter = 0;
    
    // Ссылка на контракт токена
    DefimonTokenV2 public immutable defimonToken;
    
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
    
    // Структура для крупных инвестиций, требующих одобрения (УЛУЧШЕНО)
    struct LargeInvestmentRequest {
        address investor;
        uint256 ethAmount;
        uint256 usdAmount;
        bool approvedBySigner1;
        bool approvedBySigner2;
        bool approvedBySigner3;
        bool executed;
        uint256 timestamp;
        uint256 requestTimestamp; // Время создания запроса
        string reason;
    }
    
    // Маппинг запросов на крупные инвестиции
    mapping(bytes32 => LargeInvestmentRequest) public largeInvestmentRequests;
    
    // Мультиподпись для вывода средств (система "2 из 3") (УЛУЧШЕНО)
    address public immutable signer1;
    address public immutable signer2;
    address public immutable signer3;
    
    // Timelock для мультиподписи
    mapping(bytes32 => uint256) public requestTimestamps;
    
    // Структура для запроса на вывод средств
    struct WithdrawalRequest {
        address to;
        uint256 amount;
        bool approvedBySigner1;
        bool approvedBySigner2;
        bool approvedBySigner3;
        bool executed;
        uint256 timestamp;
        uint256 requestTimestamp; // Время создания запроса
    }
    
    // Маппинг запросов на вывод
    mapping(bytes32 => WithdrawalRequest) public withdrawalRequests;
    
    // События (УЛУЧШЕНО - добавлены indexed параметры)
    event InvestmentMade(
        address indexed investor, 
        uint256 indexed ethAmount, 
        uint256 tokenAmount, 
        uint256 indexed coefficient,
        uint256 period
    );
    event LargeInvestmentRequested(
        bytes32 indexed requestId, 
        address indexed investor, 
        uint256 indexed ethAmount, 
        uint256 usdAmount,
        string reason
    );
    event LargeInvestmentApproved(bytes32 indexed requestId, address indexed signer);
    event LargeInvestmentExecuted(bytes32 indexed requestId, address indexed investor, uint256 ethAmount);
    event WithdrawalRequested(bytes32 indexed requestId, address indexed to, uint256 amount);
    event WithdrawalApproved(bytes32 indexed requestId, address indexed signer);
    event WithdrawalExecuted(bytes32 indexed requestId, address indexed to, uint256 amount);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner, uint8 indexed signerIndex);
    event AddressBlacklisted(address indexed account, bool indexed status);
    event EthUsdPriceUpdated(uint256 indexed oldPrice, uint256 indexed newPrice, uint256 timestamp, uint256 updateCount);
    event InvestmentLimitExceeded(address indexed investor, uint256 indexed ethAmount, uint256 usdAmount);
    event PriceUpdateFailed(string indexed reason, uint256 attemptedPrice);
    event SecurityEvent(string indexed eventType, address indexed account, uint256 timestamp);
    
    // 🔒 ENHANCED SECURITY: Custom reentrancy modifier
    modifier nonReentrantEnhanced() {
        require(!_locked, "ReentrancyGuard: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }
    
    // Модификаторы для ролей
    modifier onlyEmergencyRole() {
        require(hasRole(EMERGENCY_ROLE, msg.sender), "Caller is not emergency role");
        _;
    }
    
    modifier onlyPriceUpdater() {
        require(hasRole(PRICE_UPDATER_ROLE, msg.sender), "Caller is not price updater");
        _;
    }
    
    modifier onlyMultisig() {
        require(hasRole(MULTISIG_ROLE, msg.sender), "Caller is not multisig role");
        _;
    }
    
    constructor(
        address _defimonToken,
        address _signer1,
        address _signer2,
        address _signer3
    ) {
        require(_defimonToken != address(0), "Invalid token address");
        require(_signer1 != address(0), "Invalid signer1 address");
        require(_signer2 != address(0), "Invalid signer2 address");
        require(_signer3 != address(0), "Invalid signer3 address");
        require(_signer1 != _signer2 && _signer1 != _signer3 && _signer2 != _signer3, "All signers must be different");
        
        defimonToken = DefimonTokenV2(_defimonToken);
        signer1 = _signer1;
        signer2 = _signer2;
        signer3 = _signer3;
        
        lastPriceUpdateTime = block.timestamp;
        
        // Настройка ролей
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        _grantRole(PRICE_UPDATER_ROLE, msg.sender);
        _grantRole(MULTISIG_ROLE, _signer1);
        _grantRole(MULTISIG_ROLE, _signer2);
        _grantRole(MULTISIG_ROLE, _signer3);
        
        emit SecurityEvent("Contract Deployed", msg.sender, block.timestamp);
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
     * @dev Конвертация ETH в USD с проверкой переполнения
     * @param ethAmount количество ETH в wei
     * @return usdAmount эквивалент в USD (в центах)
     */
    function ethToUsd(uint256 ethAmount) public view returns (uint256 usdAmount) {
        require(ethAmount > 0, "Amount must be greater than 0");
        require(ethAmount <= type(uint128).max, "Amount too large");
        
        // Проверка на переполнение
        uint256 result = (ethAmount * ethUsdPrice) / 1e18;
        require(result >= ethAmount || ethUsdPrice <= 1e18, "Overflow in ethToUsd");
        
        return result;
    }
    
    /**
     * @dev Конвертация USD в ETH с проверкой переполнения
     * @param usdAmount количество USD (в центах)
     * @return ethAmount эквивалент в ETH в wei
     */
    function usdToEth(uint256 usdAmount) public view returns (uint256 ethAmount) {
        require(usdAmount > 0, "Amount must be greater than 0");
        require(ethUsdPrice > 0, "Invalid ETH price");
        
        // Проверка на переполнение
        uint256 result = (usdAmount * 1e18) / ethUsdPrice;
        require(result >= usdAmount || 1e18 <= ethUsdPrice, "Overflow in usdToEth");
        
        return result;
    }
    
    /**
     * @dev Проверка лимитов инвестиций с улучшенной валидацией
     * @param ethAmount количество ETH в wei
     * @return isWithinLimits true если в пределах лимитов
     * @return requiresApproval true если требует одобрения
     */
    function checkInvestmentLimits(uint256 ethAmount) public view returns (bool isWithinLimits, bool requiresApproval) {
        require(ethAmount > 0, "Amount must be greater than 0");
        require(ethAmount <= type(uint128).max, "Amount too large");
        
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
     * 🔒 ENHANCED SECURITY: Функция для инвестирования с дополнительной защитой от реентранси
     * Использует CEI (Checks-Effects-Interactions) паттерн + дополнительная блокировка
     */
    function invest() public payable nonReentrant nonReentrantEnhanced whenNotPaused {
        // 1. CHECKS
        require(msg.value > 0, "Investment amount must be greater than 0");
        require(!blacklisted[msg.sender], "Investor is blacklisted");
        require(msg.sender != address(0), "Invalid investor address");
        
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
        
        // 2. EFFECTS (обновляем состояние ДО взаимодействия)
        _updateInvestorState(msg.sender, msg.value, tokenAmount);
        
        // 🔒 ENHANCED SECURITY: Дополнительная проверка состояния
        require(_locked, "State inconsistency detected");
        
        // 3. INTERACTIONS (последний шаг)
        defimonToken.safeTransfer(msg.sender, tokenAmount);
        
        emit InvestmentMade(msg.sender, msg.value, tokenAmount, coefficient, period);
        emit SecurityEvent("Investment Made", msg.sender, block.timestamp);
    }
    
    /**
     * @dev Внутренняя функция для обновления состояния инвестора
     */
    function _updateInvestorState(address investor, uint256 ethAmount, uint256 tokenAmount) private {
        if (!investors[investor].exists) {
            investors[investor].exists = true;
            investors[investor].investmentCount = 0;
            investorAddresses.push(investor);
        }
        
        investors[investor].totalInvested += ethAmount;
        investors[investor].totalTokens += tokenAmount;
        investors[investor].investmentCount += 1;
        investors[investor].lastInvestmentTime = block.timestamp;
    }
    
    /**
     * @dev Запрос на крупную инвестицию (требует одобрения мультиподписи) - УЛУЧШЕНО
     * @param reason причина крупной инвестиции
     */
    function requestLargeInvestment(string memory reason) public payable nonReentrant nonReentrantEnhanced whenNotPaused returns (bytes32) {
        require(msg.value > 0, "Investment amount must be greater than 0");
        require(!blacklisted[msg.sender], "Investor is blacklisted");
        require(bytes(reason).length > 0, "Reason cannot be empty");
        require(msg.sender != address(0), "Invalid investor address");
        
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
            requestTimestamp: block.timestamp,
            reason: reason
        });
        
        // Устанавливаем timelock
        requestTimestamps[requestId] = block.timestamp;
        
        emit LargeInvestmentRequested(requestId, msg.sender, msg.value, usdAmount, reason);
        emit SecurityEvent("Large Investment Requested", msg.sender, block.timestamp);
        
        return requestId;
    }
    
    /**
     * @dev Одобрение крупной инвестиции (только подписанты) - УЛУЧШЕНО
     * @param requestId ID запроса на крупную инвестицию
     */
    function approveLargeInvestment(bytes32 requestId) external onlyMultisig nonReentrant {
        LargeInvestmentRequest storage request = largeInvestmentRequests[requestId];
        require(request.investor != address(0), "Request does not exist");
        require(!request.executed, "Request already executed");
        
        // Проверяем timelock
        require(block.timestamp >= request.requestTimestamp + MULTISIG_DELAY, "Timelock not met");
        
        // Определяем, какой подписант одобряет
        if (msg.sender == signer1 && !request.approvedBySigner1) {
            request.approvedBySigner1 = true;
        } else if (msg.sender == signer2 && !request.approvedBySigner2) {
            request.approvedBySigner2 = true;
        } else if (msg.sender == signer3 && !request.approvedBySigner3) {
            request.approvedBySigner3 = true;
        } else {
            revert("Already approved or unauthorized signer");
        }
        
        emit LargeInvestmentApproved(requestId, msg.sender);
        emit SecurityEvent("Large Investment Approved", msg.sender, block.timestamp);
        
        // Проверяем, достаточно ли одобрений для выполнения
        if (_canExecuteLargeInvestment(requestId)) {
            _executeLargeInvestment(requestId);
        }
    }
    
    /**
     * @dev Проверка возможности выполнения крупной инвестиции
     */
    function _canExecuteLargeInvestment(bytes32 requestId) private view returns (bool) {
        LargeInvestmentRequest storage request = largeInvestmentRequests[requestId];
        
        uint256 approvalCount = 0;
        if (request.approvedBySigner1) approvalCount++;
        if (request.approvedBySigner2) approvalCount++;
        if (request.approvedBySigner3) approvalCount++;
        
        return approvalCount >= REQUIRED_APPROVALS;
    }
    
    /**
     * @dev Выполнение крупной инвестиции после одобрения
     */
    function _executeLargeInvestment(bytes32 requestId) private {
        LargeInvestmentRequest storage request = largeInvestmentRequests[requestId];
        require(!request.executed, "Already executed");
        
        request.executed = true;
        
        // Получаем текущий коэффициент
        (uint256 coefficient, ) = getCurrentCoefficient();
        
        // Вычисляем количество токенов
        uint256 tokenAmount = request.ethAmount * BASE_EXCHANGE_RATE * coefficient;
        
        // Проверяем, что у контракта достаточно токенов
        require(
            defimonToken.balanceOf(address(this)) >= tokenAmount,
            "Insufficient tokens in contract"
        );
        
        // Обновляем состояние инвестора
        _updateInvestorState(request.investor, request.ethAmount, tokenAmount);
        
        // Переводим токены
        defimonToken.safeTransfer(request.investor, tokenAmount);
        
        emit LargeInvestmentExecuted(requestId, request.investor, request.ethAmount);
        emit SecurityEvent("Large Investment Executed", request.investor, block.timestamp);
    }
    
    /**
     * @dev Обновление курса ETH/USD с улучшенной безопасностью
     * @param newPrice новый курс в USD (в центах)
     */
    function updateEthUsdPrice(uint256 newPrice) external onlyPriceUpdater nonReentrant {
        require(newPrice > 0, "Price must be greater than 0");
        require(newPrice <= 100000, "Price seems too high"); // Максимум $100,000 за ETH
        
        // Проверяем cooldown
        require(block.timestamp >= lastPriceUpdateTime + PRICE_UPDATE_COOLDOWN, "Cooldown not met");
        
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
        emit SecurityEvent("Price Updated", msg.sender, block.timestamp);
    }
    
    /**
     * @dev Проверка валидности текущей цены ETH
     * @return isValid true если цена актуальна
     * @return timeSinceUpdate время с последнего обновления в секундах
     */
    function isPriceValid() public view returns (bool isValid, uint256 timeSinceUpdate) {
        timeSinceUpdate = block.timestamp - lastPriceUpdateTime;
        isValid = timeSinceUpdate <= PRICE_VALIDITY_PERIOD;
        
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
     * @dev Получение лимитов инвестиций в ETH
     * @return minInvestmentUsd минимальная инвестиция в USD
     * @return maxInvestmentUsd максимальная инвестиция в USD
     * @return largeInvestmentUsd порог крупной инвестиции в USD
     * @return currentEthUsdPrice текущий курс ETH/USD
     * @return minInvestmentEth минимальная инвестиция в ETH
     * @return maxInvestmentEth максимальная инвестиция в ETH
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
     * @dev Управление черным списком (только администратор)
     * @param account адрес для добавления/удаления из черного списка
     * @param status true для добавления, false для удаления
     */
    function setBlacklist(address account, bool status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Cannot blacklist zero address");
        require(account != signer1 && account != signer2 && account != signer3, "Cannot blacklist signers");
        
        blacklisted[account] = status;
        emit AddressBlacklisted(account, status);
        emit SecurityEvent("Address Blacklisted", account, block.timestamp);
    }
    
    /**
     * @dev Экстренная функция для приостановки всех операций (только emergency role)
     */
    function emergencyPause() external onlyEmergencyRole {
        _pause();
        emit SecurityEvent("Contract Paused", msg.sender, block.timestamp);
    }
    
    /**
     * @dev Экстренная функция для снятия приостановки (только emergency role)
     */
    function emergencyUnpause() external onlyEmergencyRole {
        _unpause();
        emit SecurityEvent("Contract Unpaused", msg.sender, block.timestamp);
    }
    
    /**
     * @dev Экстренная функция для вывода ETH (только emergency role)
     * @param to адрес получателя
     */
    function emergencyWithdraw(address to) external onlyEmergencyRole nonReentrant {
        require(to != address(0), "Invalid recipient address");
        require(address(this).balance > 0, "No ETH to withdraw");
        
        uint256 balance = address(this).balance;
        (bool success, ) = to.call{value: balance}("");
        require(success, "ETH transfer failed");
        
        emit SecurityEvent("Emergency Withdrawal", to, block.timestamp);
    }
    
    /**
     * @dev Экстренная функция для вывода токенов (только emergency role)
     * @param to адрес получателя
     * @param amount количество токенов
     */
    function emergencyWithdrawTokens(address to, uint256 amount) external onlyEmergencyRole nonReentrant {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        require(defimonToken.balanceOf(address(this)) >= amount, "Insufficient token balance");
        
        defimonToken.safeTransfer(to, amount);
        emit SecurityEvent("Emergency Token Withdrawal", to, block.timestamp);
    }
    
    /**
     * @dev Получение информации об инвесторе
     * @param investor адрес инвестора
     * @return totalInvested общая сумма инвестиций
     * @return totalTokens общее количество токенов
     * @return investmentCount количество инвестиций
     * @return lastInvestmentTime время последней инвестиции
     * @return exists флаг существования записи
     */
    function getInvestorInfo(address investor) external view returns (
        uint256 totalInvested,
        uint256 totalTokens,
        uint256 investmentCount,
        uint256 lastInvestmentTime,
        bool exists
    ) {
        Investor storage inv = investors[investor];
        return (
            inv.totalInvested,
            inv.totalTokens,
            inv.investmentCount,
            inv.lastInvestmentTime,
            inv.exists
        );
    }
    
    /**
     * @dev Получение количества инвесторов
     * @return count количество инвесторов
     */
    function getInvestorCount() external view returns (uint256 count) {
        return investorAddresses.length;
    }
    
    /**
     * @dev Получение счетчика запросов
     * @return counter текущий счетчик
     */
    function getRequestCounter() external view returns (uint256 counter) {
        return requestCounter;
    }
    
    /**
     * @dev Получение информации о запросе на крупную инвестицию
     * @param requestId ID запроса
     * @return investor адрес инвестора
     * @return ethAmount сумма в ETH
     * @return usdAmount сумма в USD
     * @return approvedBySigner1 одобрено первым подписантом
     * @return approvedBySigner2 одобрено вторым подписантом
     * @return approvedBySigner3 одобрено третьим подписантом
     * @return executed выполнено
     * @return timestamp время создания
     * @return requestTimestamp время запроса
     * @return reason причина
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
        uint256 requestTimestamp,
        string memory reason
    ) {
        LargeInvestmentRequest storage request = largeInvestmentRequests[requestId];
        return (
            request.investor,
            request.ethAmount,
            request.usdAmount,
            request.approvedBySigner1,
            request.approvedBySigner2,
            request.approvedBySigner3,
            request.executed,
            request.timestamp,
            request.requestTimestamp,
            request.reason
        );
    }
    
    /**
     * @dev Получение адреса по индексу в массиве инвесторов
     * @param index индекс в массиве
     * @return investor адрес инвестора
     */
    function getInvestorAddress(uint256 index) external view returns (address investor) {
        require(index < investorAddresses.length, "Index out of bounds");
        return investorAddresses[index];
    }
    
    /**
     * @dev Получение всех адресов инвесторов (осторожно - может быть дорого)
     * @return addresses массив адресов инвесторов
     */
    function getAllInvestorAddresses() external view returns (address[] memory addresses) {
        return investorAddresses;
    }
    
    /**
     * @dev Получение информации о мультиподписи
     * @return _signer1 первый подписант
     * @return _signer2 второй подписант
     * @return _signer3 третий подписант
     * @return delay задержка для мультиподписи
     * @return minSigners минимальное количество подписантов
     * @return requiredApprovals требуемое количество одобрений
     */
    function getMultisigInfo() external view returns (
        address _signer1,
        address _signer2,
        address _signer3,
        uint256 delay,
        uint256 minSigners,
        uint256 requiredApprovals
    ) {
        return (
            signer1,
            signer2,
            signer3,
            MULTISIG_DELAY,
            MIN_SIGNERS,
            REQUIRED_APPROVALS
        );
    }
    
    /**
     * @dev Получение информации о timelock для запроса
     * @param requestId ID запроса
     * @return timestamp время создания запроса
     * @return canExecute можно ли выполнить запрос
     * @return timeRemaining оставшееся время до выполнения
     */
    function getTimelockInfo(bytes32 requestId) external view returns (
        uint256 timestamp,
        bool canExecute,
        uint256 timeRemaining
    ) {
        timestamp = requestTimestamps[requestId];
        canExecute = block.timestamp >= timestamp + MULTISIG_DELAY;
        timeRemaining = timestamp + MULTISIG_DELAY > block.timestamp ? 
            timestamp + MULTISIG_DELAY - block.timestamp : 0;
    }
    
    /**
     * 🔒 ENHANCED SECURITY: Функция для проверки состояния безопасности
     * @return isLocked состояние блокировки
     * @return isPaused состояние паузы
     * @return totalInvestors общее количество инвесторов
     * @return contractBalance баланс контракта в ETH
     * @return tokenBalance баланс токенов в контракте
     */
    function getSecurityStatus() external view returns (
        bool isLocked,
        bool isPaused,
        uint256 totalInvestors,
        uint256 contractBalance,
        uint256 tokenBalance
    ) {
        return (
            _locked,
            paused(),
            investorAddresses.length,
            address(this).balance,
            defimonToken.balanceOf(address(this))
        );
    }
    
    // Fallback функция для получения ETH
    receive() external payable {
        revert("Direct ETH transfers not allowed");
    }
    
    // Fallback функция для неизвестных вызовов
    fallback() external payable {
        revert("Function not found");
    }
}
