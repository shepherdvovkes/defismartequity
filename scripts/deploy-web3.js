const { ethers } = require("ethers");

async function main() {
  console.log("Starting deployment with MetaMask...");
  
  // Check if MetaMask is available
  if (typeof window !== 'undefined' && window.ethereum) {
    console.log("MetaMask detected!");
  } else {
    console.log("Please install MetaMask and connect to Sepolia testnet");
    return;
  }
  
  // Get provider from MetaMask
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  
  // Request account access
  const accounts = await provider.send("eth_requestAccounts", []);
  const deployer = accounts[0];
  
  console.log("Deploying contracts with account:", deployer);
  
  // Get signer
  const signer = provider.getSigner();
  
  // Deploy DefimonToken
  console.log("\n1. Deploying DefimonToken...");
  const DefimonToken = new ethers.ContractFactory(
    DefimonTokenABI, // You'll need to include the ABI here
    DefimonTokenBytecode,
    signer
  );
  
  const defimonToken = await DefimonToken.deploy();
  await defimonToken.deployed();
  
  console.log("DefimonToken deployed to:", defimonToken.address);
  
  // Deploy DefimonInvestment
  console.log("\n2. Deploying DefimonInvestment...");
  const DefimonInvestment = new ethers.ContractFactory(
    DefimonInvestmentABI, // You'll need to include the ABI here
    DefimonInvestmentBytecode,
    signer
  );
  
  const defimonInvestment = await DefimonInvestment.deploy(
    defimonToken.address,
    deployer, // Use deployer as signer1
    deployer  // Use deployer as signer2 for now
  );
  await defimonInvestment.deployed();
  
  console.log("DefimonInvestment deployed to:", defimonInvestment.address);
  
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Network: Sepolia");
  console.log("DefimonToken:", defimonToken.address);
  console.log("DefimonInvestment:", defimonInvestment.address);
  console.log("Deployer:", deployer);
}

main().catch(console.error);
