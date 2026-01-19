# Uni DAO Token (UDT)

ERC-20 governance token deployed to Ethereum Sepolia testnet as a foundation for a university-style DAO voting MVP.

## Contract
- Network: **Sepolia**
- Token name: **Uni DAO Token**
- Symbol: **UDT**
- Decimals: **18**
- Contract address: `0xE6fACBd14AF53EF9AC59C03aB49b08Fd0E0547Db`

## Features
- ERC-20 token (OpenZeppelin)
- Initial supply minted to deployer: **1,000,000 UDT**
- Owner-controlled minting (`mint(to, amount)`) via `Ownable`

## Tech stack
- Solidity
- Hardhat
- Ethers.js
- OpenZeppelin Contracts
- MetaMask + Sepolia

## Local setup
```bash
npm install
npx hardhat compile
