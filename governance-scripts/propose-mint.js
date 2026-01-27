const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
if (!DAO_ADDRESS) throw new Error("DAO_ADDRESS not set");

const TO = process.env.TO_ADDR;
const AMOUNT = process.env.AMOUNT || "10"; // UDT
const DURATION = process.env.DURATION || "300"; // 5 minutes

async function main() {
  if (!TO) throw new Error("Set TO_ADDR");

  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);
  const amount = hre.ethers.parseUnits(AMOUNT, 18);

  const tx = await dao.proposeMint(TO, amount, DURATION);
  const receipt = await tx.wait();

  console.log("✅ propose-mint sent");
  console.log("tx:", receipt.hash);
}

main().catch(console.error);