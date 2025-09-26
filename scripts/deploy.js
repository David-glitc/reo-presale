const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const ROEToken = await hre.ethers.getContractFactory("roetoken");
    const token = await ROEToken.deploy();
    await token.deployed();
    console.log("ROEToken deployed to:", token.address);

    const ROEPresale = await hre.ethers.getContractFactory("roepresale");
    const now = Math.floor(Date.now() / 1000) + 60; // start in 1 min
    const presale = await ROEPresale.deploy(
        token.address,
        hre.ethers.utils.parseEther("0.5"), // initial price
        now,
        hre.ethers.utils.parseEther("100"), // softCap
        hre.ethers.utils.parseEther("1000") // hardCap
    );
    await presale.deployed();
    console.log("ROEPresale deployed to:", presale.address);

    // Link token to presale
    await token.setPresale(presale.address);
    console.log("Presale set as minter");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});