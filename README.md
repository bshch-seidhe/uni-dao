# Uni DAO Token (UDT)

**Uni DAO Token (UDT)** is an ERC-20 governance token deployed on the Ethereum **Sepolia testnet**.  
It serves as the core access and voting mechanism for a university-style DAO MVP, focusing on transparency,
immutability, and on-chain governance.

---

## Smart Contracts

### UniToken (ERC-20)
- Network: **Ethereum Sepolia**
- Name: **Uni DAO Token**
- Symbol: **UDT**
- Decimals: **18**
- Initial supply: **1,000,000 UDT**
- Whitelist-transferable (only whitelisted addresses can send/receive)
- Token contract address (Sepolia testnet):
  `0x9FBc08ba8C4f5b2E032a183509C4448e5CbCcE00`

### UniDAO (Governance + Registrar)
- Proposal creation (custom title + description)
- On-chain voting (1 address = 1 vote, whitelisted students only)
- Vote fee in UDT (sent to treasury)
- Quorum support (MVP configuration)
- Proposal finalization
- Governance updates: quorum, treasury, vote fee, registrar
- Registrar role for admin actions (add/remove students, mint/burn)
- DAO contract address (Sepolia testnet):
  `0x93DAD2d2f3De1785F1894029289F99bb9ad539B4`

---

## Governance Model (MVP)

- **Students vote on community proposals** (e.g. elections, events).
- **Registrar handles admin tasks** without student voting:
  - add/remove students
  - mint/burn tokens
- **DAO can replace the registrar** via proposal.

This keeps the system decentralized while avoiding admin work for every student.

---

## Tech Stack

- **Solidity**
- **Hardhat**
- **Ethers.js**
- **OpenZeppelin Contracts**
- **MetaMask**
- **Ethereum Sepolia Testnet**

---

## Local Setup

```bash
npm install
npx hardhat compile
```

## Governance Workflow (MVP)

1. Deploy `UniToken`.
2. Whitelist initial student addresses, treasury, and the registrar.
3. Deploy `UniDAO` with `TOKEN_ADDRESS`, `TREASURY_ADDRESS`, `VOTE_FEE`, and `REGISTRAR_ADDRESS`.
4. Whitelist the DAO address.
5. Transfer token ownership to the DAO.

Sample scripts (env vars in `.env`):

```bash
TOKEN_ADDRESS=0x...
ACCOUNT_ADDR=0x... ALLOWED=true npx hardhat run scripts/whitelist.js --network sepolia

TREASURY_ADDRESS=0x... REGISTRAR_ADDRESS=0x... VOTE_FEE=1 \
  npx hardhat run scripts/deploy-dao.js --network sepolia

TOKEN_ADDRESS=0x... ACCOUNT_ADDR=0x... ALLOWED=true npx hardhat run scripts/whitelist.js --network sepolia

TOKEN_ADDRESS=0x... DAO_ADDRESS=0x... npx hardhat run scripts/transfer-ownership.js --network sepolia
```

## Registrar Actions (admin, no voting)

```bash
DAO_ADDRESS=0x... STUDENT_ADDR=0x... npx hardhat run scripts/registrar-add-student.js --network sepolia
DAO_ADDRESS=0x... STUDENT_ADDR=0x... npx hardhat run scripts/registrar-remove-student.js --network sepolia
DAO_ADDRESS=0x... TO_ADDR=0x... AMOUNT=1 npx hardhat run scripts/registrar-mint.js --network sepolia
DAO_ADDRESS=0x... FROM_ADDR=0x... AMOUNT=1 npx hardhat run scripts/registrar-burn.js --network sepolia
```
