const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const ROEToken = await hre.ethers.getContractFactory("ROEToken");
    const token = await ROEToken.deploy();
    await token.waitForDeployment();
    console.log("ROEToken deployed to:", await token.getAddress());

    const ROEPresale = await hre.ethers.getContractFactory("ROEPresale");
    const now = Math.floor(Date.now() / 1000) + 60;

    // Standardized values for better clarity
    const SOFT_CAP = hre.ethers.parseEther("100");
    const HARD_CAP = hre.ethers.parseEther("1000");
    const MIN_CONTRIBUTION = hre.ethers.parseEther("0.01");
    const MAX_CONTRIBUTION = hre.ethers.parseEther("10");
    const PRESALE_ALLOCATION = hre.ethers.parseEther("100000000");

    const presale = await ROEPresale.deploy(
        await token.getAddress(),
        now,
        SOFT_CAP,
        HARD_CAP,
        MIN_CONTRIBUTION,
        MAX_CONTRIBUTION,
        PRESALE_ALLOCATION
    );
    await presale.waitForDeployment();
    console.log("ROEPresale deployed to:", await presale.getAddress());

    // Link token to presale
    await token.setPresale(await presale.getAddress());
    console.log("Presale set as minter");

    // Transfer presale allocation to presale contract
    await token.transfer(await presale.getAddress(), PRESALE_ALLOCATION);
    console.log("Transferred presale allocation to presale contract");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});