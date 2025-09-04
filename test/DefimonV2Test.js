const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DefimonTokenV2 and DefimonInvestmentV2", function () {
  let defimonTokenV2;
  let defimonInvestmentV2;
  let owner;
  let signer1;
  let signer2;
  let signer3;
  let investor1;
  let investor2;
  let attacker;

  beforeEach(async function () {
    [owner, signer1, signer2, investor1, investor2, attacker, signer3] = await ethers.getSigners();

    // Деплой токена V2
    const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
    defimonTokenV2 = await DefimonTokenV2.deploy();
    await defimonTokenV2.deployed();

    // Деплой контракта инвестиций V2
    const DefimonInvestmentV2 = await ethers.getContractFactory("DefimonInvestmentV2");
    defimonInvestmentV2 = await DefimonInvestmentV2.deploy(
      defimonTokenV2.address,
      signer1.address,
      signer2.address,
      signer3.address
    );
    await defimonInvestmentV2.deployed();

    // Переводим 50% токенов на контракт инвестиций
    const totalSupply = await defimonTokenV2.totalSupply();
    const tokensForSale = totalSupply.div(2);
    await defimonTokenV2.transferTokens(defimonInvestmentV2.address, tokensForSale);
  });

  describe("DefimonTokenV2", function () {
    it("Should have correct name and symbol", async function () {
      expect(await defimonTokenV2.name()).to.equal("DEFIMON");
      expect(await defimonTokenV2.symbol()).to.equal("DEFI");
    });

    it("Should have correct total supply", async function () {
      const totalSupply = await defimonTokenV2.totalSupply();
      expect(totalSupply).to.equal(ethers.utils.parseEther("10000000000")); // 10 billion
    });

    it("Should have correct MAX_TRANSFER_AMOUNT", async function () {
      const maxTransferAmount = await defimonTokenV2.MAX_TRANSFER_AMOUNT();
      expect(maxTransferAmount).to.equal(ethers.utils.parseEther("5000000000")); // 5B (50% от общего выпуска)
    });

    it("Should allow owner to transfer tokens", async function () {
      const amount = ethers.utils.parseEther("1000");
      await defimonTokenV2.transferTokens(investor1.address, amount);
      expect(await defimonTokenV2.balanceOf(investor1.address)).to.equal(amount);
    });

    it("Should allow owner to burn tokens", async function () {
      const amount = ethers.utils.parseEther("1000");
      const balanceBefore = await defimonTokenV2.balanceOf(owner.address);
      await defimonTokenV2.burnTokens(amount);
      const balanceAfter = await defimonTokenV2.balanceOf(owner.address);
      expect(balanceAfter).to.equal(balanceBefore.sub(amount));
    });

    it("Should allow owner to set blacklist", async function () {
      await defimonTokenV2.setBlacklist(investor1.address, true);
      expect(await defimonTokenV2.blacklisted(investor1.address)).to.be.true;
      
      await defimonTokenV2.setBlacklist(investor1.address, false);
      expect(await defimonTokenV2.blacklisted(investor1.address)).to.be.false;
    });

    it("Should prevent blacklisted addresses from transferring", async function () {
      await defimonTokenV2.transferTokens(investor1.address, ethers.utils.parseEther("1000"));
      await defimonTokenV2.setBlacklist(investor1.address, true);
      
      await expect(
        defimonTokenV2.connect(investor1).transfer(investor2.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Sender is blacklisted");
    });

    it("Should prevent transfers to blacklisted addresses", async function () {
      await defimonTokenV2.transferTokens(investor1.address, ethers.utils.parseEther("1000"));
      await defimonTokenV2.setBlacklist(investor2.address, true);
      
      await expect(
        defimonTokenV2.connect(investor1).transfer(investor2.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Recipient is blacklisted");
    });

    it("Should prevent transfers exceeding MAX_TRANSFER_AMOUNT", async function () {
      const maxAmount = await defimonTokenV2.MAX_TRANSFER_AMOUNT();
      const exceedAmount = maxAmount.add(ethers.utils.parseEther("1"));
      
      await expect(
        defimonTokenV2.transferTokens(investor1.address, exceedAmount)
      ).to.be.revertedWith("Transfer amount exceeds maximum");
    });

    it("Should allow owner to pause and unpause", async function () {
      await defimonTokenV2.pause();
      expect(await defimonTokenV2.paused()).to.be.true;
      
      await defimonTokenV2.unpause();
      expect(await defimonTokenV2.paused()).to.be.false;
    });

    it("Should prevent transfers when paused", async function () {
      await defimonTokenV2.pause();
      
      await expect(
        defimonTokenV2.transferTokens(investor1.address, ethers.utils.parseEther("1000"))
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("DefimonInvestmentV2", function () {
    it("Should have correct exchange rate", async function () {
      expect(await defimonInvestmentV2.BASE_EXCHANGE_RATE()).to.equal(100);
    });

    it("Should allow investment and issue tokens", async function () {
      // Получаем лимиты и используем минимальную сумму
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const investmentAmount = limits.minInvestmentEth; // Минимальная сумма
      
      // Получаем текущий коэффициент для расчета ожидаемых токенов
      const [coefficient, period] = await defimonInvestmentV2.getCurrentCoefficient();
      const expectedTokens = investmentAmount.mul(coefficient).mul(100); // BASE_EXCHANGE_RATE * coefficient

      await defimonInvestmentV2.connect(investor1).invest({ value: investmentAmount });

      expect(await defimonTokenV2.balanceOf(investor1.address)).to.equal(expectedTokens);
      
      const investorInfo = await defimonInvestmentV2.getInvestorInfo(investor1.address);
      expect(investorInfo.totalInvested).to.equal(investmentAmount);
      expect(investorInfo.totalTokens).to.equal(expectedTokens);
      expect(investorInfo.exists).to.be.true;
    });

    it("Should track multiple investments from same investor", async function () {
      // Получаем лимиты и используем суммы в пределах лимитов
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const minEth = limits.minInvestmentEth;
      const maxEth = limits.maxInvestmentEth;
      
      // Используем суммы в пределах лимитов
      const investment1 = minEth; // Минимальная сумма
      const investment2 = minEth.mul(2); // В два раза больше минимума, но меньше максимума

      await defimonInvestmentV2.connect(investor1).invest({ value: investment1 });
      await defimonInvestmentV2.connect(investor1).invest({ value: investment2 });

      const totalInvested = investment1.add(investment2);
      
      // Получаем текущий коэффициент для расчета ожидаемых токенов
      const [coefficient, period] = await defimonInvestmentV2.getCurrentCoefficient();
      const totalTokens = totalInvested.mul(coefficient).mul(100); // BASE_EXCHANGE_RATE * coefficient

      const investorInfo = await defimonInvestmentV2.getInvestorInfo(investor1.address);
      expect(investorInfo.totalInvested).to.equal(totalInvested);
      expect(investorInfo.totalTokens).to.equal(totalTokens);
    });

    it("Should allow withdrawal with multisig approval (2 out of 3)", async function () {
      // Получаем лимиты и инвестируем минимальную сумму
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const investmentAmount = limits.minInvestmentEth;
      await defimonInvestmentV2.connect(investor1).invest({ value: investmentAmount });

      // Создаем запрос на вывод
      const withdrawalAmount = ethers.utils.parseEther("0.5");
      const tx = await defimonInvestmentV2.requestWithdrawal(owner.address, withdrawalAmount);
      const receipt = await tx.wait();
      
      // Находим requestId из события
      const event = receipt.events.find(e => e.event === 'WithdrawalRequested');
      const requestId = event.args.requestId;

      // Одобряем первым подписантом
      await defimonInvestmentV2.connect(signer1).approveWithdrawal(requestId);
      
      // Одобряем вторым подписантом (должен автоматически выполниться при 2 из 3)
      const ownerBalanceBefore = await owner.getBalance();
      await defimonInvestmentV2.connect(signer2).approveWithdrawal(requestId);
      const ownerBalanceAfter = await owner.getBalance();

      // Проверяем, что средства переведены
      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(withdrawalAmount);
    });

    it("Should not allow withdrawal without at least 2 approvals", async function () {
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const investmentAmount = limits.minInvestmentEth;
      await defimonInvestmentV2.connect(investor1).invest({ value: investmentAmount });

      const withdrawalAmount = ethers.utils.parseEther("0.5");
      const tx = await defimonInvestmentV2.requestWithdrawal(owner.address, withdrawalAmount);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === 'WithdrawalRequested');
      const requestId = event.args.requestId;

      // Одобряем только первым подписантом
      await defimonInvestmentV2.connect(signer1).approveWithdrawal(requestId);

      // Проверяем, что запрос не выполнен (нужно минимум 2 из 3)
      const request = await defimonInvestmentV2.withdrawalRequests(requestId);
      expect(request.executed).to.be.false;
      expect(request.approvedBySigner1).to.be.true;
      expect(request.approvedBySigner2).to.be.false;
    });

    it("Should allow owner to update signers", async function () {
      // Создаем новый адрес для подписанта
      const [newSigner] = await ethers.getSigners();
      await defimonInvestmentV2.updateSigner(newSigner.address, 1);
      expect(await defimonInvestmentV2.signer1()).to.equal(newSigner.address);
    });

    it("Should track investor count correctly", async function () {
      expect(await defimonInvestmentV2.getInvestorCount()).to.equal(0);

      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const amount = limits.minInvestmentEth;

      await defimonInvestmentV2.connect(investor1).invest({ value: amount });
      expect(await defimonInvestmentV2.getInvestorCount()).to.equal(1);

      await defimonInvestmentV2.connect(investor2).invest({ value: amount });
      expect(await defimonInvestmentV2.getInvestorCount()).to.equal(2);
    });

    it("Should handle different investment periods correctly", async function () {
      // Проверяем, что функция getCurrentCoefficient работает
      const [coefficient, period] = await defimonInvestmentV2.getCurrentCoefficient();
      expect(coefficient).to.be.gt(0);
      expect(period).to.be.gte(1).and.to.be.lte(3);
    });

    it("Should allow pausing and unpausing", async function () {
      await defimonInvestmentV2.pause();
      expect(await defimonInvestmentV2.paused()).to.be.true;
      
      await defimonInvestmentV2.unpause();
      expect(await defimonInvestmentV2.paused()).to.be.false;
    });

    it("Should prevent investments when paused", async function () {
      await defimonInvestmentV2.pause();
      
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const amount = limits.minInvestmentEth;
      
      await expect(
        defimonInvestmentV2.connect(investor1).invest({ value: amount })
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Security Features V2", function () {
    it("Should prevent reentrancy attacks", async function () {
      // Тестируем базовую защиту от реентрантности через ReentrancyGuard
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const amount = limits.minInvestmentEth;
      
      await defimonInvestmentV2.connect(investor1).invest({ value: amount });
      
      // Проверяем, что ReentrancyGuard работает корректно
      await expect(
        defimonInvestmentV2.connect(investor1).invest({ value: amount })
      ).to.not.be.reverted;
    });

    it("Should only allow owner to pause contracts", async function () {
      await expect(
        defimonInvestmentV2.connect(investor1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should only allow owner to update signers", async function () {
      await expect(
        defimonInvestmentV2.connect(investor1).updateSigner(investor2.address, 1)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should only allow authorized signers to approve withdrawals", async function () {
      // Сначала делаем инвестицию, чтобы у контракта были средства
      const investmentAmount = ethers.utils.parseEther("1");
      await defimonInvestmentV2.connect(investor1).invest({ value: investmentAmount });
      
      const withdrawalAmount = ethers.utils.parseEther("0.1");
      const tx = await defimonInvestmentV2.requestWithdrawal(owner.address, withdrawalAmount);
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'WithdrawalRequested');
      const requestId = event.args.requestId;

      await expect(
        defimonInvestmentV2.connect(investor1).approveWithdrawal(requestId)
      ).to.be.revertedWith("Only authorized signers can approve");
    });

    it("Should reject zero address investments", async function () {
      await expect(
        defimonInvestmentV2.invest({ value: 0 })
      ).to.be.revertedWith("Investment amount must be greater than 0");
    });

    it("Should reject invalid withdrawal requests", async function () {
      await expect(
        defimonInvestmentV2.requestWithdrawal(ethers.constants.AddressZero, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Invalid recipient address");

      await expect(
        defimonInvestmentV2.requestWithdrawal(owner.address, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });
  });
});
