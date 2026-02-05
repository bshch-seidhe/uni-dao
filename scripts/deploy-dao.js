const hre = require("hardhat");
require("dotenv").config();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS;
const REGISTRAR_ADDRESS = process.env.REGISTRAR_ADDRESS;
const VOTE_FEE = process.env.VOTE_FEE || "1";
if (!TOKEN_ADDRESS || !TREASURY_ADDRESS || !REGISTRAR_ADDRESS) {
  throw new Error("TOKEN_ADDRESS, TREASURY_ADDRESS, or REGISTRAR_ADDRESS not set");
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying UniDAO with account:", deployer.address);
  console.log("Using UniToken at:", TOKEN_ADDRESS);

  const INITIAL_QUORUM = 1;
  const voteFee = hre.ethers.parseUnits(VOTE_FEE, 18);

  const UniDAO = await hre.ethers.getContractFactory("UniDAO");
  const dao = await UniDAO.deploy(
    TOKEN_ADDRESS,
    INITIAL_QUORUM,
    TREASURY_ADDRESS,
    voteFee,
    REGISTRAR_ADDRESS
  );

  await dao.waitForDeployment();

  console.log("✅ UniDAO deployed to:", await dao.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
