require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    networks: {
        hardhat: {
            chainId: 1337
        },
        localhost: {
            url: "http://127.0.0.1:8545"
        },
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
        bscTestnet: {
            url: process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet.publicnode.com",
            chainId: 97,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY || "",
        customChains: [{
                network: "bscTestnet",
                chainId: 97,
                urls: {
                    apiURL: "https://api.etherscan.io/v2/api?chainid=97",
                    browserURL: "https://testnet.bscscan.com"
                }
            },
            {
                network: "sepolia",
                chainId: 11155111,
                urls: {
                    apiURL: "https://api.etherscan.io/v2/api?chainid=11155111",
                    browserURL: "https://sepolia.etherscan.io"
                }
            }
        ]
    },
    sourcify: {
        enabled: false
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};