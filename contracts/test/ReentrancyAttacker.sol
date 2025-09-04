// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ReentrancyAttacker
 * @dev Malicious contract for testing reentrancy protection
 * WARNING: This contract is for PENETRATION TESTING ONLY
 * DO NOT deploy to mainnet or use in production
 */

interface IDefimonInvestment {
    function invest() external payable;
    function getCurrentCoefficient() external view returns (uint256 coefficient, uint8 period);
}

contract ReentrancyAttacker {
    IDefimonInvestment public targetContract;
    uint256 public attackCount;
    bool public isAttacking;
    
    event AttackAttempt(uint256 count, uint256 balance);
    
    constructor(address _targetContract) {
        targetContract = IDefimonInvestment(_targetContract);
    }
    
    /**
     * @dev Initiates a reentrancy attack
     */
    function attack() external payable {
        require(msg.value > 0, "Must send ETH to attack");
        require(!isAttacking, "Attack already in progress");
        
        isAttacking = true;
        attackCount++;
        
        // Start the attack by calling invest
        targetContract.invest{value: msg.value}();
        
        isAttacking = false;
        
        emit AttackAttempt(attackCount, address(this).balance);
    }
    
    /**
     * @dev Fallback function that attempts reentrancy
     */
    receive() external payable {
        if (isAttacking && attackCount < 5) { // Limit attack attempts
            // Try to reenter the contract
            try targetContract.invest{value: 0}() {
                // If successful, this indicates a vulnerability
                attackCount++;
            } catch {
                // Attack failed, contract has protection
            }
        }
    }
    
    /**
     * @dev Emergency function to withdraw funds
     */
    function emergencyWithdraw() external {
        payable(msg.sender).transfer(address(this).balance);
    }
    
    /**
     * @dev Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Get attack statistics
     */
    function getAttackStats() external view returns (uint256 _attackCount, bool _isAttacking) {
        return (attackCount, isAttacking);
    }
}
