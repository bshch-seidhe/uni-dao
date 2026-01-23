const hre = require("hardhat");
require("dotenv").config();

const tokenAddress = process.env.TOKEN_ADDRESS;
if (!tokenAddress) {
  throw new Error("TOKEN_ADDRESS not set");
}

const TO = process.env.TO_ADDR;

async function main() {
  if (!TO) throw new Error("Set TO_ADDR env var, e.g. TO_ADDR=0x...");

  const [sender] = await hre.ethers.getSigners();
  const token = await hre.ethers.getContractAt("UniToken", tokenAddress);

  const amount = hre.ethers.parseUnits("10", 18); // 10 UDT
  const tx = await token.transfer(TO, amount);

  console.log("from:", sender.address);
  console.log("to:", TO);
  console.log("tx:", tx.hash);

  await tx.wait();
  console.log("✅ transfer confirmed");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});