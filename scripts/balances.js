const hre = require("hardhat");
require("dotenv").config();

const tokenAddress = process.env.TOKEN_ADDRESS;
if (!tokenAddress) {
  throw new Error("TOKEN_ADDRESS not set");
}

const CHECK_ADDR = process.env.CHECK_ADDR || "";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const addr = CHECK_ADDR || signer.address;

  const token = await hre.ethers.getContractAt("UniToken", tokenAddress);
  const bal = await token.balanceOf(addr);

  console.log("address:", addr);
  console.log("balance:", hre.ethers.formatUnits(bal, 18), "UDT");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});