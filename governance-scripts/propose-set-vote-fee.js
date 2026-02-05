const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
if (!DAO_ADDRESS) throw new Error("DAO_ADDRESS not set");

const NEW_FEE = process.env.NEW_FEE;
const TITLE = process.env.TITLE || "Set vote fee";
const DESCRIPTION = process.env.DESCRIPTION || "Update vote fee (UDT)";
const DURATION = process.env.DURATION || "300";

async function main() {
  if (!NEW_FEE) throw new Error("Set NEW_FEE");

  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);
  const fee = hre.ethers.parseUnits(NEW_FEE, 18);
  const tx = await dao.proposeSetVoteFee(TITLE, DESCRIPTION, fee, DURATION);
  const receipt = await tx.wait();

  console.log("✅ propose-set-vote-fee sent");
  console.log("tx:", receipt.hash);
}

main().catch(console.error);
