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
- Initial supply: **0 UDT** — nothing is pre-minted at deploy. Supply is created on demand
  (member grants, registrar mints) up to a hard `cap` set at deploy time.
- Whitelist-transferable (only whitelisted addresses can send/receive)
- Two-step ownership (`Ownable2Step`) — a typo'd `transferOwnership` target can't brick the
  contract, since the new owner must separately `acceptOwnership()`. `renounceOwnership()` is
  disabled outright.
- Permit support (`ERC20Permit` / EIP-2612) — lets DAO members vote and pay the vote fee in a
  single signed transaction instead of a separate `approve()` step.
- Token contract address (Sepolia testnet):
  [`0x270D86C1739E92616760fE099f12f8d3F26C3d87`](https://sepolia.etherscan.io/address/0x270D86C1739E92616760fE099f12f8d3F26C3d87#code)
  — source verified on Etherscan

### UniDAO (Governance + Registrar)
- Proposal creation (custom title + description, length-capped)
- On-chain voting (1 address = 1 vote, membership-gated — see below), plus one-transaction
  `voteWithPermit`
- Vote fee in UDT (sent to treasury)
- Quorum expressed in basis points of the live member count (`quorumBps`), so it can never be
  stranded above an unreachable absolute number
- Proposal finalization, with an explicit `state()` view (`Active` / `PendingFinalize` /
  `Succeeded` / `Defeated` / `Cancelled`) and paginated `getProposals(offset, limit)`
- Governance updates via proposal: quorum, treasury, vote fee, registrar, member auto-mint
  grant (`SET_MEMBER_GRANT`), token ownership handoff (`SET_TOKEN_OWNER`), and moving treasury
  funds out (`TRANSFER`)
- Registrar role for admin actions (add/remove students individually or in batch, mint,
  clawback)
- DAO contract address (Sepolia testnet):
  [`0xC0618Fa152C7fcE790ABDb306EdB059dfd360462`](https://sepolia.etherscan.io/address/0xC0618Fa152C7fcE790ABDb306EdB059dfd360462#code)
  — source verified on Etherscan

Current deployment parameters: `cap = 10,000,000 UDT`, `quorumBps = 3000` (30%), `voteFee = 1 UDT`,
`minDuration = 120s` (demo value), `minMembers = 3`, `proposalCooldown = 60s` (demo value),
`memberGrant = 20 UDT`.

See [`docs/deployments/sepolia.md`](docs/deployments/sepolia.md) for the full deployment log
(addresses, block numbers, constructor args, git commit hash per redeploy).

---

## Governance Model (MVP)

- **Membership is tracked directly** (`isMember` / `memberCount`), not inferred from the token
  whitelist — the whitelist also contains non-members (e.g. the treasury), so deriving
  membership from it let registrar actions desync `memberCount` in the earlier version of this
  contract.
- **Students vote on community proposals** (e.g. elections, events). New members can vote
  immediately: if `memberGrant > 0`, `registrarAddStudent(s)` mints it to the new member in the
  same call.
- **Registrar handles admin tasks** without student voting:
  - add/remove students (single or batch)
  - mint tokens, or claw back tokens from a holder (`registrarClawback` — see trust assumption
    below)
- **DAO can replace the registrar** via proposal.

This keeps the system decentralized while avoiding admin work for every student.

### Residual trust assumptions (registrar)

The registrar is a trusted role, not a trustless one. Two specific powers are worth calling out
explicitly rather than leaving implicit:

- **Member floor, not a full lock.** The registrar cannot remove members once `memberCount`
  drops to `minMembers` (`BelowMemberFloor` reverts further removals) — this exists so a
  registrar can't empty the roster and deadlock the very `SET_REGISTRAR` proposal that would
  replace them. It does **not** prevent the registrar from unilaterally removing members down to
  that floor; a registrar who wants to suppress a specific voting bloc can still do so as long as
  `memberCount` stays above `minMembers`.
- **`registrarClawback` is an unrestricted admin power**, not an allowance-gated one. It calls
  `UniToken.adminBurn`, which burns from any holder's balance with no consent check. It is
  labeled honestly (named, and emits `AdminBurn`) rather than disguised as a symmetric
  counterpart to `mint`, but it is still a unilateral registrar power over every holder's
  balance.

---

## Tech Stack

- **Solidity** (0.8.28, `viaIR` enabled)
- **Hardhat** — compile, test, deploy, Etherscan verification
- **Ethers.js**
- **OpenZeppelin Contracts** (v5)
- **React + Vite** — frontend (`uni-dao-ui/`)
- **MetaMask**
- **Ethereum Sepolia Testnet**

---

## Local Setup

```bash
npm install
npx hardhat compile
npx hardhat test
```

`.env` (never committed) needs:

```
SEPOLIA_RPC_URL=https://...
PRIVATE_KEY=0x...
TOKEN_ADDRESS=...
DAO_ADDRESS=...
ETHERSCAN_API_KEY=...
```

### Frontend

```bash
cd uni-dao-ui
npm install
npm run dev
```

After any contract redeploy, the frontend needs both the new ABIs and the new addresses:

```bash
cp artifacts/contracts/UniToken.sol/UniToken.json  uni-dao-ui/src/contracts/
cp artifacts/contracts/UniDAO.sol/UniDAO.json      uni-dao-ui/src/contracts/
# then update DAO_ADDRESS / TOKEN_ADDRESS in uni-dao-ui/src/utils/constants.js
```

---

## Deployment Workflow

Redeploy is the migration strategy — there is no proxy and no state migration. A new deployment
starts with an empty member registry and no proposals; students must be re-added.

1. Commit first, and record `git rev-parse HEAD` — it is the only durable link from an on-chain
   address back to the source that produced it.
2. Deploy `UniToken` with a `TOKEN_CAP` (defaults to 10,000,000 UDT).
3. Whitelist the treasury address. **Required before step 4** — the DAO constructor reverts with
   `TreasuryNotWhitelisted` otherwise.
4. Deploy `UniDAO` with `TOKEN_ADDRESS`, `TREASURY_ADDRESS`, `REGISTRAR_ADDRESS`, `QUORUM_BPS`,
   `VOTE_FEE`, `MIN_DURATION_SECONDS`, `MIN_MEMBERS`, `PROPOSAL_COOLDOWN_SECONDS`, and
   `MEMBER_GRANT`.
5. Whitelist the DAO address.
6. Transfer token ownership to the DAO — **two steps**: `token.transferOwnership(DAO)`, then
   the DAO's registrar calls `dao.acceptTokenOwnership()`. `scripts/transfer-ownership.js` does
   both and asserts `token.owner() === DAO_ADDRESS` before exiting. It requires the signer to be
   both the current token owner and the DAO registrar, so deploy with the registrar account.
7. Verify both contracts on Etherscan. Constructor args must match the deployment exactly, and
   `hardhat.config.js` must not change between deploy and verify (`viaIR` affects the bytecode).
8. Append an entry to `docs/deployments/sepolia.md` and update the addresses above.
9. Sync the frontend ABIs and addresses (see above).
10. Add students **through the DAO registrar** (`registrarAddStudent` / `registrarAddStudents`
    for a batch), not directly on the token — the DAO counts members this way, and quorum scales
    with the live member count so governance can never deadlock itself.

### Governance safety rules

- Each proposal snapshots quorum (as an absolute member count, derived from `quorumBps` and
  `memberCount` at creation time) at creation; later quorum changes do not affect proposals
  already in flight.
- Proposal duration: minimum `minDuration` (set at deploy, floor of 120s), maximum 30 days
  (`MAX_DURATION`).
- Vote fee is capped at 100 UDT (`MAX_VOTE_FEE`), at deployment and via proposals.
- Proposals are rate-limited per proposer by `proposalCooldown`.
- `SET_QUORUM`, `SET_TREASURY`, `SET_TOKEN_OWNER`, and `TRANSFER` proposals are re-validated at
  execution time; if conditions became invalid mid-vote (e.g. the target lost the whitelist, or
  the DAO no longer owns the token), the proposal finalizes as failed instead of executing or
  blocking `finalize()`.
- The registrar cannot un-whitelist the treasury or the DAO itself (either would freeze
  fee-paying votes), and cannot remove members below `minMembers` (see trust assumptions above).
- A proposer can cancel their own proposal while it has no votes.
- `TRANSFER` proposals move UDT out of `treasury`; since `treasury` is typically an EOA, it must
  separately `approve()` the DAO for the contract to actually move funds when such a proposal
  passes.

Sample scripts (env vars in `.env`):

```bash
TOKEN_CAP=10000000 npx hardhat run scripts/deploy.js --network sepolia

TOKEN_ADDRESS=0x... ACCOUNT_ADDR=<TREASURY> ALLOWED=true \
  npx hardhat run scripts/whitelist.js --network sepolia

TOKEN_ADDRESS=0x... TREASURY_ADDRESS=0x... REGISTRAR_ADDRESS=0x... \
  QUORUM_BPS=3000 VOTE_FEE=1 MIN_DURATION_SECONDS=120 MIN_MEMBERS=3 \
  PROPOSAL_COOLDOWN_SECONDS=60 MEMBER_GRANT=20 \
  npx hardhat run scripts/deploy-dao.js --network sepolia

TOKEN_ADDRESS=0x... ACCOUNT_ADDR=<DAO> ALLOWED=true \
  npx hardhat run scripts/whitelist.js --network sepolia

TOKEN_ADDRESS=0x... DAO_ADDRESS=0x... \
  npx hardhat run scripts/transfer-ownership.js --network sepolia

npx hardhat verify --network sepolia <TOKEN> 10000000
npx hardhat verify --network sepolia <DAO> <TOKEN> 3000 <TREASURY> 1 <REGISTRAR> 120 3 60 20
```

`MIN_DURATION_SECONDS=120` and `PROPOSAL_COOLDOWN_SECONDS=60` are **demo values**, short enough
to exercise the full proposal lifecycle interactively. For any non-demo use, redeploy with
realistic values (e.g. `3600` and up).

## Registrar Actions (admin, no voting)

```bash
DAO_ADDRESS=0x... STUDENT_ADDR=0x... npx hardhat run scripts/registrar-add-student.js --network sepolia
DAO_ADDRESS=0x... STUDENT_ADDRS=0x...,0x...,0x... npx hardhat run scripts/registrar-add-students.js --network sepolia
DAO_ADDRESS=0x... STUDENT_ADDR=0x... npx hardhat run scripts/registrar-remove-student.js --network sepolia
DAO_ADDRESS=0x... TO_ADDR=0x... AMOUNT=1 npx hardhat run scripts/registrar-mint.js --network sepolia
DAO_ADDRESS=0x... FROM_ADDR=0x... AMOUNT=1 npx hardhat run scripts/registrar-clawback.js --network sepolia
```

With `memberGrant > 0`, a student added through the registrar receives their grant in the same
transaction and can vote immediately — no separate mint needed.

Note that `minMembers = 3` means removals are only possible while `memberCount` is above 3; with
exactly 3 members, `registrarRemoveStudent` reverts with `BelowMemberFloor`.
