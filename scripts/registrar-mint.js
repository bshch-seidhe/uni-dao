const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
const TO = process.env.TO_ADDR;
const AMOUNT = process.env.AMOUNT || "1";
if (!DAO_ADDRESS || !TO) {
  throw new Error("DAO_ADDRESS or TO_ADDR not set");
}

async function main() {
  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);
  const amount = hre.ethers.parseUnits(AMOUNT, 18);
  const tx = await dao.registrarMint(TO, amount);
  await tx.wait();
  console.log("✅ registrar mint:", TO, AMOUNT, "UDT");
}

main().catch(console.error);
