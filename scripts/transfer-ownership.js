const hre = require("hardhat");
require("dotenv").config();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const DAO_ADDRESS = process.env.DAO_ADDRESS;

if (!TOKEN_ADDRESS || !DAO_ADDRESS) {
  throw new Error("TOKEN_ADDRESS or DAO_ADDRESS not set");
}

async function main() {
  const [owner] = await hre.ethers.getSigners();

  const token = await hre.ethers.getContractAt("UniToken", TOKEN_ADDRESS);

  console.log("Current owner:", owner.address);
  console.log("Transferring ownership to DAO:", DAO_ADDRESS);

  const tx = await token.transferOwnership(DAO_ADDRESS);
  await tx.wait();

  console.log("✅ Ownership transferred to UniDAO");
}

main().catch(console.error);