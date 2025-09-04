// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title DefimonToken
 * @dev ERC20 токен для проекта DEFIMON
 * Общий выпуск: 10,000,000,000 токенов
 */
contract DefimonToken is ERC20, Ownable, ERC20Burnable {
    
    // Общий выпуск токенов: 10 миллиардов
    uint256 public constant TOTAL_SUPPLY = 10_000_000_000 * 10**18;
    
    constructor() ERC20("DEFIMON", "DEFI") {
        // Выпускаем все токены владельцу контракта
        _mint(msg.sender, TOTAL_SUPPLY);
    }
    
    /**
     * @dev Функция для перевода токенов (только владелец)
     * @param to адрес получателя
     * @param amount количество токенов
     */
    function transferTokens(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot transfer to zero address");
        require(amount > 0, "Amount must be greater than zero");
        require(balanceOf(owner()) >= amount, "Insufficient balance");
        
        _transfer(owner(), to, amount);
    }
    
    /**
     * @dev Функция для сжигания токенов (только владелец)
     * @param amount количество токенов для сжигания
     */
    function burnTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than zero");
        require(balanceOf(owner()) >= amount, "Insufficient balance");
        
        _burn(owner(), amount);
    }
}
