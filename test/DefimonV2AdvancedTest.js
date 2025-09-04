const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DefimonV2 Advanced Features", function () {
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

    // Пополняем тестовые аккаунты ETH для крупных инвестиций
    const largeAmount = ethers.utils.parseEther("100"); // 100 ETH
    await owner.sendTransaction({ to: investor1.address, value: largeAmount });
    await owner.sendTransaction({ to: investor2.address, value: largeAmount });
    await owner.sendTransaction({ to: attacker.address, value: largeAmount });

    // Обновляем цену ETH для тестов (устанавливаем $1000 за ETH - разумное изменение)
    await defimonInvestmentV2.updateEthUsdPrice(100000); // $1000 в центах
  });

  describe("Investment Limits", function () {
    it("Should enforce minimum investment limit", async function () {
      // Получаем лимиты
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const minEth = limits.minInvestmentEth;
      
      // Пытаемся инвестировать меньше минимума
      const tooSmallAmount = minEth.div(2);
      
      await expect(
        defimonInvestmentV2.connect(investor1).invest({ value: tooSmallAmount })
      ).to.be.revertedWith("Investment amount exceeds limits");
    });

    it("Should enforce maximum investment limit", async function () {
      // Получаем лимиты
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const maxEth = limits.maxInvestmentEth;
      
      // Пытаемся инвестировать больше максимума
      const tooLargeAmount = maxEth.mul(2);
      
      await expect(
        defimonInvestmentV2.connect(investor1).invest({ value: tooLargeAmount })
      ).to.be.revertedWith("Investment amount exceeds limits");
    });

    it("Should allow investments within limits", async function () {
      // Получаем лимиты
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const minEth = limits.minInvestmentEth;
      const maxEth = limits.maxInvestmentEth;
      
      // Инвестируем минимальную сумму
      await expect(
        defimonInvestmentV2.connect(investor1).invest({ value: minEth })
      ).to.not.be.reverted;
      
      // Инвестируем максимальную сумму (но не крупную)
      const normalMaxAmount = maxEth.sub(ethers.utils.parseEther("0.01")); // Чуть меньше максимума
      await expect(
        defimonInvestmentV2.connect(investor2).invest({ value: normalMaxAmount })
      ).to.not.be.reverted;
    });

    it("Should require approval for large investments", async function () {
      // Получаем лимиты
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const largeEth = limits.maxInvestmentEth; // Это должно быть на границе крупной инвестиции
      
      // Пытаемся инвестировать крупную сумму напрямую
      await expect(
        defimonInvestmentV2.connect(investor1).invest({ value: largeEth })
      ).to.be.revertedWith("Large investment requires multisig approval. Use requestLargeInvestment()");
    });

    it("Should check investment limits correctly", async function () {
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const minEth = limits.minInvestmentEth;
      const maxEth = limits.maxInvestmentEth;
      
      // Проверяем минимальную сумму
      const [isWithinLimits1, requiresApproval1] = await defimonInvestmentV2.checkInvestmentLimits(minEth);
      expect(isWithinLimits1).to.be.true;
      expect(requiresApproval1).to.be.false;
      
      // Проверяем максимальную сумму
      const [isWithinLimits2, requiresApproval2] = await defimonInvestmentV2.checkInvestmentLimits(maxEth);
      expect(isWithinLimits2).to.be.true;
      expect(requiresApproval2).to.be.true;
      
      // Проверяем слишком маленькую сумму
      const [isWithinLimits3, requiresApproval3] = await defimonInvestmentV2.checkInvestmentLimits(minEth.div(2));
      expect(isWithinLimits3).to.be.false;
      expect(requiresApproval3).to.be.false;
    });
  });

  describe("Large Investment Requests", function () {
    it("Should create large investment request", async function () {
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const largeAmount = limits.maxInvestmentEth;
      const reason = "Large institutional investment";
      
      const tx = await defimonInvestmentV2.connect(investor1).requestLargeInvestment(reason, { value: largeAmount });
      const receipt = await tx.wait();
      
      // Проверяем событие
      const event = receipt.events.find(e => e.event === 'LargeInvestmentRequested');
      expect(event).to.not.be.undefined;
      expect(event.args.investor).to.equal(investor1.address);
      expect(event.args.ethAmount).to.equal(largeAmount);
      expect(event.args.reason).to.equal(reason);
    });

    it("Should approve large investment with 2 out of 3 signers", async function () {
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const largeAmount = limits.maxInvestmentEth;
      const reason = "Approved large investment";
      
      // Создаем запрос
      const tx = await defimonInvestmentV2.connect(investor1).requestLargeInvestment(reason, { value: largeAmount });
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'LargeInvestmentRequested');
      const requestId = event.args.requestId;
      
      // Одобряем первым подписантом
      await defimonInvestmentV2.connect(signer1).approveLargeInvestment(requestId);
      
      // Одобряем вторым подписантом (должно выполниться автоматически)
      const balanceBefore = await defimonTokenV2.balanceOf(investor1.address);
      await defimonInvestmentV2.connect(signer2).approveLargeInvestment(requestId);
      const balanceAfter = await defimonTokenV2.balanceOf(investor1.address);
      
      // Проверяем, что токены выданы
      expect(balanceAfter).to.be.gt(balanceBefore);
      
      // Проверяем, что запрос выполнен
      const request = await defimonInvestmentV2.getLargeInvestmentRequest(requestId);
      expect(request.executed).to.be.true;
    });

    it("Should not execute large investment with only 1 approval", async function () {
      // Используем сумму, которая точно требует одобрения (>$100,000)
      // При курсе $25 за ETH, нужно больше 4000 ETH
      const largeAmount = ethers.utils.parseEther("4001"); // 4001 ETH = $100,025 при курсе $25
      const reason = "Single approval test";
      
      // Создаем запрос
      const tx = await defimonInvestmentV2.connect(investor1).requestLargeInvestment(reason, { value: largeAmount });
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'LargeInvestmentRequested');
      const requestId = event.args.requestId;
      
      // Одобряем только первым подписантом
      await defimonInvestmentV2.connect(signer1).approveLargeInvestment(requestId);
      
      // Проверяем, что запрос не выполнен
      const request = await defimonInvestmentV2.getLargeInvestmentRequest(requestId);
      expect(request.executed).to.be.false;
      expect(request.approvedBySigner1).to.be.true;
      expect(request.approvedBySigner2).to.be.false;
    });

    it("Should prevent duplicate approvals", async function () {
      const largeAmount = ethers.utils.parseEther("4001"); // 4001 ETH = $100,025 при курсе $25
      const reason = "Duplicate approval test";
      
      // Создаем запрос
      const tx = await defimonInvestmentV2.connect(investor1).requestLargeInvestment(reason, { value: largeAmount });
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'LargeInvestmentRequested');
      const requestId = event.args.requestId;
      
      // Первое одобрение
      await defimonInvestmentV2.connect(signer1).approveLargeInvestment(requestId);
      
      // Попытка повторного одобрения
      await expect(
        defimonInvestmentV2.connect(signer1).approveLargeInvestment(requestId)
      ).to.be.revertedWith("Already approved by signer1");
    });

    it("Should only allow authorized signers to approve", async function () {
      const largeAmount = ethers.utils.parseEther("4001"); // 4001 ETH = $100,025 при курсе $25
      const reason = "Unauthorized approval test";
      
      // Создаем запрос
      const tx = await defimonInvestmentV2.connect(investor1).requestLargeInvestment(reason, { value: largeAmount });
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'LargeInvestmentRequested');
      const requestId = event.args.requestId;
      
      // Попытка одобрения неавторизованным пользователем
      await expect(
        defimonInvestmentV2.connect(investor2).approveLargeInvestment(requestId)
      ).to.be.revertedWith("Only authorized signers can approve");
    });
  });

  describe("Blacklist Functionality", function () {
    it("Should allow owner to blacklist addresses", async function () {
      await defimonInvestmentV2.setBlacklist(investor1.address, true);
      expect(await defimonInvestmentV2.blacklisted(investor1.address)).to.be.true;
      
      await defimonInvestmentV2.setBlacklist(investor1.address, false);
      expect(await defimonInvestmentV2.blacklisted(investor1.address)).to.be.false;
    });

    it("Should prevent blacklisted addresses from investing", async function () {
      await defimonInvestmentV2.setBlacklist(investor1.address, true);
      
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const amount = limits.minInvestmentEth;
      
      await expect(
        defimonInvestmentV2.connect(investor1).invest({ value: amount })
      ).to.be.revertedWith("Investor is blacklisted");
    });

    it("Should prevent blacklisted addresses from requesting large investments", async function () {
      await defimonInvestmentV2.setBlacklist(investor1.address, true);
      
      const largeAmount = ethers.utils.parseEther("50"); // 50 ETH = $100,000 при курсе $2000
      
      await expect(
        defimonInvestmentV2.connect(investor1).requestLargeInvestment("Test", { value: largeAmount })
      ).to.be.revertedWith("Investor is blacklisted");
    });

    it("Should not allow blacklisting owner or signers", async function () {
      await expect(
        defimonInvestmentV2.setBlacklist(owner.address, true)
      ).to.be.revertedWith("Cannot blacklist owner");
      
      await expect(
        defimonInvestmentV2.setBlacklist(signer1.address, true)
      ).to.be.revertedWith("Cannot blacklist signers");
    });

    it("Should not allow blacklisting zero address", async function () {
      await expect(
        defimonInvestmentV2.setBlacklist(ethers.constants.AddressZero, true)
      ).to.be.revertedWith("Cannot blacklist zero address");
    });
  });

  describe("Price Management", function () {
    it("Should allow owner to update ETH/USD price", async function () {
      const newPrice = 2500; // $2500 per ETH
      
      const tx = await defimonInvestmentV2.updateEthUsdPrice(newPrice);
      const receipt = await tx.wait();
      
      // Проверяем событие
      const event = receipt.events.find(e => e.event === 'EthUsdPriceUpdated');
      expect(event).to.not.be.undefined;
      expect(event.args.newPrice).to.equal(newPrice);
      
      // Проверяем, что цена обновилась
      expect(await defimonInvestmentV2.ethUsdPrice()).to.equal(newPrice);
    });

    it("Should not allow non-owner to update price", async function () {
      const newPrice = 2500;
      
      await expect(
        defimonInvestmentV2.connect(investor1).updateEthUsdPrice(newPrice)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should reject invalid prices", async function () {
      await expect(
        defimonInvestmentV2.updateEthUsdPrice(0)
      ).to.be.revertedWith("Price must be greater than 0");
      
      await expect(
        defimonInvestmentV2.updateEthUsdPrice(100001) // > $100,000
      ).to.be.revertedWith("Price seems too high");
    });

    it("Should convert ETH to USD correctly", async function () {
      const price = 2000; // $2000 per ETH in cents
      await defimonInvestmentV2.updateEthUsdPrice(price);
      
      const ethAmount = ethers.utils.parseEther("1"); // 1 ETH
      const usdAmount = await defimonInvestmentV2.ethToUsd(ethAmount);
      
      expect(usdAmount).to.equal(2000); // $2000 in cents
    });

    it("Should convert USD to ETH correctly", async function () {
      const price = 2000; // $2000 per ETH in cents
      await defimonInvestmentV2.updateEthUsdPrice(price);
      
      const usdAmount = 2000; // $2000 in cents
      const ethAmount = await defimonInvestmentV2.usdToEth(usdAmount);
      
      expect(ethAmount).to.equal(ethers.utils.parseEther("1")); // 1 ETH
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to emergency pause", async function () {
      await defimonInvestmentV2.emergencyPause();
      expect(await defimonInvestmentV2.paused()).to.be.true;
    });

    it("Should allow owner to emergency unpause", async function () {
      await defimonInvestmentV2.emergencyPause();
      await defimonInvestmentV2.emergencyUnpause();
      expect(await defimonInvestmentV2.paused()).to.be.false;
    });

    it("Should allow owner to emergency withdraw ETH", async function () {
      // Сначала инвестируем, чтобы у контракта были средства
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const amount = limits.minInvestmentEth;
      await defimonInvestmentV2.connect(investor1).invest({ value: amount });
      
      const balanceBefore = await owner.getBalance();
      await defimonInvestmentV2.emergencyWithdraw(owner.address);
      const balanceAfter = await owner.getBalance();
      
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should allow owner to emergency withdraw tokens", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      const balanceBefore = await defimonTokenV2.balanceOf(owner.address);
      await defimonInvestmentV2.emergencyWithdrawTokens(owner.address, amount);
      const balanceAfter = await defimonTokenV2.balanceOf(owner.address);
      
      expect(balanceAfter).to.equal(balanceBefore.add(amount));
    });

    it("Should not allow non-owner to use emergency functions", async function () {
      await expect(
        defimonInvestmentV2.connect(investor1).emergencyPause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      await expect(
        defimonInvestmentV2.connect(investor1).emergencyWithdraw(owner.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Request Counter", function () {
    it("Should increment request counter", async function () {
      // Сначала инвестируем, чтобы у контракта были средства
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const amount = limits.minInvestmentEth;
      await defimonInvestmentV2.connect(investor1).invest({ value: amount });
      
      const initialCounter = await defimonInvestmentV2.getRequestCounter();
      
      // Создаем запрос на вывод
      const tx = await defimonInvestmentV2.requestWithdrawal(owner.address, ethers.utils.parseEther("0.1"));
      await tx.wait();
      
      const newCounter = await defimonInvestmentV2.getRequestCounter();
      expect(newCounter).to.equal(initialCounter.add(1));
    });

    it("Should generate unique request IDs", async function () {
      // Сначала инвестируем, чтобы у контракта были средства
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      const amount = limits.minInvestmentEth;
      await defimonInvestmentV2.connect(investor1).invest({ value: amount });
      
      // Создаем два запроса подряд
      const tx1 = await defimonInvestmentV2.requestWithdrawal(owner.address, ethers.utils.parseEther("0.1"));
      const receipt1 = await tx1.wait();
      const event1 = receipt1.events.find(e => e.event === 'WithdrawalRequested');
      const requestId1 = event1.args.requestId;
      
      const tx2 = await defimonInvestmentV2.requestWithdrawal(owner.address, ethers.utils.parseEther("0.1"));
      const receipt2 = await tx2.wait();
      const event2 = receipt2.events.find(e => e.event === 'WithdrawalRequested');
      const requestId2 = event2.args.requestId;
      
      expect(requestId1).to.not.equal(requestId2);
    });
  });

  describe("Investment Limit Events", function () {
    it("Should emit InvestmentLimitExceeded event", async function () {
      const tooLargeAmount = ethers.utils.parseEther("1000"); // 1000 ETH - очень большая сумма
      
      await expect(
        defimonInvestmentV2.connect(investor1).invest({ value: tooLargeAmount })
      ).to.emit(defimonInvestmentV2, "InvestmentLimitExceeded")
        .withArgs(investor1.address, tooLargeAmount, await defimonInvestmentV2.ethToUsd(tooLargeAmount));
    });
  });
});
