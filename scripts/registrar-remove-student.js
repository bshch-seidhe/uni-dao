const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
const STUDENT = process.env.STUDENT_ADDR;
if (!DAO_ADDRESS || !STUDENT) {
  throw new Error("DAO_ADDRESS or STUDENT_ADDR not set");
}

async function main() {
  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);
  const tx = await dao.registrarRemoveStudent(STUDENT);
  await tx.wait();
  console.log("✅ registrar remove student:", STUDENT);
}

main().catch(console.error);
