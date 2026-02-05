const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
if (!DAO_ADDRESS) throw new Error("DAO_ADDRESS not set");

const TREASURY = process.env.TREASURY_ADDR;
const TITLE = process.env.TITLE || "Set treasury";
const DESCRIPTION = process.env.DESCRIPTION || "Update DAO treasury address";
const DURATION = process.env.DURATION || "300";

async function main() {
  if (!TREASURY) throw new Error("Set TREASURY_ADDR");

  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);
  const tx = await dao.proposeSetTreasury(TITLE, DESCRIPTION, TREASURY, DURATION);
  const receipt = await tx.wait();

  console.log("✅ propose-set-treasury sent");
  console.log("tx:", receipt.hash);
}

main().catch(console.error);
