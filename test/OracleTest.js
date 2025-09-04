const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Oracle and Price Management Tests", function () {
  let defimonInvestmentV2;
  let owner, signer1, signer2, signer3;

  beforeEach(async function () {
    [owner, signer1, signer2, signer3] = await ethers.getSigners();

    // Деплоим контракты
    const DefimonTokenV2 = await ethers.getContractFactory("DefimonTokenV2");
    const defimonTokenV2 = await DefimonTokenV2.deploy();

    const DefimonInvestmentV2 = await ethers.getContractFactory("DefimonInvestmentV2");
    defimonInvestmentV2 = await DefimonInvestmentV2.deploy(
      defimonTokenV2.address,
      signer1.address,
      signer2.address,
      signer3.address
    );

    // Переводим токены на контракт инвестиций
    const totalSupply = await defimonTokenV2.totalSupply();
    const tokensForSale = totalSupply.div(2);
    await defimonTokenV2.transferTokens(defimonInvestmentV2.address, tokensForSale);
  });

  describe("Price Management", function () {
    it("Should initialize with default price", async function () {
      const priceInfo = await defimonInvestmentV2.getPriceInfo();
      expect(priceInfo.currentPrice).to.equal(2000); // 2000 центов = $20
      expect(priceInfo.updateCount).to.equal(0);
    });

    it("Should update price successfully", async function () {
      const newPrice = 2500; // $25
      
      const tx = await defimonInvestmentV2.updateEthUsdPrice(newPrice);
      await tx.wait();
      
      const priceInfo = await defimonInvestmentV2.getPriceInfo();
      expect(priceInfo.currentPrice).to.equal(newPrice);
      expect(priceInfo.updateCount).to.equal(1);
      expect(priceInfo.isValid).to.be.true;
    });

    it("Should prevent price updates that are too high", async function () {
      const tooHighPrice = 100001; // Больше максимального лимита
      
      await expect(
        defimonInvestmentV2.updateEthUsdPrice(tooHighPrice)
      ).to.be.revertedWith("Price seems too high");
    });

    it("Should prevent price updates that are too low", async function () {
      const tooLowPrice = 0;
      
      await expect(
        defimonInvestmentV2.updateEthUsdPrice(tooLowPrice)
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("Should prevent large price changes", async function () {
      // Сначала устанавливаем цену $20
      await defimonInvestmentV2.updateEthUsdPrice(2000);
      
      // Пытаемся установить цену $50 (изменение на 150%)
      const largeChangePrice = 5000;
      
      await expect(
        defimonInvestmentV2.updateEthUsdPrice(largeChangePrice)
      ).to.be.revertedWith("Price change exceeds maximum allowed percentage");
    });

    it("Should allow reasonable price changes", async function () {
      // Сначала устанавливаем цену $20
      await defimonInvestmentV2.updateEthUsdPrice(2000);
      
      // Устанавливаем цену $25 (изменение на 25%)
      const reasonablePrice = 2500;
      
      const tx = await defimonInvestmentV2.updateEthUsdPrice(reasonablePrice);
      await tx.wait();
      
      const priceInfo = await defimonInvestmentV2.getPriceInfo();
      expect(priceInfo.currentPrice).to.equal(reasonablePrice);
    });
  });

  describe("Price Validity", function () {
    it("Should return valid price initially", async function () {
      const [isValid, timeSinceUpdate] = await defimonInvestmentV2.isPriceValid();
      expect(isValid).to.be.true;
      expect(timeSinceUpdate).to.be.greaterThan(0);
    });

    it("Should track price update time", async function () {
      const beforeUpdate = await defimonInvestmentV2.getPriceInfo();
      
      // Обновляем цену
      await defimonInvestmentV2.updateEthUsdPrice(2500);
      
      const afterUpdate = await defimonInvestmentV2.getPriceInfo();
      expect(afterUpdate.lastUpdateTime).to.be.greaterThan(beforeUpdate.lastUpdateTime);
    });
  });

  describe("Investment Limits with Price Updates", function () {
    it("Should recalculate limits after price update", async function () {
      // Устанавливаем цену $25 за ETH (разумное изменение с $20)
      await defimonInvestmentV2.updateEthUsdPrice(2500); // 2500 центов
      
      const limits = await defimonInvestmentV2.getInvestmentLimits();
      
      // При цене $25 за ETH:
      // Минимум $20 = 0.8 ETH
      // Максимум $1,000,000 = 40000 ETH
      expect(limits.minInvestmentEth).to.equal(ethers.utils.parseEther("0.8"));
      expect(limits.maxInvestmentEth).to.equal(ethers.utils.parseEther("40000"));
    });

    it("Should handle large investment threshold correctly", async function () {
      // Устанавливаем цену $25 за ETH (разумное изменение)
      await defimonInvestmentV2.updateEthUsdPrice(2500);
      
      // 4001 ETH = $100,025, что больше $100,000
      const largeAmount = ethers.utils.parseEther("4001");
      const [isWithinLimits, requiresApproval] = await defimonInvestmentV2.checkInvestmentLimits(largeAmount);
      
      expect(isWithinLimits).to.be.true;
      expect(requiresApproval).to.be.true;
    });
  });

  describe("Events", function () {
    it("Should emit EthUsdPriceUpdated event", async function () {
      const newPrice = 2500;
      
      const tx = await defimonInvestmentV2.updateEthUsdPrice(newPrice);
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'EthUsdPriceUpdated');
      
      expect(event).to.not.be.undefined;
      expect(event.args.oldPrice).to.equal(2000);
      expect(event.args.newPrice).to.equal(newPrice);
      expect(event.args.updateCount).to.equal(1);
    });

    it("Should emit PriceUpdateFailed event for large changes", async function () {
      // Сначала устанавливаем цену $20
      await defimonInvestmentV2.updateEthUsdPrice(2000);
      
      // Пытаемся установить цену $50 (изменение на 150%)
      await expect(defimonInvestmentV2.updateEthUsdPrice(5000))
        .to.be.revertedWith("Price change exceeds maximum allowed percentage");
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to update price", async function () {
      await expect(
        defimonInvestmentV2.connect(signer1).updateEthUsdPrice(2500)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
