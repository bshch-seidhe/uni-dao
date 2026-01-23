const hre = require("hardhat");
require("dotenv").config();

const tokenAddress = process.env.TOKEN_ADDRESS;
if (!tokenAddress) {
  throw new Error("TOKEN_ADDRESS not set");
}

const FROM = process.env.FROM_ADDR;
const AMOUNT = process.env.AMOUNT || "10"; // default 10 UDT

async function main() {
  if (!FROM) throw new Error("Set FROM_ADDR env var, e.g. FROM_ADDR=0x...");

  const [caller] = await hre.ethers.getSigners();
  const token = await hre.ethers.getContractAt("UniToken", tokenAddress);

  const amount = hre.ethers.parseUnits(AMOUNT, 18);
  const tx = await token.burn(FROM, amount);

  console.log("caller:", caller.address);
  console.log("burn from:", FROM);
  console.log("amount:", AMOUNT, "UDT");
  console.log("tx:", tx.hash);

  await tx.wait();
  console.log("✅ burn confirmed");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});