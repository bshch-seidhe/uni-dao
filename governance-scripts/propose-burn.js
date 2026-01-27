const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
if (!DAO_ADDRESS) throw new Error("DAO_ADDRESS not set");

const FROM = process.env.FROM_ADDR;
const AMOUNT = process.env.AMOUNT || "10"; // UDT
const DURATION = process.env.DURATION || "300"; // 5 minutes

async function main() {
  if (!FROM) throw new Error("Set FROM_ADDR");

  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);
  const amount = hre.ethers.parseUnits(AMOUNT, 18);

  const tx = await dao.proposeBurn(FROM, amount, DURATION);
  const receipt = await tx.wait();

  console.log("✅ propose-burn sent");
  console.log("tx:", receipt.hash);
}

main().catch(console.error);