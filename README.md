# ROE Presale

A high-performance 3-round presale smart contract for ROE token with optimized gas usage.

## Features

- **3-Round Presale**: Progressive pricing (0.5 → 0.55 → 0.605 ETH)
- **Gas Optimized**: Efficient storage and batch operations
- **Security**: ReentrancyGuard, Pausable, and Ownable patterns
- **Flexible**: Soft cap/hard cap with refund mechanism

## Quick Start

```bash
# Install dependencies
pnpm install

# Compile contracts
npm run compile

# Run tests
npm run test

# Start local blockchain
npm run node

# Deploy contracts
npm run deploy
```

## Contract Overview

- **ROEToken**: ERC20 token with mintable functionality
- **ROEPresale**: 3-round presale contract with claim/refund logic

## Networks

- Hardhat (local development)
- Localhost
- Sepolia (testnet)

## License

MIT
