const { ethers } = require("hardhat");

async function main() {
  const dao = await ethers.getContractAt("UniDAO", process.env.DAO_ADDRESS);

  try {
    console.log("quorumBps:  ", (await dao.quorumBps()).toString());
    console.log("minMembers: ", (await dao.minMembers()).toString());
    console.log("memberGrant:", ethers.formatUnits(await dao.memberGrant(), 18), "UDT");
    console.log("memberCount:", (await dao.memberCount()).toString());
    console.log("→ new version");
  } catch {
    console.log("→ old version (missing quorumBps/minMembers)");
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });