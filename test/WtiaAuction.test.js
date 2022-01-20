const { expect } = require("chai");
const { ethers } = require("hardhat");
const { advanceTime } = require('./lib');

describe("WtiaAuction", function () {
  before(async () => {
    const users = await ethers.getSigners()
    const [seller, buyer1, buyer2, buyer3] = users
    this.seller = seller 
    this.buyer1 = buyer1
    this.buyer2 = buyer2
    this.buyer3 = buyer3
    this.totalAmount = 20
    this.reservePrice = 10000
    this.startPrice = 20000
    this.period = 10 * 24 * 3600
    
    // Deploy MockERC20Token
    const MockERC20Token = await ethers.getContractFactory("MockERC20Token")
    this.erc20Token = await MockERC20Token.deploy(
      'MockERC20Token',
      'MockERC20Token',
      [this.seller.address],
      [1000]
    )

    // Deploy WtiaAuction
    const WtiaAuction = await ethers.getContractFactory("WtiaAuction")
    this.wtiaAuction = await WtiaAuction.deploy(
      this.seller.address,
      this.reservePrice,
      this.startPrice,
      this.period
    )
  })

  it("depoyment fails: invalid seller address", async () => {
    const WtiaAuction = await ethers.getContractFactory("WtiaAuction")
    await expect(WtiaAuction.deploy(
      ethers.constants.AddressZero,  // zero address for seller
      this.reservePrice,
      this.startPrice,
      this.period
    )).to.revertedWith("POT: invalid seller address")
  })

  it("depoyment fails: zero reserve price", async () => {
    const WtiaAuction = await ethers.getContractFactory("WtiaAuction")
    await expect(WtiaAuction.deploy(
      this.seller.address,
      0,                 // reservePrice,
      this.startPrice,
      this.period
    )).to.revertedWith("POT: invalid reserve price")
  })

  it("depoyment fails: start price shoud be bigger than the reserve price", async () => {
    const WtiaAuction = await ethers.getContractFactory("WtiaAuction")
    await expect(WtiaAuction.deploy(
      this.seller.address,
      this.reservePrice,
      100,              // startPrice,
      this.period
    )).to.revertedWith("POT: invalid start price")
  })

  it("depoyment fails: zero auction period", async () => {
    const WtiaAuction = await ethers.getContractFactory("WtiaAuction")
    await expect(WtiaAuction.deploy(
      this.seller.address,
      this.reservePrice,
      this.startPrice,
      0                 // period
    )).to.revertedWith("invalid period")
  })

  it("openAuction fails: only seller can open auction", async () => {
    await expect(this.wtiaAuction.connect(this.buyer1).openAuction(this.erc20Token.address, this.totalAmount))
      .to.revertedWith("POT: only seller can open auction")
  })

  it("openAuction fails: invalid token address", async () => {
    await expect(this.wtiaAuction.connect(this.seller).openAuction(ethers.constants.AddressZero, this.totalAmount))
      .to.revertedWith("POT: invalid token address")
  })

  it("openAuction fails: invalid amount of assets", async () => {
    await expect(this.wtiaAuction.connect(this.seller).openAuction(this.erc20Token.address, 0))
      .to.revertedWith("POT: invalid amount of assets")
  })

  it("openAuction fails: not enough balance", async () => {
    await expect(this.wtiaAuction.connect(this.seller).openAuction(this.erc20Token.address, 2000))
      .to.revertedWith("POT: not enough balance")
  })

  it("openAuction succeeds", async () => {
    await this.erc20Token.connect(this.seller).approve(this.wtiaAuction.address, 1000)
    await expect(this.wtiaAuction.connect(this.seller).openAuction(this.erc20Token.address, this.totalAmount))
      .emit(this.wtiaAuction, "AcutionOpened")
      .withArgs(this.erc20Token.address, this.totalAmount)
  })

  it("closeAuction: only seller can close auction", async () => {
    await expect(this.wtiaAuction.connect(this.buyer1).closeAuction())
      .to.revertedWith("POT: only seller can close auction")
  })
  
  it("makeBid fails: invalid payment", async () => {
    const bidAmount = 10
    const currentPrice = this.wtiaAuction.getCurrentPrice()
    await expect(this.wtiaAuction.connect(this.buyer1).makeBid(bidAmount, {value: 9 * currentPrice}))
    .to.revertedWith("POT: invalid payment for the bid")
  })

  it("makeBid succeeds", async () => {
    const bidAmount = 10
    const currentPrice = await this.wtiaAuction.getCurrentPrice()
    await expect(this.wtiaAuction.connect(this.buyer1).makeBid(bidAmount, {value: bidAmount * currentPrice}))
      .emit(this.wtiaAuction, "BidPlaced")
      .withArgs(this.buyer1.address, currentPrice, bidAmount * currentPrice)
  })

  it("makeBid succeeds", async () => {
    const bidAmount = 7
    const currentPrice = await this.wtiaAuction.getCurrentPrice()
    await expect(this.wtiaAuction.connect(this.buyer2).makeBid(bidAmount, {value: bidAmount * currentPrice}))
      .emit(this.wtiaAuction, "BidPlaced")
      .withArgs(this.buyer2.address, currentPrice, bidAmount * currentPrice)
  })
  
  it("makeBid succeeds", async () => {
    const bidAmount = 11
    const currentPrice = await this.wtiaAuction.getCurrentPrice()
    await expect(this.wtiaAuction.connect(this.buyer3).makeBid(bidAmount, {value: bidAmount * currentPrice}))
    .emit(this.wtiaAuction, "AuctionClosed")
    .withArgs("POT: all tokens are sold out.")
    .emit(this.wtiaAuction, "BidPlaced")
    .withArgs(this.buyer3.address, currentPrice, bidAmount * currentPrice)
  })

  it("makeBid fails: auction is closed by seller", async () => {
    const currentPrice = await this.wtiaAuction.getCurrentPrice()
    await expect(this.wtiaAuction.connect(this.buyer1).makeBid(10, {value: 10 * currentPrice}))
      .to.revertedWith("POT: auction is closed.")
  })

  it("makeBid fails: auction is expired", async () => {
    await advanceTime(11 * 24 * 3600); // pass 11 days
    const currentPrice = await this.wtiaAuction.getCurrentPrice()
    await expect(this.wtiaAuction.connect(this.buyer1).makeBid(10, {value: 10 * currentPrice}))
      .to.revertedWith("POT: auction is closed.")
  })
})
