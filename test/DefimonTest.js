const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DefimonToken and DefimonInvestment", function () {
  let defimonToken;
  let defimonInvestment;
  let owner;
  let signer1;
  let signer2;
  let investor1;
  let investor2;

  beforeEach(async function () {
    [owner, signer1, signer2, investor1, investor2, signer3] = await ethers.getSigners();

    // Деплой токена
    const DefimonToken = await ethers.getContractFactory("DefimonToken");
    defimonToken = await DefimonToken.deploy();
    await defimonToken.deployed();

    // Деплой контракта инвестиций
    const DefimonInvestment = await ethers.getContractFactory("DefimonInvestment");
    defimonInvestment = await DefimonInvestment.deploy(
      defimonToken.address,
      signer1.address,
      signer2.address,
      signer3.address // используем отдельный адрес для третьего подписанта
    );
    await defimonInvestment.deployed();

    // Переводим 50% токенов на контракт инвестиций
    const totalSupply = await defimonToken.totalSupply();
    const tokensForSale = totalSupply.div(2);
    await defimonToken.transferTokens(defimonInvestment.address, tokensForSale);
  });

  describe("DefimonToken", function () {
    it("Should have correct name and symbol", async function () {
      expect(await defimonToken.name()).to.equal("DEFIMON");
      expect(await defimonToken.symbol()).to.equal("DEFI");
    });

    it("Should have correct total supply", async function () {
      const totalSupply = await defimonToken.totalSupply();
      expect(totalSupply).to.equal(ethers.utils.parseEther("10000000000")); // 10 billion
    });

    it("Should allow owner to transfer tokens", async function () {
      const amount = ethers.utils.parseEther("1000");
      await defimonToken.transferTokens(investor1.address, amount);
      expect(await defimonToken.balanceOf(investor1.address)).to.equal(amount);
    });
  });

  describe("DefimonInvestment", function () {
    it("Should have correct exchange rate", async function () {
      expect(await defimonInvestment.BASE_EXCHANGE_RATE()).to.equal(100);
    });

    it("Should allow investment and issue tokens", async function () {
      const investmentAmount = ethers.utils.parseEther("1"); // 1 ETH
      
      // Получаем текущий коэффициент для расчета ожидаемых токенов
      const [coefficient, period] = await defimonInvestment.getCurrentCoefficient();
      const expectedTokens = investmentAmount.mul(coefficient).mul(100); // BASE_EXCHANGE_RATE * coefficient

      await defimonInvestment.connect(investor1).invest({ value: investmentAmount });

      expect(await defimonToken.balanceOf(investor1.address)).to.equal(expectedTokens);
      
      const investorInfo = await defimonInvestment.getInvestorInfo(investor1.address);
      expect(investorInfo.totalInvested).to.equal(investmentAmount);
      expect(investorInfo.totalTokens).to.equal(expectedTokens);
      expect(investorInfo.exists).to.be.true;
    });

    it("Should track multiple investments from same investor", async function () {
      const investment1 = ethers.utils.parseEther("0.5");
      const investment2 = ethers.utils.parseEther("1.5");

      await defimonInvestment.connect(investor1).invest({ value: investment1 });
      await defimonInvestment.connect(investor1).invest({ value: investment2 });

      const totalInvested = investment1.add(investment2);
      
      // Получаем текущий коэффициент для расчета ожидаемых токенов
      const [coefficient, period] = await defimonInvestment.getCurrentCoefficient();
      const totalTokens = totalInvested.mul(coefficient).mul(100); // BASE_EXCHANGE_RATE * coefficient

      const investorInfo = await defimonInvestment.getInvestorInfo(investor1.address);
      expect(investorInfo.totalInvested).to.equal(totalInvested);
      expect(investorInfo.totalTokens).to.equal(totalTokens);
    });

    it("Should allow withdrawal with multisig approval", async function () {
      // Инвестируем 1 ETH
      const investmentAmount = ethers.utils.parseEther("1");
      await defimonInvestment.connect(investor1).invest({ value: investmentAmount });

      // Создаем запрос на вывод
      const withdrawalAmount = ethers.utils.parseEther("0.5");
      const tx = await defimonInvestment.requestWithdrawal(owner.address, withdrawalAmount);
      const receipt = await tx.wait();
      
      // Находим requestId из события
      const event = receipt.events.find(e => e.event === 'WithdrawalRequested');
      const requestId = event.args.requestId;

      // Одобряем первым подписантом
      await defimonInvestment.connect(signer1).approveWithdrawal(requestId);
      
      // Одобряем вторым подписантом (должен автоматически выполниться при 2 из 3)
      const ownerBalanceBefore = await owner.getBalance();
      await defimonInvestment.connect(signer2).approveWithdrawal(requestId);
      const ownerBalanceAfter = await owner.getBalance();

      // Проверяем, что средства переведены
      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(withdrawalAmount);
    });

    it("Should not allow withdrawal without at least 2 approvals", async function () {
      const investmentAmount = ethers.utils.parseEther("1");
      await defimonInvestment.connect(investor1).invest({ value: investmentAmount });

      const withdrawalAmount = ethers.utils.parseEther("0.5");
      const tx = await defimonInvestment.requestWithdrawal(owner.address, withdrawalAmount);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === 'WithdrawalRequested');
      const requestId = event.args.requestId;

      // Одобряем только первым подписантом
      await defimonInvestment.connect(signer1).approveWithdrawal(requestId);

      // Проверяем, что запрос не выполнен
      const request = await defimonInvestment.withdrawalRequests(requestId);
      expect(request.executed).to.be.false;
    });

    it("Should allow owner to update signers", async function () {
      // Создаем новый адрес для подписанта
      const [newSigner] = await ethers.getSigners();
      await defimonInvestment.updateSigner(newSigner.address, 1);
      expect(await defimonInvestment.signer1()).to.equal(newSigner.address);
    });

    it("Should track investor count correctly", async function () {
      expect(await defimonInvestment.getInvestorCount()).to.equal(0);

      await defimonInvestment.connect(investor1).invest({ value: ethers.utils.parseEther("1") });
      expect(await defimonInvestment.getInvestorCount()).to.equal(1);

      await defimonInvestment.connect(investor2).invest({ value: ethers.utils.parseEther("1") });
      expect(await defimonInvestment.getInvestorCount()).to.equal(2);
    });
  });
});
