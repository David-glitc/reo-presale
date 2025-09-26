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
            hardCap
        );
        await presale.waitForDeployment();

        // set presale contract
        await token.connect(deployer).setPresale(await presale.getAddress());
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
        await increaseTime(60);

        // buy 1 native: tokens = 1 / 0.5 = 2 tokens
        await presale.connect(user1).buyTokens({ value: ethers.parseEther("1") });
        const contribution1 = await presale.contributions(user1.address);
        expect(contribution1).to.equal(ethers.parseEther("1"));

        // fast-forward to round 1
        const r0 = await presale.rounds(0);
        const nowTs = await now();
        const toAdvance = (Number(r0.endTime) - nowTs) + 10;
        await increaseTime(toAdvance);

        // buy 1 native at price 0.55 => tokens ~= 1 / 0.55
        await presale.connect(user2).buyTokens({ value: ethers.parseEther("1") });
        const contribution2 = await presale.contributions(user2.address);
        expect(contribution2).to.equal(ethers.parseEther("1"));
    });

    it("enforces hard cap", async function() {
        // Wait for presale to start
        await increaseTime(60);

        // attempt large contribution > hardCap
        await expect(presale.connect(user1).buyTokens({ value: ethers.parseEther("31") }))
            .to.be.revertedWith("Exceeds hard cap");
    });

    it("claim only after TGE (3 days after presale end)", async function() {
        // Wait for presale to start
        await increaseTime(60);

        // contribute full softCap to make presale successful
        await presale.connect(user1).buyTokens({ value: softCap });

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
        // tokens = softCap / 0.5 = 10 / 0.5 = 20 tokens
        expect(bal).to.equal(ethers.parseEther("20"));
    });

    it("refunds when softcap not met (after presale end)", async function() {
        // Wait for presale to start
        await increaseTime(60);

        // small contribution
        await presale.connect(user1).buyTokens({ value: ethers.parseEther("1") });

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
        expect(await ethers.provider.getBalance(presale.address)).to.equal(0);
    });

    it("prevents double claim and double refund", async function() {
        // Wait for presale to start
        await increaseTime(60);

        // success path then claim once
        await presale.connect(user1).buyTokens({ value: softCap });
        const r2 = await presale.rounds(2);
        const nowTs = await now();
        const toEnd = Number(r2.endTime) - nowTs + 1;
        await increaseTime(toEnd);

        // Fast forward to claim time
        await increaseTime(259200); // 3 days

        await presale.connect(user1).claim();
        await expect(presale.connect(user1).claim()).to.be.revertedWith("Already claimed");

        // refund path
        await presale.connect(user2).buyTokens({ value: ethers.parseEther("1") });
        await increaseTime(Number(r2.endTime) - (await now()) + 1);
        await expect(presale.connect(user2).refund()).not.to.be.reverted;
        await expect(presale.connect(user2).refund()).to.be.revertedWith("Already claimed/refunded");
    });
});