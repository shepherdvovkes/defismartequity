const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment...");
  
  // Получаем аккаунты
  const [deployer, signer1, signer2] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  
  // Деплой токена DEFIMON
  console.log("\n1. Deploying DefimonToken...");
  const DefimonToken = await ethers.getContractFactory("DefimonToken");
  const defimonToken = await DefimonToken.deploy();
  await defimonToken.deployed();
  
  console.log("DefimonToken deployed to:", defimonToken.address);
  console.log("Total supply:", (await defimonToken.totalSupply()).toString());
  
  // Переводим 50% токенов на контракт инвестиций для продажи
  console.log("\n2. Transferring tokens to investment contract...");
  const totalSupply = await defimonToken.totalSupply();
  const tokensForSale = totalSupply.div(2); // 50% от общего выпуска
  
  // Деплой контракта инвестиций
  console.log("\n3. Deploying DefimonInvestment...");
  const DefimonInvestment = await ethers.getContractFactory("DefimonInvestment");
  const defimonInvestment = await DefimonInvestment.deploy(
    defimonToken.address,
    signer1.address,
    signer2.address
  );
  await defimonInvestment.deployed();
  
  console.log("DefimonInvestment deployed to:", defimonInvestment.address);
  console.log("Signer 1:", signer1.address);
  console.log("Signer 2:", signer2.address);
  
  // Переводим токены на контракт инвестиций
  console.log("\n4. Transferring tokens to investment contract...");
  await defimonToken.transferTokens(defimonInvestment.address, tokensForSale);
  
  const investmentTokenBalance = await defimonToken.balanceOf(defimonInvestment.address);
  console.log("Tokens transferred to investment contract:", investmentTokenBalance.toString());
  
  // Сохраняем адреса контрактов
  const contractAddresses = {
    defimonToken: defimonToken.address,
    defimonInvestment: defimonInvestment.address,
    deployer: deployer.address,
    signer1: signer1.address,
    signer2: signer2.address,
    network: "sepolia"
  };
  
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network: Sepolia");
  console.log("DefimonToken:", defimonToken.address);
  console.log("DefimonInvestment:", defimonInvestment.address);
  console.log("Deployer:", deployer.address);
  console.log("Signer 1:", signer1.address);
  console.log("Signer 2:", signer2.address);
  console.log("Tokens for sale:", tokensForSale.toString());
  console.log("Exchange rate: 1 ETH = 100 DEFI tokens");
  
  // Сохраняем адреса в файл
  const fs = require('fs');
  fs.writeFileSync(
    './deployed-contracts.json',
    JSON.stringify(contractAddresses, null, 2)
  );
  
  console.log("\nContract addresses saved to deployed-contracts.json");
  
  // Инструкции для верификации
  console.log("\n=== VERIFICATION COMMANDS ===");
  console.log("npx hardhat verify --network sepolia", defimonToken.address);
  console.log("npx hardhat verify --network sepolia", defimonInvestment.address, 
    defimonToken.address, signer1.address, signer2.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
