const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
if (!DAO_ADDRESS) throw new Error("DAO_ADDRESS not set");

const TITLE = process.env.TITLE || "General proposal";
const DESCRIPTION = process.env.DESCRIPTION || "A student governance proposal";
const DURATION = process.env.DURATION || "300";

async function main() {
  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);
  const tx = await dao.proposeGeneral(TITLE, DESCRIPTION, DURATION);
  const receipt = await tx.wait();

  console.log("✅ propose-general sent");
  console.log("tx:", receipt.hash);
}

main().catch(console.error);
