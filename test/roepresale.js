const { expect } = require("chai");
const { ethers } = require("hardhat");
const { now, increaseTime } = require("./helpers/time-helpers");

describe("ROEPresale (3 rounds, TGE delay 3 days)", function() {
    let Token, Presale, token, presale, deployer, admin, user1, user2;
    const softCap = ethers.parseEther("10");
    const hardCap = ethers.parseEther("30");

    beforeEach(async function() {
        [deployer, admin, user1, user2] = await ethers.getSigners();
        Token = await ethers.getContractFactory("ROEToken");
        token = await Token.deploy();
        await token.waitForDeployment();

        Presale = await ethers.getContractFactory("ROEPresale");
        const startTime = Math.floor(Date.now() / 1000) + 60; // Start in 1 minute
        presale = await Presale.deploy(
            await token.getAddress(),
            startTime,
            softCap,
            hardCap,
            ethers.parseEther("0.01"), // minContribution
            ethers.parseEther("5"), // maxContribution
            ethers.parseEther("100000000") // presaleAllocation (100M tokens)
        );
        await presale.waitForDeployment();

        // set presale contract
        await token.connect(deployer).setPresale(await presale.getAddress());

        // Transfer presale allocation to presale contract
        const presaleAllocation = ethers.parseEther("100000000"); // 100M tokens
        await token.connect(deployer).transfer(await presale.getAddress(), presaleAllocation);
    });

    it("round pricing progression: 0.5 -> 0.55 -> 0.605", async function() {
        // round 0 price should be 0.5 ether
        const r0 = await presale.rounds(0);
        expect(r0.price).to.equal(ethers.parseEther("0.5"));

        // round 1 price should be 10% higher (0.55)
        const r1 = await presale.rounds(1);
        expect(r1.price).to.equal(ethers.parseEther("0.55"));

        // round 2 price should be 10% higher than round 1 (0.605)
        const r2 = await presale.rounds(2);
        expect(r2.price).to.equal(ethers.parseEther("0.605"));
    });

    it("buy succeeds in each round and calculates tokens correctly", async function() {
        // Wait for presale to start
        await increaseTime(61);

        // buy 1 native: tokens = 1 / 0.5 = 2 tokens
        await presale.connect(user1).buyTokens({ value: ethers.parseEther("0.5") });
        const contribution1 = await presale.contributions(user1.address);
        expect(contribution1).to.equal(ethers.parseEther("0.5"));

        // fast-forward to round 1
        const r0 = await presale.rounds(0);
        const nowTs = await now();
        const toAdvance = (Number(r0.endTime) - nowTs) + 10;
        await increaseTime(toAdvance);

        // buy 1 native at price 0.55 => tokens ~= 1 / 0.55
        await presale.connect(user2).buyTokens({ value: ethers.parseEther("0.5") });
        const contribution2 = await presale.contributions(user2.address);
        expect(contribution2).to.equal(ethers.parseEther("0.5"));
    });

    it("enforces hard cap", async function() {
        // Wait for presale to start
        await increaseTime(61);

        // attempt large contribution > hardCap
        await expect(presale.connect(user1).buyTokens({ value: ethers.parseEther("6") }))
            .to.be.revertedWith("Exceeds max contribution");
    });

    it("claim only after TGE (3 days after presale end)", async function() {
        // Wait for presale to start
        await increaseTime(61);

        // contribute enough to meet soft cap (need 10 ETH total)
        await presale.connect(user1).buyTokens({ value: ethers.parseEther("5") });
        await presale.connect(user2).buyTokens({ value: ethers.parseEther("5") });

        // advance to end of presale (round 2 end)
        const r2 = await presale.rounds(2);
        const nowTs = await now();
        const toEnd = Number(r2.endTime) - nowTs + 1;
        await increaseTime(toEnd);

        // Check if presale was successful
        const totalRaised = await presale.totalRaised();
        expect(totalRaised).to.equal(softCap);

        // Try to claim before claim time - should fail
        await expect(presale.connect(user1).claim()).to.be.revertedWith("Claim not started");

        // fast-forward to claim release (3 days after presale end)
        await increaseTime(259200); // 3 days in seconds

        // claim tokens
        await presale.connect(user1).claim();
        const bal = await token.balanceOf(user1.address);
        // tokens = 5 ETH / 0.5 ETH per token = 10 tokens
        expect(bal).to.equal(ethers.parseEther("10"));
    });

    it("refunds when softcap not met (after presale end)", async function() {
        // Wait for presale to start
        await increaseTime(61);

        // small contribution
        await presale.connect(user1).buyTokens({ value: ethers.parseEther("0.5") });

        // advance to end
        const r2 = await presale.rounds(2);
        const nowTs = await now();
        const toEnd = Number(r2.endTime) - nowTs + 1;
        await increaseTime(toEnd);

        // Check presale failed
        const totalRaised = await presale.totalRaised();
        expect(totalRaised).to.be.lt(softCap);

        const beforeBal = await ethers.provider.getBalance(user1.address);
        // refund
        const tx = await presale.connect(user1).refund();
        await tx.wait();
        // contract balance should be zero
        expect(await ethers.provider.getBalance(await presale.getAddress())).to.equal(0);
    });

    it("prevents double claim and double refund", async function() {
        // Wait for presale to start
        await increaseTime(61);

        // success path then claim once
        await presale.connect(user1).buyTokens({ value: ethers.parseEther("5") });
        const r2 = await presale.rounds(2);
        const nowTs = await now();
        const toEnd = Number(r2.endTime) - nowTs + 1;
        await increaseTime(toEnd);

        // Fast forward to claim time
        await increaseTime(259200); // 3 days

        await presale.connect(user1).claim();
        await expect(presale.connect(user1).claim()).to.be.revertedWith("Already claimed");

        // refund path
        await presale.connect(user2).buyTokens({ value: ethers.parseEther("0.5") });
        await increaseTime(Number(r2.endTime) - (await now()) + 1);
        await expect(presale.connect(user2).refund()).not.to.be.reverted;
        await expect(presale.connect(user2).refund()).to.be.revertedWith("Already claimed/refunded");
    });
});