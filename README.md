# Uni DAO Token (UDT)

**Uni DAO Token (UDT)** is an ERC-20 governance token deployed on the Ethereum **Sepolia testnet**.  
It serves as the core access and voting mechanism for a university-style DAO MVP, focusing on transparency,
immutability, and on-chain governance.

---

## 📜 Smart Contracts

### UniToken (ERC-20)
- Network: **Ethereum Sepolia**
- Name: **Uni DAO Token**
- Symbol: **UDT**
- Decimals: **18**
- Initial supply: **1,000,000 UDT**
- Token contract address (Sepolia testnet):
  `0xe8267Ddc857D0DDdCb114C988AB3EFdb1F2C12AB`

### UniDAO (Governance)
- Proposal creation
- On-chain voting (1 address = 1 vote)
- Quorum support (MVP configuration)
- Proposal finalization
- Governance-based mint & burn decisions
- DAO contract address (Sepolia testnet):
  `0x43664AFEC197919fE37De5197aD224240290C523`

---

## ✨ Features

### Token (UniToken)
- ERC-20 standard (OpenZeppelin)
- Initial supply minted to deployer
- Mint & burn controlled via governance (DAO)
- Designed to be reusable beyond voting (events, access, utilities)

### DAO (UniDAO)
- Token-gated participation (UDT required)
- Proposal lifecycle:
  - create → vote → finalize
- Fully on-chain voting history
- Transparent and immutable governance logic

---

## 🧱 Tech Stack

- **Solidity**
- **Hardhat**
- **Ethers.js**
- **OpenZeppelin Contracts**
- **MetaMask**
- **Ethereum Sepolia Testnet**

---

## 🛠 Local Setup

```bash
npm install
npx hardhat compile
