const hre = require("hardhat");
require("dotenv").config();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS;
const REGISTRAR_ADDRESS = process.env.REGISTRAR_ADDRESS;
const VOTE_FEE = process.env.VOTE_FEE || "1";
const QUORUM_BPS = process.env.QUORUM_BPS || "3000";
const MIN_DURATION_SECONDS = process.env.MIN_DURATION_SECONDS || "120"; // demo default
const MIN_MEMBERS = process.env.MIN_MEMBERS || "3";
const PROPOSAL_COOLDOWN_SECONDS = process.env.PROPOSAL_COOLDOWN_SECONDS || "60"; // demo default
const MEMBER_GRANT = process.env.MEMBER_GRANT || "20";
if (!TOKEN_ADDRESS || !TREASURY_ADDRESS || !REGISTRAR_ADDRESS) {
  throw new Error("TOKEN_ADDRESS, TREASURY_ADDRESS, or REGISTRAR_ADDRESS not set");
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying UniDAO with account:", deployer.address);
  console.log("Using UniToken at:", TOKEN_ADDRESS);

  const quorumBps = BigInt(QUORUM_BPS);
  const voteFee = hre.ethers.parseUnits(VOTE_FEE, 18);
  const minDuration = BigInt(MIN_DURATION_SECONDS);
  const minMembers = BigInt(MIN_MEMBERS);
  const proposalCooldown = BigInt(PROPOSAL_COOLDOWN_SECONDS);
  const memberGrant = hre.ethers.parseUnits(MEMBER_GRANT, 18);

  const UniDAO = await hre.ethers.getContractFactory("UniDAO");
  const dao = await UniDAO.deploy(
    TOKEN_ADDRESS,
    quorumBps,
    TREASURY_ADDRESS,
    voteFee,
    REGISTRAR_ADDRESS,
    minDuration,
    minMembers,
    proposalCooldown,
    memberGrant
  );

  await dao.waitForDeployment();

  console.log("✅ UniDAO deployed to:", await dao.getAddress());
  console.log("quorumBps:", QUORUM_BPS, "minDuration:", MIN_DURATION_SECONDS, "minMembers:", MIN_MEMBERS);
  console.log("proposalCooldown:", PROPOSAL_COOLDOWN_SECONDS, "memberGrant:", MEMBER_GRANT, "UDT");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
