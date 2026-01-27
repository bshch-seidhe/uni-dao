const hre = require("hardhat");
require("dotenv").config();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
if (!TOKEN_ADDRESS) {
  throw new Error("TOKEN_ADDRESS not set");
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying UniDAO with account:", deployer.address);
  console.log("Using UniToken at:", TOKEN_ADDRESS);

  const INITIAL_QUORUM = 1;

  const UniDAO = await hre.ethers.getContractFactory("UniDAO");
  const dao = await UniDAO.deploy(TOKEN_ADDRESS, INITIAL_QUORUM);

  await dao.waitForDeployment();

  console.log("✅ UniDAO deployed to:", await dao.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});