const hre = require("hardhat");

async function main() {
    console.log("=== Contract Verification Script ===\n");

    // Get network name
    const networkName = hre.network.name;

    // Contract addresses based on network
    let ROEToken_ADDRESS, ROEPresale_ADDRESS, explorerUrl;

    if (networkName === "bscTestnet") {
        ROEToken_ADDRESS = "0xe03d177185B9986abDe5710FdE2a33575c3Cf29a";
        ROEPresale_ADDRESS = "0xf22751fB1FAC7e7b06824Cb7CBC85E03991DAAF1";
        explorerUrl = "https://testnet.bscscan.com";
        console.log("Verifying contracts on BSC Testnet...\n");
    } else if (networkName === "sepolia") {
        ROEToken_ADDRESS = "0xe03d177185B9986abDe5710FdE2a33575c3Cf29a";
        ROEPresale_ADDRESS = "0xf22751fB1FAC7e7b06824Cb7CBC85E03991DAAF1";
        explorerUrl = "https://sepolia.etherscan.io";
        console.log("Verifying contracts on Sepolia testnet...\n");
    } else {
        console.error(`❌ Unsupported network: ${networkName}`);
        return;
    }

    try {

        console.log("1. Verifying ROEToken...");
        await hre.run("verify:verify", {
            address: ROEToken_ADDRESS
        });
        console.log(`✅ ROEToken verified: ${explorerUrl}/address/${ROEToken_ADDRESS}#code\n`);

        console.log("2. Verifying ROEPresale...");
        await hre.run("verify:verify", {
            address: ROEPresale_ADDRESS,
            constructorArguments: [
                ROEToken_ADDRESS,
                1735731600,
                "100000000000000000000",
                "1000000000000000000000",
                "10000000000000000",
                "10000000000000000000",
                "100000000000000000000000000"
            ]
        });
        console.log(`✅ ROEPresale verified: ${explorerUrl}/address/${ROEPresale_ADDRESS}#code\n`);

        console.log("🎉 All contracts successfully verified!");
        console.log("\n=== Contract Information ===");
        console.log(`ROEToken: ${ROEToken_ADDRESS}`);
        console.log(`ROEPresale: ${ROEPresale_ADDRESS}`);
        console.log(`Network: ${networkName === "bscTestnet" ? "BSC Testnet" : "Sepolia Testnet"}`);
        console.log(`Explorer: ${explorerUrl}/`);

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