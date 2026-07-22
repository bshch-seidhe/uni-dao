const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
const FROM = process.env.FROM_ADDR;
const AMOUNT = process.env.AMOUNT || "1";
if (!DAO_ADDRESS || !FROM) {
  throw new Error("DAO_ADDRESS or FROM_ADDR not set");
}

async function main() {
  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);
  const amount = hre.ethers.parseUnits(AMOUNT, 18);
  const tx = await dao.registrarClawback(FROM, amount);
  await tx.wait();
  console.log("✅ registrar clawback:", FROM, AMOUNT, "UDT");
}

main().catch(console.error);
