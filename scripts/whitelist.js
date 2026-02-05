const hre = require("hardhat");
require("dotenv").config();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const ACCOUNT = process.env.ACCOUNT_ADDR;
const ALLOWED = process.env.ALLOWED || "true";

if (!TOKEN_ADDRESS) throw new Error("TOKEN_ADDRESS not set");
if (!ACCOUNT) throw new Error("ACCOUNT_ADDR not set");

async function main() {
  const token = await hre.ethers.getContractAt("UniToken", TOKEN_ADDRESS);
  const allowed = ALLOWED === "true";

  const tx = await token.setWhitelisted(ACCOUNT, allowed);
  await tx.wait();

  console.log("✅ whitelist updated:", ACCOUNT, allowed);
}

main().catch(console.error);
