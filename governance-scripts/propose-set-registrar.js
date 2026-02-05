const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
if (!DAO_ADDRESS) throw new Error("DAO_ADDRESS not set");

const REGISTRAR = process.env.REGISTRAR_ADDR;
const TITLE = process.env.TITLE || "Set registrar";
const DESCRIPTION = process.env.DESCRIPTION || "Update registrar address";
const DURATION = process.env.DURATION || "300";

async function main() {
  if (!REGISTRAR) throw new Error("Set REGISTRAR_ADDR");

  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);
  const tx = await dao.proposeSetRegistrar(TITLE, DESCRIPTION, REGISTRAR, DURATION);
  const receipt = await tx.wait();

  console.log("✅ propose-set-registrar sent");
  console.log("tx:", receipt.hash);
}

main().catch(console.error);
