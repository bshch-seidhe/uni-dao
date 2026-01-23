const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Current signer address:", signer.address);
}

main().catch(console.error);