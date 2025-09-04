const { run } = require("hardhat");

async function main() {
  // Загружаем адреса контрактов
  const fs = require('fs');
  let contractAddresses;
  
  try {
    const data = fs.readFileSync('./deployed-contracts.json', 'utf8');
    contractAddresses = JSON.parse(data);
  } catch (error) {
    console.error('Ошибка загрузки адресов контрактов:', error);
    process.exit(1);
  }

  console.log("Начинаем верификацию контрактов...");

  // Верификация токена
  console.log("\n1. Верификация DefimonToken...");
  try {
    await run("verify:verify", {
      address: contractAddresses.defimonToken,
      constructorArguments: [],
    });
    console.log("✅ DefimonToken успешно верифицирован");
  } catch (error) {
    console.error("❌ Ошибка верификации DefimonToken:", error.message);
  }

  // Верификация контракта инвестиций
  console.log("\n2. Верификация DefimonInvestment...");
  try {
    await run("verify:verify", {
      address: contractAddresses.defimonInvestment,
      constructorArguments: [
        contractAddresses.defimonToken,
        contractAddresses.signer1,
        contractAddresses.signer2
      ],
    });
    console.log("✅ DefimonInvestment успешно верифицирован");
  } catch (error) {
    console.error("❌ Ошибка верификации DefimonInvestment:", error.message);
  }

  console.log("\n=== РЕЗУЛЬТАТЫ ВЕРИФИКАЦИИ ===");
  console.log("DefimonToken:", `https://sepolia.etherscan.io/address/${contractAddresses.defimonToken}`);
  console.log("DefimonInvestment:", `https://sepolia.etherscan.io/address/${contractAddresses.defimonInvestment}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
