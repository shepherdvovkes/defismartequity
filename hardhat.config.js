require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY || 'placeholder'}`,
      accounts: process.env.PRIVATE_KEY_1 && process.env.PRIVATE_KEY_2 
        ? [process.env.PRIVATE_KEY_1, process.env.PRIVATE_KEY_2]
        : [],
      gasPrice: 20000000000, // 20 gwei
    },
    hardhat: {
      chainId: 1337
    }
    },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || 'placeholder'
  }
};
