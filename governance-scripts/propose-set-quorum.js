const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
if (!DAO_ADDRESS) throw new Error("DAO_ADDRESS not set");

const NEW_QUORUM = process.env.NEW_QUORUM;
const TITLE = process.env.TITLE || "Set quorum";
const DESCRIPTION = process.env.DESCRIPTION || "Adjust minimum quorum";
const DURATION = process.env.DURATION || "3600";

async function main() {
  if (!NEW_QUORUM) throw new Error("Set NEW_QUORUM");

  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);

  const tx = await dao.proposeSetQuorum(TITLE, DESCRIPTION, NEW_QUORUM, DURATION);
  const receipt = await tx.wait();

  console.log("✅ propose-set-quorum sent");
  console.log("tx:", receipt.hash);
}

main().catch(console.error);
