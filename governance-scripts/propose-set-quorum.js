const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
if (!DAO_ADDRESS) throw new Error("DAO_ADDRESS not set");

const NEW_QUORUM_BPS = process.env.NEW_QUORUM_BPS; // basis points, e.g. 3000 = 30%
const TITLE = process.env.TITLE || "Set quorum";
const DESCRIPTION = process.env.DESCRIPTION || "Adjust quorum (basis points)";
const DURATION = process.env.DURATION || "3600";

async function main() {
  if (!NEW_QUORUM_BPS) throw new Error("Set NEW_QUORUM_BPS (basis points, e.g. 3000 = 30%)");

  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);

  const tx = await dao.proposeSetQuorum(TITLE, DESCRIPTION, NEW_QUORUM_BPS, DURATION);
  const receipt = await tx.wait();

  console.log("✅ propose-set-quorum sent");
  console.log("tx:", receipt.hash);
}

main().catch(console.error);
