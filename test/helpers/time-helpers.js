const { ethers } = require("hardhat");

async function now() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
}

async function increaseTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
}

module.exports = {
    now,
    increaseTime,
};