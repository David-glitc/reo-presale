const { expect } = require("chai");

describe("ROEToken", function() {
    it("Should return the right name and symbol", async function() {
        const ROEToken = await ethers.getContractFactory("ROEToken");
        const roeToken = await ROEToken.deploy();
        await roeToken.waitForDeployment();

        expect(await roeToken.name()).to.equal("ROE Token");
        expect(await roeToken.symbol()).to.equal("ROE");
    });

    it("Should have 1B initial supply", async function() {
        const [owner] = await ethers.getSigners();
        const ROEToken = await ethers.getContractFactory("ROEToken");
        const roeToken = await ROEToken.deploy();
        await roeToken.waitForDeployment();

        const ownerBalance = await roeToken.balanceOf(owner.address);
        expect(ownerBalance).to.equal(ethers.parseEther("1000000000"));
    });
});

describe("ROEPresale Basic Tests", function() {
    let Token, Presale, token, presale, deployer, user1;

    beforeEach(async function() {
        [deployer, user1] = await ethers.getSigners();

        // Deploy token
        Token = await ethers.getContractFactory("ROEToken");
        token = await Token.deploy();
        await token.waitForDeployment();

        // Deploy presale
        Presale = await ethers.getContractFactory("ROEPresale");
        const startTime = Math.floor(Date.now() / 1000) + 60; // Start in 1 minute
        presale = await Presale.deploy(
            await token.getAddress(),
            startTime,
            ethers.parseEther("10"), // softCap
            ethers.parseEther("100"), // hardCap (increased to allow higher max contribution)
            ethers.parseEther("0.01"), // minContribution
            ethers.parseEther("5"), // maxContribution
            ethers.parseEther("100000000") // presaleAllocation (100M tokens)
        );
        await presale.waitForDeployment();

        // Link token to presale
        await token.connect(deployer).setPresale(await presale.getAddress());

        // Transfer presale allocation to presale contract
        const presaleAllocation = ethers.parseEther("100000000"); // 100M tokens
        await token.connect(deployer).transfer(await presale.getAddress(), presaleAllocation);
    });

    it("Should deploy with correct parameters", async function() {
        expect(await presale.softCap()).to.equal(ethers.parseEther("10"));
        expect(await presale.hardCap()).to.equal(ethers.parseEther("100"));
        expect(await presale.minContribution()).to.equal(ethers.parseEther("0.01"));
        expect(await presale.maxContribution()).to.equal(ethers.parseEther("5"));
    });

    it("Should have correct round pricing", async function() {
        const r0 = await presale.rounds(0);
        const r1 = await presale.rounds(1);
        const r2 = await presale.rounds(2);

        expect(r0.price).to.equal(ethers.parseEther("0.5"));
        expect(r1.price).to.equal(ethers.parseEther("0.55"));
        expect(r2.price).to.equal(ethers.parseEther("0.605"));
    });

    it("Should enforce minimum contribution", async function() {
        await expect(presale.connect(user1).buyTokens({ value: ethers.parseEther("0.005") }))
            .to.be.revertedWith("Below min contribution");
    });

    it("Should enforce maximum contribution", async function() {
        await expect(presale.connect(user1).buyTokens({ value: ethers.parseEther("6") }))
            .to.be.revertedWith("Exceeds max contribution");
    });
});