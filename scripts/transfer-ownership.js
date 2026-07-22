const hre = require("hardhat");
require("dotenv").config();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const DAO_ADDRESS = process.env.DAO_ADDRESS;

if (!TOKEN_ADDRESS || !DAO_ADDRESS) {
  throw new Error("TOKEN_ADDRESS or DAO_ADDRESS not set");
}
if (!hre.ethers.isAddress(TOKEN_ADDRESS)) {
  throw new Error(`TOKEN_ADDRESS is not a valid address: ${TOKEN_ADDRESS}`);
}
if (!hre.ethers.isAddress(DAO_ADDRESS)) {
  throw new Error(`DAO_ADDRESS is not a valid address: ${DAO_ADDRESS}`);
}

async function main() {
  const [signer] = await hre.ethers.getSigners();

  const token = await hre.ethers.getContractAt("UniToken", TOKEN_ADDRESS);
  const dao = await hre.ethers.getContractAt("UniDAO", DAO_ADDRESS);

  const currentOwner = await token.owner();
  if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer ${signer.address} is not the current token owner (${currentOwner}). ` +
      `transferOwnership must be sent from the owner.`
    );
  }

  const registrar = await dao.registrar();
  if (registrar.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer ${signer.address} is not the DAO registrar (${registrar}). ` +
      `acceptTokenOwnership must be sent from the registrar. Deploy with the same ` +
      `account as the registrar, or run the two steps from their respective signers.`
    );
  }

  // Idempotency guard: if a previous run already completed, don't re-run.
  if (currentOwner.toLowerCase() === DAO_ADDRESS.toLowerCase()) {
    console.log("Token owner is already the DAO. Nothing to do.");
    return;
  }

  // --- Step 1: current owner nominates the DAO (Ownable2Step: not final yet) ---
  console.log("Current token owner:", currentOwner);
  console.log("Step 1: token.transferOwnership(DAO) ->", DAO_ADDRESS);
  const tx1 = await token.transferOwnership(DAO_ADDRESS);
  await tx1.wait();

  const pending = await token.pendingOwner();
  if (pending.toLowerCase() !== DAO_ADDRESS.toLowerCase()) {
    throw new Error(`pendingOwner is ${pending}, expected ${DAO_ADDRESS}. Aborting before step 2.`);
  }

  // --- Step 2: DAO accepts, via its registrar-gated wrapper ---
  console.log("Step 2: dao.acceptTokenOwnership()");
  const tx2 = await dao.acceptTokenOwnership();
  await tx2.wait();

  // --- Verify final state ---
  const newOwner = await token.owner();
  if (newOwner.toLowerCase() !== DAO_ADDRESS.toLowerCase()) {
    console.error("❌ token.owner() is", newOwner, "expected", DAO_ADDRESS);
    process.exitCode = 1;
    return;
  }

  console.log("✅ Ownership transferred and accepted. token.owner() =", newOwner);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
