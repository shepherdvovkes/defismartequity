const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment to Sepolia...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  
  // Check if we have enough balance
  const balance = await deployer.getBalance();
  if (balance.lt(ethers.utils.parseEther("0.01"))) {
    console.error("Insufficient balance for deployment. Need at least 0.01 ETH for gas fees.");
    return;
  }
  
  try {
    // Deploy DefimonToken
    console.log("\n1. Deploying DefimonToken...");
    const DefimonToken = await ethers.getContractFactory("DefimonToken");
    const defimonToken = await DefimonToken.deploy();
    await defimonToken.deployed();
    
    console.log("DefimonToken deployed to:", defimonToken.address);
    console.log("Total supply:", (await defimonToken.totalSupply()).toString());
    
    // Deploy DefimonInvestment
    console.log("\n2. Deploying DefimonInvestment...");
    const DefimonInvestment = await ethers.getContractFactory("DefimonInvestment");
    const defimonInvestment = await DefimonInvestment.deploy(
      defimonToken.address,
      deployer.address, // signer1 (same as deployer for now)
      deployer.address  // signer2 (same as deployer for now)
    );
    await defimonInvestment.deployed();
    
    console.log("DefimonInvestment deployed to:", defimonInvestment.address);
    console.log("Signer 1:", deployer.address);
    console.log("Signer 2:", deployer.address);
    
    // Transfer tokens to investment contract
    console.log("\n3. Transferring tokens to investment contract...");
    const totalSupply = await defimonToken.totalSupply();
    const tokensForSale = totalSupply.div(2); // 50% от общего выпуска
    
    await defimonToken.transferTokens(defimonInvestment.address, tokensForSale);
    
    const investmentTokenBalance = await defimonToken.balanceOf(defimonInvestment.address);
    console.log("Tokens transferred to investment contract:", investmentTokenBalance.toString());
    
    // Save contract addresses
    const contractAddresses = {
      defimonToken: defimonToken.address,
      defimonInvestment: defimonInvestment.address,
      deployer: deployer.address,
      signer1: deployer.address,
      signer2: deployer.address,
      network: "sepolia",
      deploymentTime: new Date().toISOString()
    };
    
    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log("Network: Sepolia");
    console.log("DefimonToken:", defimonToken.address);
    console.log("DefimonInvestment:", defimonInvestment.address);
    console.log("Deployer:", deployer.address);
    console.log("Tokens for sale:", tokensForSale.toString());
    console.log("Exchange rate: 1 ETH = 100 DEFI tokens");
    
    // Save to file
    const fs = require('fs');
    fs.writeFileSync(
      './deployed-contracts.json',
      JSON.stringify(contractAddresses, null, 2)
    );
    
    console.log("\nContract addresses saved to deployed-contracts.json");
    
    // Instructions for verification
    console.log("\n=== VERIFICATION COMMANDS ===");
    console.log("npx hardhat verify --network sepolia", defimonToken.address);
    console.log("npx hardhat verify --network sepolia", defimonInvestment.address, 
      defimonToken.address, deployer.address, deployer.address);
      
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
