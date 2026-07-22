const hre = require("hardhat");
require("dotenv").config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
const STUDENTS = process.env.STUDENT_ADDRS;
if (!DAO_ADDRESS || !STUDENTS) {
  throw new Error("DAO_ADDRESS or STUDENT_ADDRS not set");
}

async function main() {
  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);
  const students = STUDENTS.split(",").map((s) => s.trim()).filter(Boolean);
  const tx = await dao.registrarAddStudents(students);
  await tx.wait();
  console.log("✅ registrar add students:", students.join(", "));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
