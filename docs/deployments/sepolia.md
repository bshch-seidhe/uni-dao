# Sepolia deployments

Every redeploy gets its own entry below. The git commit hash is the only durable
link from an on-chain address back to the source that produced it — always record it.

<!-- Append new entries below this line, most recent first. -->

## 2026-07-20 — zero-initial-supply token; DAO with member floor & grant
- **git commit:** `7bede1dbeeaef3dbb2ab01a46ef783e184cd9d53` (committed before deploy — matches deployed bytecode)
- **UniToken (UDT):** 0x270D86C1739E92616760fE099f12f8d3F26C3d87 — block 11314987
  - constructor args: cap = 10,000,000 UDT
  - verified: https://sepolia.etherscan.io/address/0x270D86C1739E92616760fE099f12f8d3F26C3d87#code
- **UniDAO:** 0xC0618Fa152C7fcE790ABDb306EdB059dfd360462 — block 11315343
  - constructor args: token=0x270D86C1739E92616760fE099f12f8d3F26C3d87, quorumBps=3000, treasury=0x4BB28501bEE6373404Ed4E3C37aFF306672416e5, voteFee=1, 
    registrar=0xCaa68af58cbC5dE70Cb3e3E54Ff0726B52edBc53, minDuration=120, minMembers=3, proposalCooldown=60, memberGrant=20
  - verified: https://sepolia.etherscan.io/address/0xC0618Fa152C7fcE790ABDb306EdB059dfd360462#code
  - post-deploy: treasury whitelisted; DAO whitelisted; token ownership
    transferred to DAO and accepted (token.owner() == DAO confirmed)
  - demo values: minDuration=120s, proposalCooldown=60s — NOT for production
