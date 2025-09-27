const hre = require("hardhat");

async function main() {
    console.log("=== Contract Verification Script ===\n");

    // Deployed contract addresses from Sepolia (Updated with Solidity 0.8.24)
    const ROEToken_ADDRESS = "0xe03d177185B9986abDe5710FdE2a33575c3Cf29a";
    const ROEPresale_ADDRESS = "0xf22751fB1FAC7e7b06824Cb7CBC85E03991DAAF1";

    console.log("Verifying contracts on Sepolia testnet...\n");

    try {
        // Verify ROEToken (no constructor arguments)
        console.log("1. Verifying ROEToken...");
        await hre.run("verify:verify", {
            address: ROEToken_ADDRESS,
            network: "sepolia"
        });
        console.log(`✅ ROEToken verified: https://sepolia.etherscan.io/address/${ROEToken_ADDRESS}#code\n`);

        // Verify ROEPresale (with constructor arguments)
        console.log("2. Verifying ROEPresale...");
        await hre.run("verify:verify", {
            address: ROEPresale_ADDRESS,
            constructorArguments: [
                ROEToken_ADDRESS, // token address
                1735731600, // startTime (timestamp)
                "100000000000000000000", // softCap (100 ETH)
                "1000000000000000000000", // hardCap (1000 ETH)
                "10000000000000000", // minContribution (0.01 ETH)
                "10000000000000000000", // maxContribution (10 ETH)
                "100000000000000000000000000" // presaleAllocation (100M tokens)
            ],
            network: "sepolia"
        });
        console.log(`✅ ROEPresale verified: https://sepolia.etherscan.io/address/${ROEPresale_ADDRESS}#code\n`);

        console.log("🎉 All contracts successfully verified!");
        console.log("\n=== Contract Information ===");
        console.log(`ROEToken: ${ROEToken_ADDRESS}`);
        console.log(`ROEPresale: ${ROEPresale_ADDRESS}`);
        console.log(`Network: Sepolia Testnet`);
        console.log(`Explorer: https://sepolia.etherscan.io/`);

    } catch (error) {
        console.error("❌ Verification failed:", error.message);

        if (error.message.includes("Already Verified")) {
            console.log("✅ Contracts are already verified!");
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});