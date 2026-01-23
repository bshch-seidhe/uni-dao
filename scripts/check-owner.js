const hre = require("hardhat");
require("dotenv").config();

const tokenAddress = process.env.TOKEN_ADDRESS;
if (!tokenAddress) {
  throw new Error("TOKEN_ADDRESS not set");
}

async function main() {
  const token = await hre.ethers.getContractAt("UniToken", tokenAddress);
  const owner = await token.owner();
  console.log("Token owner:", owner);
}

main().catch(console.error);