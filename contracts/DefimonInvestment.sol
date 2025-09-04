// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./DefimonToken.sol";

/**
 * @title DefimonInvestment
 * @dev Контракт для инвестиций в проект DEFIMON
 * Система коэффициентов инвестиций:
 * - До 1 ноября 2025 (MVP): коэффициент x10
 * - До 1 февраля 2026 (первый релиз): коэффициент x5
 * - После 1 февраля 2026: коэффициент x1
 * Мультиподпись для вывода средств (2 из 2)
 */
contract DefimonInvestment is Ownable, ReentrancyGuard, Pausable {
    
    // Базовый курс обмена: 1 ETH = 100 DEFI токенов
    uint256 public constant BASE_EXCHANGE_RATE = 100;
    
    // Коэффициенты для разных периодов
    uint256 public constant MVP_COEFFICIENT = 10;      // x10 до MVP
    uint256 public constant RELEASE_COEFFICIENT = 5;   // x5 до релиза
    uint256 public constant STANDARD_COEFFICIENT = 1;  // x1 после релиза
    
    // Временные метки для периодов
    uint256 public constant MVP_DEADLINE = 1761955200; // 1 ноября 2025, 00:00 UTC
    uint256 public constant RELEASE_DEADLINE = 1769904000; // 1 февраля 2026, 00:00 UTC
    
    // Ссылка на контракт токена
    DefimonToken public defimonToken;
    
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
    
    // Мультиподпись для вывода средств (система "2 из 3")
    address public signer1;
    address public signer2;
    address public signer3;
    
    // SECURITY: Emergency controls
    bool public emergencyMode;
    uint256 public emergencyPauseTime;
    address public emergencyController;
    
    // SECURITY: Rate limiting
    mapping(address => uint256) public lastInvestmentTime;
    uint256 public constant MIN_INVESTMENT_INTERVAL = 1 minutes;
    
    // SECURITY: Investment limits
    uint256 public constant MAX_TOTAL_INVESTMENT = 1000 ether;
    uint256 public totalInvested;
    
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
    event WithdrawalRequested(bytes32 indexed requestId, address to, uint256 amount);
    event WithdrawalApproved(bytes32 indexed requestId, address signer);
    event WithdrawalExecuted(bytes32 indexed requestId, address to, uint256 amount);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner, uint8 signerIndex);
    
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
        
        defimonToken = DefimonToken(_defimonToken);
        signer1 = _signer1;
        signer2 = _signer2;
        signer3 = _signer3;
        
        // SECURITY: Set emergency controller to contract owner
        emergencyController = msg.sender;
        emergencyMode = false;
        emergencyPauseTime = 0;
        totalInvested = 0;
    }
    
    /**
     * @dev SECURITY: Emergency pause function (only emergency controller)
     */
    function emergencyPause() external {
        require(msg.sender == emergencyController, "Only emergency controller can pause");
        require(!emergencyMode, "Already in emergency mode");
        
        emergencyMode = true;
        emergencyPauseTime = block.timestamp;
        _pause();
    }
    
    /**
     * @dev SECURITY: Emergency resume function (only emergency controller)
     */
    function emergencyResume() external {
        require(msg.sender == emergencyController, "Only emergency controller can resume");
        require(emergencyMode, "Not in emergency mode");
        
        emergencyMode = false;
        emergencyPauseTime = 0;
        _unpause();
    }
    
    /**
     * @dev SECURITY: Update emergency controller (only current controller)
     */
    function updateEmergencyController(address newController) external {
        require(msg.sender == emergencyController, "Only emergency controller can update");
        require(newController != address(0), "Invalid controller address");
        
        emergencyController = newController;
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
     * SECURITY: Fixed reentrancy vulnerability using Checks-Effects-Interactions pattern
     */
    function invest() public payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Investment amount must be greater than 0");
        require(!emergencyMode, "Contract is in emergency mode");
        
        // CHECKS: Validate all conditions before any state changes
        (uint256 coefficient, uint8 period) = getCurrentCoefficient();
        uint256 tokenAmount = msg.value * BASE_EXCHANGE_RATE * coefficient;
        
        // Verify sufficient tokens in contract
        require(
            defimonToken.balanceOf(address(this)) >= tokenAmount,
            "Insufficient tokens in contract"
        );
        
        // Verify minimum investment amount (anti-spam protection)
        require(msg.value >= 0.001 ether, "Minimum investment is 0.001 ETH");
        
        // Verify maximum investment amount (anti-whale protection)
        require(msg.value <= 100 ether, "Maximum investment is 100 ETH");
        
        // SECURITY: Rate limiting - prevent rapid successive investments
        require(
            block.timestamp >= lastInvestmentTime[msg.sender] + MIN_INVESTMENT_INTERVAL,
            "Investment rate limit exceeded"
        );
        
        // SECURITY: Total investment limit
        require(
            totalInvested + msg.value <= MAX_TOTAL_INVESTMENT,
            "Total investment limit exceeded"
        );
        
        // EFFECTS: Update state variables BEFORE external calls
        if (!investors[msg.sender].exists) {
            investors[msg.sender].exists = true;
            investors[msg.sender].investmentCount = 0;
            investors[msg.sender].totalInvested = 0;
            investors[msg.sender].totalTokens = 0;
            investorAddresses.push(msg.sender);
        }
        
        // Update investor state
        investors[msg.sender].totalInvested += msg.value;
        investors[msg.sender].totalTokens += tokenAmount;
        investors[msg.sender].investmentCount += 1;
        investors[msg.sender].lastInvestmentTime = block.timestamp;
        
        // Update global state
        totalInvested += msg.value;
        lastInvestmentTime[msg.sender] = block.timestamp;
        
        // INTERACTIONS: External calls AFTER state updates (prevents reentrancy)
        // Transfer tokens to investor
        bool transferSuccess = defimonToken.transfer(msg.sender, tokenAmount);
        require(transferSuccess, "Token transfer failed");
        
        emit InvestmentMade(msg.sender, msg.value, tokenAmount, coefficient, period);
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
        
        bytes32 requestId = keccak256(abi.encodePacked(to, amount, block.timestamp, block.number));
        
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
     * @dev Получение ETH (fallback функция)
     */
    receive() external payable {
        // Автоматически вызываем функцию инвестирования
        invest();
    }
}
