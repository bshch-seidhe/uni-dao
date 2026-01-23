const hre = require("hardhat");
require("dotenv").config();

const tokenAddress = process.env.TOKEN_ADDRESS;
if (!tokenAddress) {
  throw new Error("TOKEN_ADDRESS not set");
}

const TO = process.env.TO_ADDR;
const AMOUNT = process.env.AMOUNT || "10"; // default 10 UDT

async function main() {
  if (!TO) throw new Error("Set TO_ADDR env var, e.g. TO_ADDR=0x...");

  const [caller] = await hre.ethers.getSigners();
  const token = await hre.ethers.getContractAt("UniToken", tokenAddress);

  const amount = hre.ethers.parseUnits(AMOUNT, 18);
  const tx = await token.mint(TO, amount);

  console.log("caller:", caller.address);
  console.log("mint to:", TO);
  console.log("tx:", tx.hash);

  await tx.wait();
  console.log("✅ mint confirmed");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});