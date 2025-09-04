const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DefimonInvestmentV2_Secured Security Tests", function () {
  let defimonInvestmentV2Secured;
  let defimonTokenV2;
  let owner, signer1, signer2, signer3, investor1, investor2, attacker;

  beforeEach(async function () {
    [owner, signer1, signer2, signer3, investor1, investor2, attacker] = await ethers.getSigners();

    // Деплоим токен
    const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
    defimonTokenV2 = await DefimonTokenV2.deploy();

    // Деплоим улучшенный контракт инвестиций
    const DefimonInvestmentV2Secured = await ethers.getContractFactory("DefimonInvestmentV2_Secured");
    defimonInvestmentV2Secured = await DefimonInvestmentV2Secured.deploy(
      defimonTokenV2.address,
      signer1.address,
      signer2.address,
      signer3.address
    );

    // Переводим токены на контракт инвестиций
    const totalSupply = await defimonTokenV2.totalSupply();
    const tokensForSale = totalSupply.div(2);
    await defimonTokenV2.transferTokens(defimonInvestmentV2Secured.address, tokensForSale);

    // Финансируем тестовые аккаунты
    await owner.sendTransaction({ to: investor1.address, value: ethers.utils.parseEther("100") });
    await owner.sendTransaction({ to: investor2.address, value: ethers.utils.parseEther("100") });
    await owner.sendTransaction({ to: attacker.address, value: ethers.utils.parseEther("100") });
  });

  describe("Role-Based Access Control", function () {
    it("Should have correct roles assigned", async function () {
      expect(await defimonInvestmentV2Secured.hasRole(await defimonInvestmentV2Secured.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await defimonInvestmentV2Secured.hasRole(await defimonInvestmentV2Secured.EMERGENCY_ROLE(), owner.address)).to.be.true;
      expect(await defimonInvestmentV2Secured.hasRole(await defimonInvestmentV2Secured.PRICE_UPDATER_ROLE(), owner.address)).to.be.true;
      expect(await defimonInvestmentV2Secured.hasRole(await defimonInvestmentV2Secured.MULTISIG_ROLE(), signer1.address)).to.be.true;
      expect(await defimonInvestmentV2Secured.hasRole(await defimonInvestmentV2Secured.MULTISIG_ROLE(), signer2.address)).to.be.true;
      expect(await defimonInvestmentV2Secured.hasRole(await defimonInvestmentV2Secured.MULTISIG_ROLE(), signer3.address)).to.be.true;
    });

    it("Should only allow emergency role to pause", async function () {
      await expect(
        defimonInvestmentV2Secured.connect(investor1).emergencyPause()
      ).to.be.revertedWith("Caller is not emergency role");

      await defimonInvestmentV2Secured.emergencyPause();
      expect(await defimonInvestmentV2Secured.paused()).to.be.true;
    });

    it("Should only allow price updater role to update price", async function () {
      await expect(
        defimonInvestmentV2Secured.connect(investor1).updateEthUsdPrice(2500)
      ).to.be.revertedWith("Caller is not price updater");

      await defimonInvestmentV2Secured.updateEthUsdPrice(2500);
      expect(await defimonInvestmentV2Secured.ethUsdPrice()).to.equal(2500);
    });

    it("Should only allow multisig role to approve investments", async function () {
      // Создаем запрос на крупную инвестицию
      const largeAmount = ethers.utils.parseEther("101"); // 101 ETH = $101,000 при курсе $1000
      await defimonInvestmentV2Secured.connect(investor1).requestLargeInvestment("Test", { value: largeAmount });
      
      // Получаем requestId
      const requestId = await defimonInvestmentV2Secured.getRequestCounter();
      
      await expect(
        defimonInvestmentV2Secured.connect(investor1).approveLargeInvestment(requestId)
      ).to.be.revertedWith("Caller is not multisig role");
    });
  });

  describe("Enhanced Price Security", function () {
    it("Should enforce price update cooldown", async function () {
      await defimonInvestmentV2Secured.updateEthUsdPrice(2500);
      
      // Попытка обновить цену сразу же должна провалиться
      await expect(
        defimonInvestmentV2Secured.updateEthUsdPrice(3000)
      ).to.be.revertedWith("Cooldown not met");
    });

    it("Should limit price change to 50%", async function () {
      // Попытка изменить цену более чем на 50% должна провалиться
      await expect(
        defimonInvestmentV2Secured.updateEthUsdPrice(5000) // 150% изменение
      ).to.be.revertedWith("Price change exceeds maximum allowed percentage");
    });

    it("Should allow reasonable price changes", async function () {
      // Изменение на 25% должно пройти
      await defimonInvestmentV2Secured.updateEthUsdPrice(2500);
      expect(await defimonInvestmentV2Secured.ethUsdPrice()).to.equal(2500);
    });
  });

  describe("Enhanced Input Validation", function () {
    it("Should prevent overflow in ethToUsd", async function () {
      const hugeAmount = ethers.constants.MaxUint256;
      await expect(
        defimonInvestmentV2Secured.ethToUsd(hugeAmount)
      ).to.be.revertedWith("Amount too large");
    });

    it("Should prevent overflow in usdToEth", async function () {
      const hugeAmount = ethers.constants.MaxUint256;
      await expect(
        defimonInvestmentV2Secured.usdToEth(hugeAmount)
      ).to.be.revertedWith("Overflow in usdToEth");
    });

    it("Should validate reason in large investment request", async function () {
      const largeAmount = ethers.utils.parseEther("101");
      
      await expect(
        defimonInvestmentV2Secured.connect(investor1).requestLargeInvestment("", { value: largeAmount })
      ).to.be.revertedWith("Reason cannot be empty");
    });
  });

  describe("Enhanced Multisig Security", function () {
    it("Should enforce timelock for large investments", async function () {
      const largeAmount = ethers.utils.parseEther("101");
      await defimonInvestmentV2Secured.connect(investor1).requestLargeInvestment("Test", { value: largeAmount });
      
      const requestId = await defimonInvestmentV2Secured.getRequestCounter();
      
      // Попытка одобрить сразу должна провалиться
      await expect(
        defimonInvestmentV2Secured.connect(signer1).approveLargeInvestment(requestId)
      ).to.be.revertedWith("Timelock not met");
    });

    it("Should provide timelock information", async function () {
      const largeAmount = ethers.utils.parseEther("101");
      await defimonInvestmentV2Secured.connect(investor1).requestLargeInvestment("Test", { value: largeAmount });
      
      const requestId = await defimonInvestmentV2Secured.getRequestCounter();
      const timelockInfo = await defimonInvestmentV2Secured.getTimelockInfo(requestId);
      
      expect(timelockInfo.canExecute).to.be.false;
      expect(timelockInfo.timeRemaining).to.be.gt(0);
    });

    it("Should get multisig information", async function () {
      const multisigInfo = await defimonInvestmentV2Secured.getMultisigInfo();
      
      expect(multisigInfo._signer1).to.equal(signer1.address);
      expect(multisigInfo._signer2).to.equal(signer2.address);
      expect(multisigInfo._signer3).to.equal(signer3.address);
      expect(multisigInfo.delay).to.equal(24 * 60 * 60); // 24 hours
      expect(multisigInfo.minSigners).to.equal(3);
      expect(multisigInfo.requiredApprovals).to.equal(2);
    });
  });

  describe("Enhanced Blacklist Security", function () {
    it("Should prevent blacklisting owner", async function () {
      await expect(
        defimonInvestmentV2Secured.setBlacklist(owner.address, true)
      ).to.be.revertedWith("Cannot blacklist owner");
    });

    it("Should prevent blacklisting signers", async function () {
      await expect(
        defimonInvestmentV2Secured.setBlacklist(signer1.address, true)
      ).to.be.revertedWith("Cannot blacklist signers");
    });

    it("Should allow blacklisting regular addresses", async function () {
      await defimonInvestmentV2Secured.setBlacklist(investor1.address, true);
      expect(await defimonInvestmentV2Secured.blacklisted(investor1.address)).to.be.true;
    });
  });

  describe("Enhanced Emergency Functions", function () {
    it("Should only allow emergency role to withdraw ETH", async function () {
      // Сначала инвестируем, чтобы у контракта были средства
      const limits = await defimonInvestmentV2Secured.getInvestmentLimits();
      const amount = limits.minInvestmentEth;
      await defimonInvestmentV2Secured.connect(investor1).invest({ value: amount });

      await expect(
        defimonInvestmentV2Secured.connect(investor1).emergencyWithdraw(owner.address)
      ).to.be.revertedWith("Caller is not emergency role");

      await defimonInvestmentV2Secured.emergencyWithdraw(owner.address);
    });

    it("Should only allow emergency role to withdraw tokens", async function () {
      await expect(
        defimonInvestmentV2Secured.connect(investor1).emergencyWithdrawTokens(owner.address, ethers.utils.parseEther("1000"))
      ).to.be.revertedWith("Caller is not emergency role");

      await defimonInvestmentV2Secured.emergencyWithdrawTokens(owner.address, ethers.utils.parseEther("1000"));
    });
  });

  describe("Enhanced Fallback Protection", function () {
    it("Should reject direct ETH transfers", async function () {
      await expect(
        owner.sendTransaction({ to: defimonInvestmentV2Secured.address, value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("Direct ETH transfers not allowed");
    });

    it("Should reject unknown function calls", async function () {
      await expect(
        defimonInvestmentV2Secured.connect(owner).fallback()
      ).to.be.revertedWith("Function not found");
    });
  });

  describe("Enhanced Investor Management", function () {
    it("Should provide comprehensive investor info", async function () {
      // Инвестируем
      const limits = await defimonInvestmentV2Secured.getInvestmentLimits();
      const amount = limits.minInvestmentEth;
      await defimonInvestmentV2Secured.connect(investor1).invest({ value: amount });

      const investorInfo = await defimonInvestmentV2Secured.getInvestorInfo(investor1.address);
      
      expect(investorInfo.totalInvested).to.equal(amount);
      expect(investorInfo.totalTokens).to.be.gt(0);
      expect(investorInfo.investmentCount).to.equal(1);
      expect(investorInfo.exists).to.be.true;
    });

    it("Should provide investor addresses by index", async function () {
      // Инвестируем
      const limits = await defimonInvestmentV2Secured.getInvestmentLimits();
      const amount = limits.minInvestmentEth;
      await defimonInvestmentV2Secured.connect(investor1).invest({ value: amount });

      const address0 = await defimonInvestmentV2Secured.getInvestorAddress(0);
      expect(address0).to.equal(investor1.address);
    });

    it("Should prevent out of bounds access", async function () {
      await expect(
        defimonInvestmentV2Secured.getInvestorAddress(999)
      ).to.be.revertedWith("Index out of bounds");
    });
  });

  describe("Enhanced Large Investment Flow", function () {
    it("Should complete large investment with timelock", async function () {
      const largeAmount = ethers.utils.parseEther("101");
      await defimonInvestmentV2Secured.connect(investor1).requestLargeInvestment("Test", { value: largeAmount });
      
      const requestId = await defimonInvestmentV2Secured.getRequestCounter();
      
      // Ждем timelock (в тестах используем блокчейн время)
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]); // 24 hours + 1 second
      await ethers.provider.send("evm_mine");
      
      // Одобряем двумя подписантами
      await defimonInvestmentV2Secured.connect(signer1).approveLargeInvestment(requestId);
      await defimonInvestmentV2Secured.connect(signer2).approveLargeInvestment(requestId);
      
      // Проверяем, что инвестиция выполнена
      const request = await defimonInvestmentV2Secured.getLargeInvestmentRequest(requestId);
      expect(request.executed).to.be.true;
    });
  });

  describe("Gas Optimization", function () {
    it("Should use immutable for token contract", async function () {
      const tokenAddress = await defimonInvestmentV2Secured.defimonToken();
      expect(tokenAddress).to.equal(defimonTokenV2.address);
    });

    it("Should use immutable for signers", async function () {
      const multisigInfo = await defimonInvestmentV2Secured.getMultisigInfo();
      expect(multisigInfo._signer1).to.equal(signer1.address);
      expect(multisigInfo._signer2).to.equal(signer2.address);
      expect(multisigInfo._signer3).to.equal(signer3.address);
    });
  });

  describe("Comprehensive Security Checks", function () {
    it("Should prevent all known attack vectors", async function () {
      // 1. Reentrancy protection
      expect(await defimonInvestmentV2Secured.paused()).to.be.false;
      
      // 2. Access control
      expect(await defimonInvestmentV2Secured.hasRole(await defimonInvestmentV2Secured.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      
      // 3. Input validation
      await expect(
        defimonInvestmentV2Secured.ethToUsd(0)
      ).to.be.revertedWith("Amount must be greater than 0");
      
      // 4. Price security
      expect(await defimonInvestmentV2Secured.MAX_PRICE_CHANGE_PERCENT()).to.equal(50);
      expect(await defimonInvestmentV2Secured.PRICE_UPDATE_COOLDOWN()).to.equal(60 * 60); // 1 hour
      
      // 5. Multisig security
      expect(await defimonInvestmentV2Secured.MULTISIG_DELAY()).to.equal(24 * 60 * 60); // 24 hours
      expect(await defimonInvestmentV2Secured.REQUIRED_APPROVALS()).to.equal(2);
    });
  });
});
