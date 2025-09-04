// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title DefimonTokenV2
 * @dev Улучшенная версия ERC20 токена для проекта DEFIMON
 * Общий выпуск: 10,000,000,000 токенов
 */
contract DefimonTokenV2 is ERC20, Ownable, ERC20Burnable, Pausable {
    
    // Общий выпуск токенов: 10 миллиардов
    uint256 public constant TOTAL_SUPPLY = 10_000_000_000 * 10**18;
    
    // Максимальная сумма за одну транзакцию (защита от ошибок)
    uint256 public constant MAX_TRANSFER_AMOUNT = 5_000_000_000 * 10**18; // 5B токенов (50% от общего выпуска)
    
    // Маппинг заблокированных адресов
    mapping(address => bool) public blacklisted;
    
    // События
    event TokensTransferred(address indexed from, address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event AddressBlacklisted(address indexed account, bool status);
    
    constructor() ERC20("DEFIMON", "DEFI") {
        // Выпускаем все токены владельцу контракта
        _mint(msg.sender, TOTAL_SUPPLY);
    }
    
    /**
     * @dev Переопределяем transfer с дополнительными проверками
     */
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        require(!blacklisted[msg.sender], "Sender is blacklisted");
        require(!blacklisted[to], "Recipient is blacklisted");
        require(amount <= MAX_TRANSFER_AMOUNT, "Transfer amount exceeds maximum");
        
        return super.transfer(to, amount);
    }
    
    /**
     * @dev Переопределяем transferFrom с дополнительными проверками
     */
    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        require(!blacklisted[from], "Sender is blacklisted");
        require(!blacklisted[to], "Recipient is blacklisted");
        require(amount <= MAX_TRANSFER_AMOUNT, "Transfer amount exceeds maximum");
        
        return super.transferFrom(from, to, amount);
    }
    
    /**
     * @dev Функция для перевода токенов (только владелец)
     * @param to адрес получателя
     * @param amount количество токенов
     */
    function transferTokens(address to, uint256 amount) external onlyOwner whenNotPaused {
        require(to != address(0), "Cannot transfer to zero address");
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= MAX_TRANSFER_AMOUNT, "Transfer amount exceeds maximum");
        require(balanceOf(owner()) >= amount, "Insufficient balance");
        require(!blacklisted[to], "Recipient is blacklisted");
        
        _transfer(owner(), to, amount);
        emit TokensTransferred(owner(), to, amount);
    }
    
    /**
     * @dev Функция для сжигания токенов (только владелец)
     * @param amount количество токенов для сжигания
     */
    function burnTokens(uint256 amount) external onlyOwner whenNotPaused {
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= MAX_TRANSFER_AMOUNT, "Burn amount exceeds maximum");
        require(balanceOf(owner()) >= amount, "Insufficient balance");
        
        _burn(owner(), amount);
        emit TokensBurned(owner(), amount);
    }
    
    /**
     * @dev Блокировка/разблокировка адреса (только владелец)
     * @param account адрес для блокировки
     * @param status true - заблокировать, false - разблокировать
     */
    function setBlacklist(address account, bool status) external onlyOwner {
        require(account != address(0), "Cannot blacklist zero address");
        require(account != owner(), "Cannot blacklist owner");
        
        blacklisted[account] = status;
        emit AddressBlacklisted(account, status);
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
     * @dev Получение информации о токене
     */
    function getTokenInfo() external view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        uint256 tokenTotalSupply,
        uint256 maxTransferAmount
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            MAX_TRANSFER_AMOUNT
        );
    }
}
