const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
if (!DAO_ADDRESS) throw new Error("DAO_ADDRESS not set");

const PROPOSAL_ID = process.env.PROPOSAL_ID;

async function main() {
  if (!PROPOSAL_ID) throw new Error("Set PROPOSAL_ID");

  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);

  const tx = await dao.finalize(PROPOSAL_ID);
  const receipt = await tx.wait();

  console.log("✅ proposal finalized");
  console.log("tx:", receipt.hash);
}

main().catch(console.error);